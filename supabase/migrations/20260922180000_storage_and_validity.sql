-- Migração para suporte a:
-- 1. Políticas de Storage públicas para 'projetos_arquivos' e 'message-attachments'
-- 2. Prazo de término flexível (Indeterminado / NULL)
-- 3. Workflow de alteração de horário na Agenda com aprovação do Administrador
-- 4. Permissão para Administradores importarem planilhas de clientes

-- 1. Garantir Buckets e Políticas de Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('projetos_arquivos', 'projetos_arquivos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas para projetos_arquivos (compatível com autenticação de sessão pública da loja)
DROP POLICY IF EXISTS "Arquivos acessíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar seus arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura projetos_arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload projetos_arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update projetos_arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delecao projetos_arquivos" ON storage.objects;

CREATE POLICY "Permitir leitura projetos_arquivos" 
ON storage.objects FOR SELECT USING (bucket_id = 'projetos_arquivos');

CREATE POLICY "Permitir upload projetos_arquivos" 
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'projetos_arquivos');

CREATE POLICY "Permitir update projetos_arquivos" 
ON storage.objects FOR UPDATE USING (bucket_id = 'projetos_arquivos') WITH CHECK (bucket_id = 'projetos_arquivos');

CREATE POLICY "Permitir delecao projetos_arquivos" 
ON storage.objects FOR DELETE USING (bucket_id = 'projetos_arquivos');

-- Políticas para message-attachments
DROP POLICY IF EXISTS "Permitir leitura message_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload message_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delecao message_attachments" ON storage.objects;

CREATE POLICY "Permitir leitura message_attachments" 
ON storage.objects FOR SELECT USING (bucket_id = 'message-attachments');

CREATE POLICY "Permitir upload message_attachments" 
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'message-attachments');

CREATE POLICY "Permitir delecao message_attachments" 
ON storage.objects FOR DELETE USING (bucket_id = 'message-attachments');

-- 2. Flexibilizar prazo de término na tabela projetos
ALTER TABLE public.projetos ALTER COLUMN prazo_termino DROP NOT NULL;

-- 3. Campos para Solicitação de Alteração de Horário na Agenda
ALTER TABLE public.agendamentos 
  ADD COLUMN IF NOT EXISTS data_sugerida_inicio TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS data_sugerida_fim TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS motivo_alteracao TEXT;

-- 4. Atualizar import_client_spreadsheet para aceitar ADMIN
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
