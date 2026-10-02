-- Deploy this together with team-auth and migrate existing credentials before switching the UI.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS parcelas JSONB NOT NULL DEFAULT '[]';

CREATE OR REPLACE FUNCTION public.current_staff_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.users WHERE auth_user_id = auth.uid() $$;
CREATE OR REPLACE FUNCTION public.staff_active() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND status = 'ATIVO') $$;
CREATE OR REPLACE FUNCTION public.staff_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND status = 'ATIVO' AND role = 'ADMIN') $$;
REVOKE ALL ON FUNCTION public.current_staff_id(), public.staff_active(), public.staff_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_staff_id(), public.staff_active(), public.staff_admin() TO authenticated;

-- A service-created legacy account preserves its profile ID, ownership and approval state.
-- Public sign-up can never claim an existing profile by supplying its email.
CREATE OR REPLACE FUNCTION public.link_auth_profile() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE legacy UUID;
BEGIN
  legacy := NULLIF(NEW.raw_app_meta_data->>'legacy_profile_id','')::UUID;
  IF legacy IS NOT NULL THEN
    UPDATE public.users SET auth_user_id = NEW.id, password = NULL
      WHERE id = legacy AND lower(email) = lower(NEW.email) AND auth_user_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perfil legado inválido ou já vinculado.'; END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM public.users WHERE lower(email) = lower(NEW.email)) THEN
      RAISE EXCEPTION 'Conta existente: solicite a migração ao administrador.';
    END IF;
    INSERT INTO public.users (id,auth_user_id,nome,email,role,status,password)
      VALUES(NEW.id,NEW.id,COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'nome'),''),'Projetista'),lower(NEW.email),'PROJETISTA','PENDENTE',NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS link_auth_profile_trigger ON auth.users;
CREATE TRIGGER link_auth_profile_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.link_auth_profile();

CREATE OR REPLACE FUNCTION public.protect_staff_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN
  IF auth.role() = 'authenticated' AND NOT public.staff_admin() AND
    (NEW.id IS DISTINCT FROM OLD.id OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status OR NEW.email IS DISTINCT FROM OLD.email OR NEW.password IS DISTINCT FROM OLD.password
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approved_by IS DISTINCT FROM OLD.approved_by) THEN
    RAISE EXCEPTION 'Somente o administrador pode alterar acessos.';
  END IF;
  IF auth.role() = 'authenticated' AND public.staff_admin() AND NEW.status = 'ATIVO' AND OLD.status <> 'ATIVO' THEN
    NEW.approved_by := public.current_staff_id(); NEW.approved_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_staff_identity_trigger ON public.users;
CREATE TRIGGER protect_staff_identity_trigger BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_staff_identity();

