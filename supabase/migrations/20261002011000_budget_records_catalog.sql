ALTER TABLE public.orcamento_workspace ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF to_regclass('public.orcamento_settings') IS NOT NULL THEN
    INSERT INTO public.orcamento_workspace(user_id,settings)
      SELECT u.id,s.settings FROM public.users u CROSS JOIN (SELECT settings FROM public.orcamento_settings ORDER BY updated_at DESC LIMIT 1) s ON CONFLICT(user_id) DO NOTHING;
  END IF;
END $$;
CREATE TABLE public.orcamento_catalog(
  id INTEGER PRIMARY KEY CHECK(id=1),materials JSONB NOT NULL DEFAULT '[]',catalog JSONB NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.orcamento_catalog(id,materials,catalog)
  SELECT 1,materials,catalog FROM public.orcamento_workspace WHERE catalog<>'{}'::JSONB ORDER BY updated_at DESC,user_id LIMIT 1;
INSERT INTO public.orcamento_catalog(id) VALUES(1) ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orcamento_budgets' AND column_name='items') THEN
    ALTER TABLE public.orcamento_budgets RENAME TO orcamento_budgets_legacy;
    REVOKE ALL ON public.orcamento_budgets_legacy FROM anon,authenticated;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.orcamento_products') IS NOT NULL THEN
    UPDATE public.orcamento_catalog SET materials=COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.orcamento_products p),'[]'::JSONB) WHERE materials='[]'::JSONB;
  END IF;
  IF to_regclass('public.orcamento_chapas') IS NOT NULL THEN
    UPDATE public.orcamento_catalog SET catalog=COALESCE((SELECT jsonb_object_agg(brand,catalog_data) FROM public.orcamento_chapas),'{}'::JSONB) WHERE catalog='{}'::JSONB;
  END IF;
END $$;
CREATE TABLE public.orcamento_budgets(
  id TEXT PRIMARY KEY,user_id UUID NOT NULL REFERENCES public.users(id),client_id UUID REFERENCES public.clientes(id),projeto_id UUID REFERENCES public.projetos(id),
  data JSONB NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.orcamento_budgets(id,user_id,client_id,projeto_id,data)
SELECT w.user_id::TEXT||':'||(b->>'id'),w.user_id,
  CASE WHEN (b->>'client_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND EXISTS(SELECT 1 FROM public.clientes c WHERE c.id::TEXT=b->>'client_id') THEN (b->>'client_id')::UUID END,
  CASE WHEN (b->>'projeto_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND EXISTS(SELECT 1 FROM public.projetos p WHERE p.id::TEXT=b->>'projeto_id') THEN (b->>'projeto_id')::UUID END,
  jsonb_set(b,'{id}',to_jsonb(w.user_id::TEXT||':'||(b->>'id')))
FROM public.orcamento_workspace w CROSS JOIN LATERAL jsonb_array_elements(w.saved_budgets) b WHERE b->>'id' IS NOT NULL;
DO $$ BEGIN
  IF to_regclass('public.orcamento_budgets_legacy') IS NOT NULL THEN
    INSERT INTO public.orcamento_budgets(id,user_id,client_id,projeto_id,data)
    SELECT b.id,b.user_id,b.client_id,
      CASE WHEN b.projeto_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND EXISTS(SELECT 1 FROM public.projetos p WHERE p.id::TEXT=b.projeto_id) THEN b.projeto_id::UUID END,
      to_jsonb(b)-'user_id'-'is_draft' FROM public.orcamento_budgets_legacy b;
  END IF;
END $$;
UPDATE public.orcamento_workspace SET current_budget_id=user_id::TEXT||':'||current_budget_id WHERE current_budget_id IS NOT NULL;
-- Keep legacy JSON untouched as a migration recovery copy; new writes only modify draft columns.
ALTER TABLE public.orcamento_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_active ON public.orcamento_catalog FOR ALL TO authenticated USING(public.staff_active()) WITH CHECK(public.staff_active());
CREATE POLICY budget_owner ON public.orcamento_budgets FOR ALL TO authenticated USING(public.staff_active() AND (user_id=public.current_staff_id() OR public.staff_admin())) WITH CHECK(public.staff_active() AND (user_id=public.current_staff_id() OR public.staff_admin()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orcamento_catalog,public.orcamento_budgets TO authenticated;

CREATE FUNCTION public.save_budget_workspace(p_items JSONB,p_settings JSONB,p_budget_id TEXT,p_revision INTEGER) RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public
AS $$ DECLARE version INTEGER; BEGIN
  IF NOT public.staff_active() THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
  INSERT INTO public.orcamento_workspace(user_id,current_items,settings,current_budget_id,revision)
    VALUES(public.current_staff_id(),p_items,p_settings,p_budget_id,1)
    ON CONFLICT(user_id) DO UPDATE SET current_items=excluded.current_items,settings=excluded.settings,current_budget_id=excluded.current_budget_id,revision=orcamento_workspace.revision+1
    WHERE orcamento_workspace.revision=p_revision RETURNING revision INTO version;
  IF version IS NULL THEN RAISE EXCEPTION 'Rascunho alterado em outra sessão. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
  RETURN version;
END $$;
CREATE FUNCTION public.save_company_catalog(p_materials JSONB,p_catalog JSONB,p_revision INTEGER) RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public
AS $$ DECLARE version INTEGER; BEGIN
  UPDATE public.orcamento_catalog SET materials=p_materials,catalog=p_catalog,revision=revision+1,updated_at=now() WHERE id=1 AND revision=p_revision RETURNING revision INTO version;
  IF version IS NULL THEN RAISE EXCEPTION 'Tabela alterada por outra pessoa. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
  RETURN version;
END $$;
CREATE FUNCTION public.save_budget_record(p_id TEXT,p_data JSONB,p_revision INTEGER) RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public
AS $$ DECLARE version INTEGER; BEGIN
  IF NOT public.staff_active() THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
  IF p_revision IS NULL THEN
    INSERT INTO public.orcamento_budgets(id,user_id,client_id,projeto_id,data,revision)
      VALUES(p_id,public.current_staff_id(),NULLIF(p_data->>'client_id','')::UUID,NULLIF(p_data->>'projeto_id','')::UUID,p_data,1) RETURNING revision INTO version;
  ELSE
    UPDATE public.orcamento_budgets SET data=p_data,client_id=NULLIF(p_data->>'client_id','')::UUID,projeto_id=NULLIF(p_data->>'projeto_id','')::UUID,revision=revision+1,updated_at=now()
      WHERE id=p_id AND revision=p_revision RETURNING revision INTO version;
    IF version IS NULL THEN RAISE EXCEPTION 'Orçamento alterado em outra sessão. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
  END IF;
  RETURN version;
END $$;
REVOKE ALL ON FUNCTION public.save_budget_workspace(JSONB,JSONB,TEXT,INTEGER),public.save_company_catalog(JSONB,JSONB,INTEGER),public.save_budget_record(TEXT,JSONB,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_budget_workspace(JSONB,JSONB,TEXT,INTEGER),public.save_company_catalog(JSONB,JSONB,INTEGER),public.save_budget_record(TEXT,JSONB,INTEGER) TO authenticated;
NOTIFY pgrst,'reload schema';
