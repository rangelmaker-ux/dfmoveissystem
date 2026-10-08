ALTER TABLE public.projetos
  ADD COLUMN aguardando_cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN prazo_cliente date,
  ADD COLUMN aguardando_cliente_desde timestamptz,
  ADD COLUMN finalizado_em timestamptz;

CREATE FUNCTION public.validate_client_wait() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status_venda <> 'EM_NEGOCIACAO' OR NEW.status = 'FINALIZADO' THEN
    NEW.aguardando_cliente := false;
    NEW.prazo_cliente := NULL;
  END IF;
  IF NEW.aguardando_cliente THEN
    IF NEW.valor_venda IS NULL OR NEW.valor_venda <= 0
      OR coalesce(NEW.percentual_comissao,0) NOT BETWEEN 0 AND 100
      OR coalesce(NEW.rt_arquiteto,0) NOT BETWEEN 0 AND 100
      OR coalesce(NEW.valor_entrada,0) NOT BETWEEN 0 AND NEW.valor_venda
      OR coalesce(NEW.numero_parcelas,0) NOT BETWEEN 0 AND 120
      OR (coalesce(NEW.numero_parcelas,0)=0 AND NEW.valor_venda<>coalesce(NEW.valor_entrada,0)) THEN
      RAISE EXCEPTION 'Dados financeiros inválidos para aguardar cliente.';
    END IF;
    NEW.status := 'EM_ACOMPANHAMENTO';
    NEW.aguardando_cliente_desde := coalesce(NEW.aguardando_cliente_desde,now());
  END IF;
  IF NEW.status='FINALIZADO' THEN
    IF TG_OP='INSERT' THEN NEW.finalizado_em := coalesce(NEW.finalizado_em,now());
    ELSIF OLD.status<>'FINALIZADO' THEN NEW.finalizado_em := coalesce(NEW.finalizado_em,now());
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_client_wait() FROM PUBLIC;
CREATE TRIGGER validate_client_wait_trigger BEFORE INSERT OR UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_wait();

ALTER TABLE public.projetos ADD CONSTRAINT client_wait_consistent CHECK (
  NOT aguardando_cliente OR (status_venda='EM_NEGOCIACAO' AND status='EM_ACOMPANHAMENTO')
);
COMMENT ON COLUMN public.projetos.prazo_cliente IS 'Data para retomar com o cliente; NULL indica prazo indeterminado. Não é o prazo de execução do projeto.';
