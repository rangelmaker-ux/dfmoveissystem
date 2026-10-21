-- The Arauco Chess pattern exported by Promob is "Gris". The imported
-- spreadsheet catalog incorrectly stored that one pattern as "Íris".
update public.orcamento_catalog as c
set catalog = jsonb_set(
      c.catalog,
      '{Arauco,lines}',
      (
        select jsonb_agg(
          case
            when line ->> 'id' = 'xlsx-2025-arauco-9' then
              jsonb_set(
                line,
                '{colors}',
                (
                  select jsonb_agg(
                    case
                      when color #>> '{}' = 'Íris' then to_jsonb('Gris'::text)
                      else color
                    end
                    order by color_index
                  )
                  from jsonb_array_elements(line -> 'colors') with ordinality as colors(color, color_index)
                )
              )
            else line
          end
          order by line_index
        )
        from jsonb_array_elements(c.catalog #> '{Arauco,lines}') with ordinality as lines(line, line_index)
      )
    ),
    revision = c.revision + 1,
    updated_at = now()
where c.id = 1
  and exists (
    select 1
    from jsonb_array_elements(c.catalog #> '{Arauco,lines}') as line,
         jsonb_array_elements_text(line -> 'colors') as color
    where line ->> 'id' = 'xlsx-2025-arauco-9'
      and color = 'Íris'
  );

notify pgrst, 'reload schema';
