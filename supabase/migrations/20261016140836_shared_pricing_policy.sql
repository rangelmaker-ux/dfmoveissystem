-- Preserve the previous per-account configuration for recovery. Never rewrite saved proposals.
CREATE TABLE public.orcamento_pricing_backup_20261016 AS
  SELECT user_id, settings, revision, updated_at FROM public.orcamento_workspace;
ALTER TABLE public.orcamento_pricing_backup_20261016 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orcamento_pricing_backup_20261016 FROM PUBLIC,anon,authenticated;

ALTER TABLE public.orcamento_catalog ADD COLUMN pricing_settings jsonb;
-- Pricing values verified against the requested reference account on 2026-10-16.
-- Literal values also allow clean installations without requiring a particular user.
UPDATE public.orcamento_catalog SET pricing_settings='{"margin":200,"frete":0,"montagem":0,"comissao_vendas":0,"comissao_executivo":0,"outros":[],"chapa_mode":"m2","chapa_rounding":"up","fita_mode":"metros"}'::jsonb,
  revision=revision+1,updated_at=now() WHERE id=1;
ALTER TABLE public.orcamento_catalog ALTER COLUMN pricing_settings SET NOT NULL;

CREATE FUNCTION public.enforce_shared_budget_pricing() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE policy jsonb; BEGIN
  SELECT pricing_settings INTO policy FROM public.orcamento_catalog WHERE id=1;
  IF policy IS NULL THEN RAISE EXCEPTION 'Parâmetros de preço da loja indisponíveis.'; END IF;
  NEW.settings := coalesce(NEW.settings,'{}'::jsonb) || policy;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_shared_budget_pricing() FROM PUBLIC;
CREATE TRIGGER enforce_shared_budget_pricing_trigger BEFORE INSERT OR UPDATE OF settings ON public.orcamento_workspace
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shared_budget_pricing();

UPDATE public.orcamento_workspace w SET settings=w.settings||c.pricing_settings,revision=w.revision+1,updated_at=now()
  FROM public.orcamento_catalog c WHERE c.id=1 AND w.settings IS DISTINCT FROM w.settings||c.pricing_settings;

CREATE FUNCTION public.protect_shared_budget_pricing() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
  IF auth.role()='authenticated' AND NEW.pricing_settings IS DISTINCT FROM OLD.pricing_settings THEN
    RAISE EXCEPTION 'A precificação é centralizada para todas as contas e não pode ser alterada individualmente.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_shared_budget_pricing() FROM PUBLIC;
CREATE TRIGGER protect_shared_budget_pricing_trigger BEFORE UPDATE OF pricing_settings ON public.orcamento_catalog
  FOR EACH ROW EXECUTE FUNCTION public.protect_shared_budget_pricing();
NOTIFY pgrst,'reload schema';
