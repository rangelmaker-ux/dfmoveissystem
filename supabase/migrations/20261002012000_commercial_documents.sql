CREATE TABLE public.commercial_documents(
  id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES public.users(id),client_id UUID NOT NULL REFERENCES public.clientes(id),
  data JSONB NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX commercial_documents_client ON public.commercial_documents(client_id);
ALTER TABLE public.commercial_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY commercial_owner ON public.commercial_documents FOR ALL TO authenticated USING(public.staff_active() AND (user_id=public.current_staff_id() OR public.staff_admin())) WITH CHECK(public.staff_active() AND (user_id=public.current_staff_id() OR public.staff_admin()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.commercial_documents TO authenticated;
CREATE FUNCTION public.save_commercial_document(p_id UUID,p_client_id UUID,p_data JSONB,p_revision INTEGER) RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public
AS $$ DECLARE version INTEGER; env JSONB; cost JSONB; subtotal NUMERIC:=0; total NUMERIC; entry NUMERIC; discount NUMERIC; installments INTEGER; BEGIN
  IF NOT public.staff_active() OR p_data->>'type' IS NULL OR p_data->>'type' NOT IN ('proposal','contract') OR p_data->>'stage' IS NULL OR p_data->>'stage' NOT IN ('draft','closed') OR jsonb_typeof(p_data->'environments') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Documento inválido.'; END IF;
  IF jsonb_array_length(p_data->'environments')<1 THEN RAISE EXCEPTION 'Selecione pelo menos um ambiente.'; END IF;
  FOR env IN SELECT value FROM jsonb_array_elements(p_data->'environments') LOOP
    IF jsonb_typeof(env->'saleValue') IS DISTINCT FROM 'number' OR (env->>'saleValue')::NUMERIC<0 OR jsonb_typeof(env->'extraCosts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ambiente inválido.'; END IF;
    subtotal:=subtotal+round((env->>'saleValue')::NUMERIC*100);
    FOR cost IN SELECT value FROM jsonb_array_elements(env->'extraCosts') LOOP
      IF jsonb_typeof(cost->'cost') IS DISTINCT FROM 'number' OR (cost->>'cost')::NUMERIC<0 THEN RAISE EXCEPTION 'Custo inválido.'; END IF;
    END LOOP;
  END LOOP;
  IF jsonb_typeof(p_data->'discount') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'entry') IS DISTINCT FROM 'number' OR jsonb_typeof(p_data->'installments') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Pagamento inválido.'; END IF;
  discount:=(p_data->>'discount')::NUMERIC; entry:=(p_data->>'entry')::NUMERIC; installments:=(p_data->>'installments')::INTEGER;
  total:=(subtotal-round(subtotal*discount/100))/100;
  IF discount<0 OR discount>100 OR entry<0 OR entry>total OR installments<0 OR installments>120 OR (p_data->>'installments')::NUMERIC<>installments OR (installments=0 AND entry<>total) THEN RAISE EXCEPTION 'Pagamento inválido.'; END IF;
  IF p_data->>'type'='contract' AND NOT EXISTS(SELECT 1 FROM public.commercial_documents WHERE id=(p_data->>'originProposalId')::UUID AND client_id=p_client_id AND data->>'type'='proposal' AND data->>'stage'='closed') THEN RAISE EXCEPTION 'Feche a proposta antes de criar o contrato.'; END IF;
  IF p_revision IS NULL THEN
    INSERT INTO public.commercial_documents(id,user_id,client_id,data,revision) VALUES(p_id,public.current_staff_id(),p_client_id,p_data,1) RETURNING revision INTO version;
  ELSE
    UPDATE public.commercial_documents SET data=p_data,revision=revision+1,updated_at=now() WHERE id=p_id AND client_id=p_client_id AND revision=p_revision RETURNING revision INTO version;
    IF version IS NULL THEN RAISE EXCEPTION 'Documento alterado em outra sessão. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
  END IF;
  RETURN version;
END $$;
REVOKE ALL ON FUNCTION public.save_commercial_document(UUID,UUID,JSONB,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_commercial_document(UUID,UUID,JSONB,INTEGER) TO authenticated;
NOTIFY pgrst,'reload schema';
