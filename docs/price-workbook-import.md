# Importação da tabela de preços 2025

Fonte: PREÇO DE CHAPAS 2025.xlsx, recebido em 02/10/2026. As nove abas foram lidas, incluindo valores calculados, fórmulas e células mescladas. O arquivo original não foi alterado.

O catálogo compartilhado no PostgreSQL é a autoridade dos preços. Foram preparados 198 preços positivos de chapa por espessura e 28 preços positivos de acessórios. Os 400 registros identificados de linhas/cores da planilha foram preservados, junto com as linhas já existentes sem correspondência inequívoca, totalizando 409 entradas de catálogo de chapas. Os 37 acessórios da planilha correspondem a produtos existentes; nove não têm preço informado. Não há tabela de fitas no arquivo.

Marca Bernek foi normalizada para Berneck. As correspondências de linhas foram feitas explicitamente, mantendo as cores conhecidas somente quando a família/acabamento corresponde. Linhas sem correspondência permanecem com preços pendentes. Não se aplica preço de uma cor a todas as cores de uma linha quando a fonte apresenta apenas uma célula específica: Sudati Carvalho Novara tem os quatro preços existentes, inclusive 30 mm; as demais cores da aba ficam pendentes. Eucatex apresenta nomes sem preços. Fórmica AD 307 Bronze tem preço de 15 mm e dimensões 3,08 x 1,25 m; o valor 199 na coluna de dimensão da L 608 Brancoline não foi interpretado como preço.

O m² é calculado por preço da chapa x 1,30 / área real, arredondado a centavos. As células positivas calculadas da fonte foram confrontadas com essa fórmula. A margem comercial é aplicada depois; as perdas não são acrescentadas novamente na importação. Greenplac Essenziale 18 mm passa de 457,63 para 489,63 por chapa conforme a fonte.

Os códigos do XML Branco 6/15/18 foram vinculados à entrada BRANCO da tabela Arauco. São vínculos editáveis de catálogo, sem duplicar a autoridade do preço. CCTT500 corresponde à corrediça telescópica 500 mm; PIST corresponde ao pistão a gás genérico. Referências duplicadas pendentes dessas duas peças foram consolidadas, preservando seus códigos como aliases. Não há preço atribuído a conjuntos de dobradiça sem indicação de amortecedor nem a fitas de 1 mm ausentes da planilha.

A edição das chapas aceita 6/15/18/25/30 mm e continua salvando no catálogo compartilhado. Alterar o preço da linha recalcula seus aliases do XML; apagar o preço mantém a pendência. Uma alteração explícita do preço no produto geral desvincula o valor da linha para respeitar a edição manual. Linhas importadas, preços ausentes, cores, aliases e origem sobrevivem à carga e ao salvamento, sem restaurar preços iniciais de demonstração.

Verificação: 77 testes, TypeScript, lint sem erros (seis avisos anteriores), build de produção. Todos os 198 preços foram conferidos pelo matcher com a área real. O XML original mantém 372 componentes e 17 grupos; duas referências antes sem preço passam a ser encontradas, restando 12 códigos distintos pendentes. O total é parcial enquanto essas pendências existirem.
