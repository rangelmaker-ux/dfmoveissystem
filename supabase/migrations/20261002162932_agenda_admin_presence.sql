-- Administrator availability is distinct from the shared meeting room.
-- Existing appointments retain their previous conservative availability rule.
ALTER TABLE public.agendamentos
  ADD COLUMN necessita_administrador BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN necessita_administrador_sugerido BOOLEAN;
CREATE OR REPLACE FUNCTION public.validate_store_agenda() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  PERFORM pg_advisory_xact_lock(1731,1);
  IF NEW.data_fim <= NEW.data_inicio THEN RAISE EXCEPTION 'Horário final precisa ser posterior ao inicial.'; END IF;
  IF current_setting('request.jwt.claim.role',true)='authenticated' AND NOT public.staff_admin() AND TG_OP='UPDATE' AND
    (NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_fim IS DISTINCT FROM OLD.data_fim OR NEW.criado_por IS DISTINCT FROM OLD.criado_por OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.necessita_administrador IS DISTINCT FROM OLD.necessita_administrador) THEN
    RAISE EXCEPTION 'Solicite alteração ao administrador.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.agendamentos a WHERE a.id<>NEW.id AND
    tstzrange(a.data_inicio,a.data_fim,'[)') && tstzrange(NEW.data_inicio,NEW.data_fim,'[)') AND
    ((a.tipo='BLOQUEIO' AND (NEW.tipo='BLOQUEIO' OR NEW.necessita_administrador)) OR
     (NEW.tipo='BLOQUEIO' AND a.necessita_administrador))) THEN
    RAISE EXCEPTION 'A agenda está travada pelo administrador neste horário. Agende sem a presença dele ou escolha outro horário.' USING ERRCODE='23P01';
  END IF;
  IF NEW.tipo='REUNIAO' AND EXISTS(SELECT 1 FROM public.agendamentos a WHERE a.id<>NEW.id AND a.tipo='REUNIAO' AND
    tstzrange(a.data_inicio,a.data_fim,'[)') && tstzrange(NEW.data_inicio,NEW.data_fim,'[)')) THEN
    RAISE EXCEPTION 'Já existe um compromisso de reunião nesta data e horário. Escolha outro horário.' USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_store_agenda() FROM PUBLIC,anon,authenticated;
