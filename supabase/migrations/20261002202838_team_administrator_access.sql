CREATE OR REPLACE FUNCTION public.set_team_access(p_member_id UUID,p_role TEXT,p_approve BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT public.staff_admin() THEN RAISE EXCEPTION 'Somente o administrador pode alterar permissões.' USING ERRCODE='42501'; END IF;
  IF p_role IS NULL OR p_role NOT IN ('ADMIN','PROJETISTA') OR p_approve IS NULL THEN RAISE EXCEPTION 'Permissão inválida.'; END IF;
  PERFORM pg_advisory_xact_lock(1731,2);
  IF p_member_id=public.current_staff_id() THEN RAISE EXCEPTION 'Peça a outro administrador para alterar suas permissões.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_member_id) THEN RAISE EXCEPTION 'Membro não encontrado.'; END IF;
  UPDATE public.users SET role=p_role::public.user_role,status=CASE WHEN p_approve THEN 'ATIVO' ELSE status END WHERE id=p_member_id;
END $$;
REVOKE ALL ON FUNCTION public.set_team_access(UUID,TEXT,BOOLEAN) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_team_access(UUID,TEXT,BOOLEAN) TO authenticated;
CREATE OR REPLACE FUNCTION public.preserve_store_administrator() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
  PERFORM pg_advisory_xact_lock(1731,2);
  IF OLD.role='ADMIN' AND OLD.status='ATIVO' AND (NEW.role<>'ADMIN' OR NEW.status<>'ATIVO') AND
    NOT EXISTS(SELECT 1 FROM public.users WHERE id<>OLD.id AND role='ADMIN' AND status='ATIVO') THEN
    RAISE EXCEPTION 'Mantenha pelo menos um administrador ativo na empresa.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preserve_store_administrator() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_store_administrator_trigger BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.preserve_store_administrator();