-- Replace EVERY permissive policy, rather than adding restrictive-looking policies alongside old ones.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('users','clientes','projetos','agendamentos','comissoes','anotacoes_projeto','orcamento_workspace')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename); END LOOP;
END $$;
REVOKE ALL ON public.users, public.clientes, public.projetos, public.agendamentos, public.comissoes, public.anotacoes_projeto, public.orcamento_workspace FROM anon;
REVOKE ALL ON public.users FROM authenticated;
GRANT SELECT(id,nome,email,role,status,avatar_url,bio,created_at,approved_at,approved_by,auth_user_id) ON public.users TO authenticated;
GRANT UPDATE(nome,avatar_url,bio,status,approved_at,approved_by) ON public.users TO authenticated;
CREATE POLICY staff_read ON public.users FOR SELECT TO authenticated USING(auth_user_id = auth.uid() OR public.staff_active());
CREATE POLICY staff_update ON public.users FOR UPDATE TO authenticated USING(public.staff_admin() OR (public.staff_active() AND id = public.current_staff_id())) WITH CHECK(public.staff_admin() OR (public.staff_active() AND id = public.current_staff_id()));
CREATE POLICY clients_read ON public.clientes FOR SELECT TO authenticated USING(public.staff_active());
CREATE POLICY clients_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK(public.staff_active() AND (public.staff_admin() OR projetista_id = public.current_staff_id()));
CREATE POLICY clients_update ON public.clientes FOR UPDATE TO authenticated USING(public.staff_admin() OR (public.staff_active() AND projetista_id = public.current_staff_id())) WITH CHECK(public.staff_admin() OR (public.staff_active() AND projetista_id = public.current_staff_id()));
CREATE POLICY clients_delete ON public.clientes FOR DELETE TO authenticated USING(public.staff_admin());
CREATE POLICY projects_read ON public.projetos FOR SELECT TO authenticated USING(public.staff_admin() OR (public.staff_active() AND (projetista_id = public.current_staff_id() OR EXISTS(SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.projetista_id = public.current_staff_id()))));
CREATE POLICY projects_insert ON public.projetos FOR INSERT TO authenticated WITH CHECK(public.staff_admin() OR (public.staff_active() AND (projetista_id IS NULL OR projetista_id = public.current_staff_id()) AND EXISTS(SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.projetista_id = public.current_staff_id())));
CREATE POLICY projects_update ON public.projetos FOR UPDATE TO authenticated USING(public.staff_admin() OR (public.staff_active() AND projetista_id = public.current_staff_id())) WITH CHECK(public.staff_admin() OR (public.staff_active() AND projetista_id = public.current_staff_id()));
CREATE POLICY projects_delete ON public.projetos FOR DELETE TO authenticated USING(public.staff_admin());
CREATE POLICY agenda_read ON public.agendamentos FOR SELECT TO authenticated USING(public.staff_active());
CREATE POLICY agenda_insert ON public.agendamentos FOR INSERT TO authenticated WITH CHECK(public.staff_active() AND criado_por = public.current_staff_id() AND (tipo <> 'BLOQUEIO' OR public.staff_admin()));
CREATE POLICY agenda_update ON public.agendamentos FOR UPDATE TO authenticated USING(public.staff_admin() OR (public.staff_active() AND criado_por = public.current_staff_id())) WITH CHECK(public.staff_admin() OR (public.staff_active() AND criado_por = public.current_staff_id() AND tipo <> 'BLOQUEIO'));
CREATE POLICY agenda_delete ON public.agendamentos FOR DELETE TO authenticated USING(public.staff_admin());
CREATE POLICY commissions_read ON public.comissoes FOR SELECT TO authenticated USING(public.staff_admin() OR (public.staff_active() AND projetista_id = public.current_staff_id()));
CREATE POLICY commissions_admin ON public.comissoes FOR ALL TO authenticated USING(public.staff_admin()) WITH CHECK(public.staff_admin());
CREATE POLICY notes_read ON public.anotacoes_projeto FOR SELECT TO authenticated USING(public.staff_active() AND EXISTS(SELECT 1 FROM public.projetos p WHERE p.id = projeto_id));
CREATE POLICY notes_insert ON public.anotacoes_projeto FOR INSERT TO authenticated WITH CHECK(public.staff_active() AND autor_id = public.current_staff_id() AND EXISTS(SELECT 1 FROM public.projetos p WHERE p.id = projeto_id));
CREATE POLICY notes_delete ON public.anotacoes_projeto FOR DELETE TO authenticated USING(public.staff_admin());
CREATE POLICY workspace_owner ON public.orcamento_workspace FOR ALL TO authenticated USING(public.staff_active() AND user_id = public.current_staff_id()) WITH CHECK(public.staff_active() AND user_id = public.current_staff_id());

