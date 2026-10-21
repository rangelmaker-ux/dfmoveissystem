-- Every edge band roll has the same shop price and length. Promob exports
-- consumption in linear metres, so the application derives R$ 10.00/m.
update public.orcamento_catalog as c
set materials = coalesce((
      select jsonb_agg(
        case
          when upper(coalesce(material ->> 'category', '')) = 'FITA' then
            material
            || jsonb_build_object(
              'unit', 'UN',
              'unit_price', 200,
              'fita_metros', 20
            )
            || case
                 when material ->> 'id' = 'mat-7' then
                   jsonb_build_object(
                     'code', 'FITA-PADRAO-20M',
                     'subcodes', '[]'::jsonb,
                     'description', 'Fita de Borda — rolo padrão de 20m'
                   )
                 else '{}'::jsonb
               end
          else material
        end
        order by material_index
      )
      from jsonb_array_elements(coalesce(c.materials, '[]'::jsonb)) with ordinality as entries(material, material_index)
    ), c.materials, '[]'::jsonb),
    revision = c.revision + 1,
    updated_at = now()
where c.id = 1;

notify pgrst, 'reload schema';
