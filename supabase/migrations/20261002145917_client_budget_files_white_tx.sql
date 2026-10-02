-- Read access follows the client's responsible designer; editing stays owner/admin only.
CREATE POLICY budget_client_responsible_read ON public.orcamento_budgets
FOR SELECT TO authenticated USING (
  public.staff_active() AND (
    EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = orcamento_budgets.client_id AND c.projetista_id = public.current_staff_id())
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.cliente_id = orcamento_budgets.client_id AND p.projetista_id = public.current_staff_id())
  )
);
CREATE INDEX IF NOT EXISTS orcamento_budgets_client_updated_idx ON public.orcamento_budgets(client_id, updated_at DESC);

-- Branco TX is an alias of Arauco Branco, using the same thickness and editable source price.
-- Resolve the catalog line semantically, without hardcoded generated IDs or prices.
DO $$
DECLARE white_line JSONB; next_catalog JSONB; next_materials JSONB; current_row public.orcamento_catalog%ROWTYPE;
BEGIN
  SELECT * INTO current_row FROM public.orcamento_catalog WHERE id=1 FOR UPDATE;
  SELECT line INTO white_line FROM jsonb_array_elements(COALESCE(current_row.catalog->'Arauco'->'lines','[]'::JSONB)) line
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(line->'colors','[]'::JSONB)) color WHERE upper(trim(color))='BRANCO');
  IF white_line IS NULL THEN RETURN; END IF;
  white_line := jsonb_set(white_line,'{aliases}',COALESCE(white_line->'aliases','[]'::JSONB) ||
    CASE WHEN COALESCE(white_line->'aliases','[]'::JSONB) ? 'Branco TX' THEN '[]'::JSONB ELSE '["Branco TX"]'::JSONB END);
  white_line := jsonb_set(white_line,'{colors}',COALESCE(white_line->'colors','[]'::JSONB) ||
    CASE WHEN COALESCE(white_line->'colors','[]'::JSONB) ? 'Branco TX' THEN '[]'::JSONB ELSE '["Branco TX"]'::JSONB END);
  next_catalog := jsonb_set(current_row.catalog,'{Arauco,lines}',(
    SELECT jsonb_agg(CASE WHEN line->>'id'=white_line->>'id' THEN white_line ELSE line END ORDER BY ord)
    FROM jsonb_array_elements(current_row.catalog->'Arauco'->'lines') WITH ORDINALITY a(line,ord)));
  SELECT jsonb_agg(CASE WHEN m->>'code' IN ('MDF-BRANCO-06','MDF-BRANCO-15','MDF-BRANCO-18') THEN
    m || jsonb_build_object('catalog_brand','Arauco','catalog_line_id',white_line->>'id',
      'catalog_thickness',CASE m->>'code' WHEN 'MDF-BRANCO-06' THEN '6mm' WHEN 'MDF-BRANCO-15' THEN '15mm' ELSE '18mm' END,
      'unit_price',round(COALESCE((white_line->'prices'->>CASE m->>'code' WHEN 'MDF-BRANCO-06' THEN '6mm' WHEN 'MDF-BRANCO-15' THEN '15mm' ELSE '18mm' END)::NUMERIC,0)*1.30 /
        NULLIF((white_line->>'width')::NUMERIC*(white_line->>'height')::NUMERIC,0),2),
      'notes','Branco TX usa o mesmo preço do Branco Arauco na mesma espessura, conforme confirmação de Rangel. Preço vinculado ao catálogo, com 30% de perdas no m².')
    ELSE m END ORDER BY ord) INTO next_materials
  FROM jsonb_array_elements(current_row.materials) WITH ORDINALITY a(m,ord);
  IF next_catalog IS DISTINCT FROM current_row.catalog OR next_materials IS DISTINCT FROM current_row.materials THEN
    UPDATE public.orcamento_catalog SET catalog=next_catalog,materials=next_materials,revision=revision+1,updated_at=now() WHERE id=1;
  END IF;
END $$;
NOTIFY pgrst,'reload schema';
