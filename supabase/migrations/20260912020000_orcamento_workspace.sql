CREATE TABLE IF NOT EXISTS public.orcamento_workspace (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  saved_budgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  catalog JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_budget_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orcamento_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso ao workspace de orcamento" ON public.orcamento_workspace;
CREATE POLICY "Acesso ao workspace de orcamento"
ON public.orcamento_workspace FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND status = 'ATIVO'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND status = 'ATIVO'));

DROP TRIGGER IF EXISTS update_orcamento_workspace_updated_at ON public.orcamento_workspace;
CREATE TRIGGER update_orcamento_workspace_updated_at
BEFORE UPDATE ON public.orcamento_workspace
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