-- Legacy password RPCs must not remain callable once accounts use Auth.
REVOKE ALL ON FUNCTION public.admin_create_designer(UUID,TEXT,TEXT,TEXT,TEXT), public.admin_delete_designer(UUID,TEXT,UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_client_with_project(p_client JSONB,p_project JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ DECLARE cid UUID; BEGIN
  IF NOT public.staff_active() OR length(trim(p_client->>'nome')) < 2 THEN RAISE EXCEPTION 'Cadastro inválido.'; END IF;
  INSERT INTO public.clientes(nome,telefone,projetista_id) VALUES(trim(p_client->>'nome'),NULLIF(p_client->>'telefone',''),CASE WHEN public.staff_admin() THEN NULLIF(p_client->>'projetista_id','')::UUID ELSE public.current_staff_id() END) RETURNING id INTO cid;
  INSERT INTO public.projetos(cliente_id,projetista_id,nome,status,status_venda,data_inicio,prazo_termino,fonte,observacoes,rt_arquiteto)
  VALUES(cid,NULL,NULL,'PRONTO','EM_NEGOCIACAO',(p_project->>'data_inicio')::DATE,(p_project->>'prazo_termino')::DATE,p_project->>'fonte',p_project->>'observacoes',NULLIF(p_project->>'rt_arquiteto','')::NUMERIC);
  RETURN jsonb_build_object('id',cid,'nome',trim(p_client->>'nome'));
END $$;
CREATE OR REPLACE FUNCTION public.assign_project(p_project_id UUID,p_designer_id UUID,p_deadline DATE) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ BEGIN
  IF NOT public.staff_admin() THEN RAISE EXCEPTION 'Somente o administrador pode distribuir projetos.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_designer_id AND role='PROJETISTA' AND status='ATIVO') THEN RAISE EXCEPTION 'Projetista não está ativo.'; END IF;
  UPDATE public.projetos SET projetista_id=p_designer_id,prazo_termino=p_deadline,status='EM_EXECUCAO',estagio_andamento='Briefing e levantamento' WHERE id=p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  -- Client ownership is not overwritten: separate environments may have different designers.
END $$;
REVOKE ALL ON FUNCTION public.create_client_with_project(JSONB,JSONB),public.assign_project(UUID,UUID,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_with_project(JSONB,JSONB),public.assign_project(UUID,UUID,DATE) TO authenticated;

-- Validate official agenda changes (including approvals) under a single transaction lock.
CREATE OR REPLACE FUNCTION public.validate_store_agenda() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  PERFORM pg_advisory_xact_lock(1731,1);
  IF NEW.data_fim <= NEW.data_inicio THEN RAISE EXCEPTION 'Horário final precisa ser posterior ao inicial.'; END IF;
  IF auth.role()='authenticated' AND NOT public.staff_admin() AND TG_OP='UPDATE' AND
    (NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_fim IS DISTINCT FROM OLD.data_fim OR NEW.criado_por IS DISTINCT FROM OLD.criado_por OR NEW.tipo IS DISTINCT FROM OLD.tipo) THEN
    RAISE EXCEPTION 'Solicite alteração ao administrador.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.agendamentos a WHERE a.id<>NEW.id AND
    tstzrange(a.data_inicio,a.data_fim,'[)') && tstzrange(NEW.data_inicio,NEW.data_fim,'[)') AND
    (a.tipo='BLOQUEIO' OR NEW.tipo='BLOQUEIO' OR (a.tipo='REUNIAO' AND NEW.tipo='REUNIAO'))) THEN
    RAISE EXCEPTION 'Horário indisponível: reunião ou bloqueio da loja.' USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_store_agenda_trigger ON public.agendamentos;
CREATE TRIGGER validate_store_agenda_trigger BEFORE INSERT OR UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.validate_store_agenda();

-- A single commission per project: do not silently discard duplicate historic rows.
CREATE UNIQUE INDEX IF NOT EXISTS comissoes_projeto_unique ON public.comissoes(projeto_id);
CREATE OR REPLACE FUNCTION public.validate_sale_finance() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$ DECLARE cents BIGINT; n INTEGER; BEGIN
  IF NEW.status_venda='VENDEU' THEN
    IF NEW.valor_venda IS NULL OR NEW.valor_venda<=0 OR COALESCE(NEW.valor_entrada,0)<0 OR COALESCE(NEW.valor_entrada,0)>NEW.valor_venda
      OR COALESCE(NEW.percentual_comissao,0)<0 OR COALESCE(NEW.percentual_comissao,0)>100 THEN RAISE EXCEPTION 'Valores de venda inválidos.'; END IF;
    n:=COALESCE(NEW.numero_parcelas,0); cents:=round((NEW.valor_venda-COALESCE(NEW.valor_entrada,0))*100);
    IF n<0 OR n>120 OR (n=0 AND cents<>0) THEN RAISE EXCEPTION 'Parcelamento inválido.'; END IF;
    NEW.valor_parcela:=CASE WHEN n>0 THEN (cents/n)::NUMERIC/100 ELSE 0 END;
    SELECT COALESCE(jsonb_agg(((cents/n)+CASE WHEN i<=cents%n THEN 1 ELSE 0 END)::NUMERIC/100 ORDER BY i),'[]'::JSONB)
      INTO NEW.parcelas FROM generate_series(1,n) i;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_sale_finance_trigger ON public.projetos;
CREATE TRIGGER validate_sale_finance_trigger BEFORE INSERT OR UPDATE OF status_venda,valor_venda,valor_entrada,percentual_comissao,numero_parcelas ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.validate_sale_finance();
CREATE OR REPLACE FUNCTION public.sync_sale_commission() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
  IF NEW.status_venda='VENDEU' AND NEW.projetista_id IS NOT NULL THEN
    INSERT INTO public.comissoes(projeto_id,projetista_id,percentual,valor_calculado,mes_referencia)
      VALUES(NEW.id,NEW.projetista_id,COALESCE(NEW.percentual_comissao,0),round(NEW.valor_venda*COALESCE(NEW.percentual_comissao,0)/100,2),(now() AT TIME ZONE 'America/Sao_Paulo')::DATE)
      ON CONFLICT(projeto_id) DO UPDATE SET projetista_id=excluded.projetista_id,percentual=excluded.percentual,valor_calculado=excluded.valor_calculado;
  ELSE DELETE FROM public.comissoes WHERE projeto_id=NEW.id; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_sale_commission_trigger ON public.projetos;
CREATE TRIGGER sync_sale_commission_trigger AFTER INSERT OR UPDATE OF status_venda,valor_venda,percentual_comissao,projetista_id ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.sync_sale_commission();

-- Secure Storage uses project membership and a separate public avatar bucket.
INSERT INTO storage.buckets(id,name,public) VALUES('avatars','avatars',true) ON CONFLICT(id) DO NOTHING;
UPDATE storage.buckets SET public=false WHERE id IN ('projetos_arquivos','message-attachments');
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND (qual LIKE '%projetos_arquivos%' OR with_check LIKE '%projetos_arquivos%' OR qual LIKE '%message-attachments%' OR with_check LIKE '%message-attachments%')
  LOOP EXECUTE format('DROP POLICY %I ON storage.objects',r.policyname); END LOOP;
END $$;
CREATE POLICY project_files_read ON storage.objects FOR SELECT TO authenticated USING(public.staff_active() AND bucket_id='projetos_arquivos' AND EXISTS(SELECT 1 FROM public.projetos p WHERE p.id::TEXT=(storage.foldername(name))[1]));
CREATE POLICY project_files_write ON storage.objects FOR INSERT TO authenticated WITH CHECK(public.staff_active() AND bucket_id='projetos_arquivos' AND EXISTS(SELECT 1 FROM public.projetos p WHERE p.id::TEXT=(storage.foldername(name))[1]));
CREATE POLICY project_files_delete ON storage.objects FOR DELETE TO authenticated USING(public.staff_active() AND bucket_id='projetos_arquivos' AND EXISTS(SELECT 1 FROM public.projetos p WHERE p.id::TEXT=(storage.foldername(name))[1]));
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING(bucket_id='avatars');
CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(public.staff_active() AND bucket_id='avatars' AND (storage.foldername(name))[1]=public.current_staff_id()::TEXT);
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated USING(public.staff_active() AND bucket_id='avatars' AND (storage.foldername(name))[1]=public.current_staff_id()::TEXT);
CREATE POLICY attachments_read ON storage.objects FOR SELECT TO authenticated USING(public.staff_active() AND bucket_id='message-attachments');
CREATE POLICY attachments_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(public.staff_active() AND bucket_id='message-attachments' AND (storage.foldername(name))[1]=public.current_staff_id()::TEXT);
CREATE POLICY attachments_delete ON storage.objects FOR DELETE TO authenticated USING(public.staff_active() AND bucket_id='message-attachments' AND (storage.foldername(name))[1]=public.current_staff_id()::TEXT);
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.import_client_spreadsheet(
  p_rows JSONB,
  p_importing_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_nome TEXT;
  v_email TEXT;
  v_telefone TEXT;
  v_endereco TEXT;
  v_client_id UUID;
  v_created_at TIMESTAMPTZ;
  v_data_inicio DATE;
  v_prazo_termino DATE;
  v_valor_venda NUMERIC;
  v_inserted_clients INTEGER := 0;
  v_inserted_projects INTEGER := 0;
  v_skipped_duplicates INTEGER := 0;
  v_user_role TEXT;
BEGIN
  IF NOT public.staff_active() OR p_importing_user_id IS DISTINCT FROM public.current_staff_id() THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'A importação precisa receber uma lista de clientes.';
  END IF;

  IF jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'A planilha deve conter entre 1 e 2000 clientes válidos.';
  END IF;

  SELECT role::TEXT INTO v_user_role
  FROM public.users
  WHERE id = p_importing_user_id
    AND status = 'ATIVO';

  IF v_user_role IS NULL OR v_user_role NOT IN ('PROJETISTA', 'ADMIN') THEN
    RAISE EXCEPTION 'Usuário não autorizado a importar carteira de clientes.';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_nome := NULLIF(BTRIM(v_row ->> 'nome'), '');
    v_email := NULLIF(LOWER(BTRIM(v_row ->> 'email')), '');
    v_telefone := NULLIF(BTRIM(v_row ->> 'telefone'), '');
    v_endereco := NULLIF(BTRIM(v_row ->> 'endereco'), '');

    IF v_nome IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE (v_user_role = 'ADMIN' OR c.projetista_id = p_importing_user_id)
        AND (
          (v_email IS NOT NULL AND LOWER(BTRIM(c.email)) = v_email)
          OR (
            v_telefone IS NOT NULL
            AND LENGTH(REGEXP_REPLACE(v_telefone, '\D', '', 'g')) >= 8
            AND REGEXP_REPLACE(COALESCE(c.telefone, ''), '\D', '', 'g') = REGEXP_REPLACE(v_telefone, '\D', '', 'g')
          )
        )
    ) THEN
      v_skipped_duplicates := v_skipped_duplicates + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_created_at := COALESCE(NULLIF(v_row ->> 'created_at', '')::TIMESTAMPTZ, NOW());
    EXCEPTION WHEN OTHERS THEN
      v_created_at := NOW();
    END;

    v_client_id := gen_random_uuid();

    INSERT INTO public.clientes (
      id,
      nome,
      telefone,
      email,
      endereco,
      created_at,
      projetista_id
    ) VALUES (
      v_client_id,
      v_nome,
      v_telefone,
      v_email,
      v_endereco,
      v_created_at,
      CASE WHEN v_user_role = 'ADMIN' THEN NULL ELSE p_importing_user_id END
    );

    v_inserted_clients := v_inserted_clients + 1;

    IF COALESCE((v_row ->> 'has_project')::BOOLEAN, FALSE) THEN
      BEGIN
        v_data_inicio := COALESCE(NULLIF(v_row ->> 'data_inicio', '')::DATE, CURRENT_DATE);
      EXCEPTION WHEN OTHERS THEN
        v_data_inicio := CURRENT_DATE;
      END;

      BEGIN
        v_prazo_termino := COALESCE(NULLIF(v_row ->> 'prazo_termino', '')::DATE, v_data_inicio);
      EXCEPTION WHEN OTHERS THEN
        v_prazo_termino := v_data_inicio;
      END;

      BEGIN
        v_valor_venda := NULLIF(v_row ->> 'valor_venda', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_valor_venda := NULL;
      END;

      INSERT INTO public.projetos (
        cliente_id,
        projetista_id,
        nome,
        status,
        status_venda,
        data_inicio,
        prazo_termino,
        valor_venda,
        fonte,
        nome_arquiteto,
        observacoes
      ) VALUES (
        v_client_id,
        CASE WHEN v_user_role = 'ADMIN' THEN NULL ELSE p_importing_user_id END,
        NULLIF(BTRIM(v_row ->> 'nome_projeto'), ''),
        (CASE v_row ->> 'status'
          WHEN 'EM_EXECUCAO' THEN 'EM_EXECUCAO'
          WHEN 'PAUSADO' THEN 'PAUSADO'
          WHEN 'ATRASADO' THEN 'ATRASADO'
          WHEN 'FINALIZADO' THEN 'FINALIZADO'
          WHEN 'EM_ACOMPANHAMENTO' THEN 'EM_ACOMPANHAMENTO'
          ELSE 'PRONTO'
        END)::public.project_status,
        (CASE v_row ->> 'status_venda'
          WHEN 'VENDEU' THEN 'VENDEU'
          WHEN 'NAO_VENDEU' THEN 'NAO_VENDEU'
          ELSE 'EM_NEGOCIACAO'
        END)::public.sale_status,
        v_data_inicio,
        v_prazo_termino,
        v_valor_venda,
        CASE v_row ->> 'fonte'
          WHEN 'ARQUITETO' THEN 'ARQUITETO'
          WHEN 'INDICACAO' THEN 'INDICACAO'
          WHEN 'VENDA_DIRETA' THEN 'VENDA_DIRETA'
          ELSE NULL
        END,
        NULLIF(BTRIM(v_row ->> 'nome_arquiteto'), ''),
        NULLIF(BTRIM(v_row ->> 'observacoes'), '')
      );

      v_inserted_projects := v_inserted_projects + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted_clients', v_inserted_clients,
    'inserted_projects', v_inserted_projects,
    'skipped_duplicates', v_skipped_duplicates
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_client_spreadsheet(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_client_spreadsheet(JSONB, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

REVOKE ALL ON FUNCTION public.import_client_spreadsheet(JSONB,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_client_spreadsheet(JSONB,UUID) TO authenticated;

GRANT SELECT,INSERT,UPDATE,DELETE ON public.clientes,public.projetos,public.agendamentos,public.comissoes,public.anotacoes_projeto,public.orcamento_workspace TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_project_assignment() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  IF auth.role()='authenticated' AND NOT public.staff_admin() AND (NEW.projetista_id IS DISTINCT FROM OLD.projetista_id OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id) THEN
    RAISE EXCEPTION 'Somente o administrador pode transferir projetos.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_project_assignment_trigger BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.protect_project_assignment();
