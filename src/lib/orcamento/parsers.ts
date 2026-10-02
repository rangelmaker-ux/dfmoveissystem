import { PromobReportMetadata, ItemCategory } from './types';
import { isEletrodomestico, classifyPromobItem } from './calculator';

function checkIsAppliance(code?: string, description?: string, category?: string): boolean {
  try {
    if (typeof isEletrodomestico === 'function') {
      return isEletrodomestico(code, description, category);
    }
  } catch {
    // fallback if loaded where module imports are stripped
  }
  const text = `${code || ''} ${description || ''} ${category || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!text) return false;
  const furniture = (description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(armario|balcao|torre|nicho|painel|modulo)\b/.test(furniture)) return false;
  const keywords = [
    'forno', 'fogao', 'cooktop', 'coifa', 'depurador', 'geladeira',
    'refrigerador', 'freezer', 'microondas', 'micro-ondas', 'lava loucas',
    'lava-loucas', 'lava e seca', 'maquina de lavar', 'adega', 'cervejeira',
    'electrolux', 'brastemp', 'consul', 'eletrodomestico', 'eletros',
  ];
  return keywords.some(kw => text.includes(kw));
}

function safeClassifyPromobItem(item: {
  code?: string;
  description?: string;
  dimensions?: string;
  unit?: string;
  category?: string;
  is_parent_module?: boolean;
}): ItemCategory {
  try {
    if (typeof classifyPromobItem === 'function') {
      return classifyPromobItem(item);
    }
  } catch {
    // fallback if loaded where module imports are stripped
  }

  const desc = (item.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const ref = (item.code || '').toLowerCase().trim();
  const cat = (item.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const unit = (item.unit || '').toUpperCase();

  if (checkIsAppliance(item.code, item.description, item.category) || cat.includes('eletro')) {
    return 'INFORMATIONAL';
  }
  if (cat.includes('processo') || desc.includes('processo') || desc.includes('mao de obra') || ref.startsWith('proc_')) {
    return 'MANUFACTURING_PROCESS';
  }
  if (
    cat.includes('acessorio') || cat.includes('ferragem') || cat.includes('hettich') || cat.includes('wurth') ||
    ['dobradica', 'corredica', 'pistao', 'lift', 'puxador', 'cantoneira', 'parafuso'].some(k => desc.includes(k))
  ) {
    return 'ACCESSORY';
  }
  if (cat.includes('tamponamento') || cat.includes('moldura') || desc.includes('tamponamento') || desc.includes('moldura')) {
    return 'EXTERNAL_ITEM';
  }
  if (['caixa armario', 'caixa gaveta', 'balcao 1 div', 'balcao gav/pia'].some(k => desc.includes(k))) {
    return 'SUBMODULE';
  }
  if (unit === 'UN' && (['armario', 'balcao', 'torre', 'paneleiro', 'gaveteiro', 'nicho'].some(k => desc.includes(k)) || ref.startsWith('4.'))) {
    return 'MODULE';
  }
  return 'CUT_PART';
}

export interface ParsedItemRow {
  item_number?: number;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rep?: number;
  unit_quantity?: number;
  dimensions?: string;
  category?: string;
  external_model?: string;
  unit_cost?: number;
  table_price?: number;
  final_price?: number;
  is_parent_module?: boolean;
  has_children?: boolean;
  itemCategory?: ItemCategory;
  parentId?: string;
}

export function parseLocaleNumber(value: unknown, fallback = 0): number {
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return fallback;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Calcula área em m² a partir de dimensões em milímetros (mm).
 * Todas as medidas do Promob são expressas em MILÍMETROS.
 * Exemplo: 700mm x 580mm = 0,406 m²
 */
function areaFromDimensions(width: number, height: number, count: number): number {
  if (width <= 0 || height <= 0 || count <= 0) return count;
  const divisor = width > 20 || height > 20 ? 1_000_000 : 1;
  return Math.round(((width * height * count) / divisor + Number.EPSILON) * 10000) / 10000;
}

/**
 * Formata dimensões em milímetros para exibição amigável em centímetros (cm).
 * Exemplo: '700 x 700 x 580' mm -> '70 x 70 x 58 cm'
 * Exemplo: '670 x 15 x 580' mm -> '67 x 1,5 x 58 cm'
 */
export function formatDimensionsCm(dimensionsStr?: string): string {
  if (!dimensionsStr) return '';
  const clean = String(dimensionsStr).trim();
  const replaced = clean.replace(/\b(\d+(?:[.,]\d+)?)\b/g, (match) => {
    const num = parseFloat(match.replace(',', '.'));
    if (isNaN(num)) return match;
    const inCm = num / 10;
    return Number.isInteger(inCm) ? inCm.toString() : inCm.toFixed(1).replace('.', ',');
  });
  return `${replaced} cm`;
}

/**
 * Analisador rigoroso de dimensões do Promob:
 * No Promob, TODAS as dimensões numéricas são expressas em MILÍMETROS (mm).
 *
 * 1. Para peças planas de corte MDF/MDP (ex: 670 x 15 x 580 ou 700 x 6 x 700):
 *    - A menor dimensão (<= 30mm) é a espessura da chapa (ex: 6mm, 15mm, 18mm, 25mm).
 *    - As outras duas dimensões são as faces de corte em milímetros.
 *    - Área da face (m²) = (face1_mm * face2_mm) / 1.000.000
 *
 * 2. Para módulos e caixarias 3D (ex: 700 x 700 x 580 ou 990 x 505 x 600):
 *    - Todas as 3 dimensões são > 30mm (Largura x Altura x Profundidade do móvel).
 *    - Trata-se de um móvel tridimensional (unidade 'UN'), e NÃO de uma chapa plana avulsa!
 */
export function parsePromobDimensions(
  rawDim?: string,
  w?: string | number,
  h?: string | number,
  d?: string | number,
  t?: string | number
): {
  dimensions: string;
  unitArea: number;
  isPlate: boolean;
  thickness: number | null;
  length_mm: number | null;
  width_mm: number | null;
  is3dModule: boolean;
} {
  let dimStr = String(rawDim || '').trim();
  if (!dimStr) {
    const parts = [w, h || t, d || t].filter(Boolean);
    if (parts.length >= 2) {
      dimStr = parts.join(' x ');
    }
  }
  if (!dimStr) {
    return {
      dimensions: '',
      unitArea: 0,
      isPlate: false,
      thickness: null,
      length_mm: null,
      width_mm: null,
      is3dModule: false,
    };
  }

  const nums = (dimStr.match(/[\d.,]+/g) || [])
    .map(n => parseLocaleNumber(n))
    .filter(n => n > 0);

  if (nums.length === 3) {
    const sorted = [...nums].sort((a, b) => a - b);
    const minDim = sorted[0];
    const midDim = sorted[1];
    const maxDim = sorted[2];

    // Se a menor dimensão for espessura típica de chapa (<= 30mm, ex: 6, 9, 15, 18, 25mm)
    // e as outras duas forem medidas de face de chapa (>= 60mm):
    if (minDim <= 30 && midDim >= 60 && maxDim >= 60) {
      const unitArea = Math.round(((midDim * maxDim) / 1_000_000 + Number.EPSILON) * 10000) / 10000;
      return {
        dimensions: dimStr,
        unitArea,
        isPlate: true,
        thickness: minDim,
        length_mm: maxDim,
        width_mm: midDim,
        is3dModule: false,
      };
    }

    // Se todas as 3 dimensões forem grandes (> 30mm), é um módulo tridimensional (ex: 700 x 700 x 580)
    return {
      dimensions: dimStr,
      unitArea: 0,
      isPlate: false,
      thickness: null,
      length_mm: maxDim,
      width_mm: midDim,
      is3dModule: true,
    };
  }

  if (nums.length === 2) {
    const [d1, d2] = [...nums].sort((a, b) => b - a);
    if (d1 >= 60 && d2 >= 60) {
      const unitArea = Math.round(((d1 * d2) / 1_000_000 + Number.EPSILON) * 10000) / 10000;
      return {
        dimensions: dimStr,
        unitArea,
        isPlate: true,
        thickness: null,
        length_mm: d1,
        width_mm: d2,
        is3dModule: false,
      };
    }
  }

  return {
    dimensions: dimStr,
    unitArea: 0,
    isPlate: false,
    thickness: null,
    length_mm: null,
    width_mm: null,
    is3dModule: false,
  };
}

function parseDimensionsString(rawDim?: string, w?: string, h?: string, d?: string, t?: string): { dimensions: string; unitArea: number; isPlate: boolean } {
  return parsePromobDimensions(rawDim, w, h, d, t);
}

function parseXmlAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = val.trim();
  }
  return attrs;
}

// Balance nested tags before reading an item's own fields. Descendant prices and
// REFERENCES belong to the child, never to the enclosing cabinet or cut piece.
function xmlItemBodies(xml: string): Map<number, { body: string; hasChildren: boolean }> {
  const result = new Map<number, { body: string; hasChildren: boolean }>();
  const stack: Array<{ start: number; name: string; chunks: string[]; cursor: number; hasChildren: boolean }> = [];
  const tags = /<\/?(ITEM|PECA|PART)\b[^>]*>/gi;
  let token: RegExpExecArray | null;
  while ((token = tags.exec(xml))) {
    const closing = token[0].startsWith('</');
    if (closing) {
      const node = stack.pop();
      if (!node || node.name !== token[1].toLowerCase()) throw new Error('XML inválido: item sem fechamento correspondente.');
      node.chunks.push(xml.slice(node.cursor, token.index));
      result.set(node.start, { body: node.chunks.join(''), hasChildren: node.hasChildren });
      if (stack.length) stack[stack.length - 1].cursor = tags.lastIndex;
    } else {
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.chunks.push(xml.slice(parent.cursor, token.index));
        parent.hasChildren = true;
        parent.cursor = tags.lastIndex;
      }
      if (/\/\s*>$/.test(token[0])) result.set(token.index, { body: '', hasChildren: false });
      else stack.push({ start: token.index, name: token[1].toLowerCase(), chunks: [], cursor: tags.lastIndex, hasChildren: false });
    }
  }
  if (stack.length) throw new Error('XML inválido: item sem fechamento.');
  return result;
}

// 1. Promob XML Parser (Supports Promob Plus / Start <ITEM>, <Item>, <PECA>, cut lists and client metadata)
export function parsePromobXML(
  xmlContent: string
): { items: ParsedItemRow[]; metadata: PromobReportMetadata } {
  const metadata: PromobReportMetadata = {};
  const items: ParsedItemRow[] = [];

  // Previne falhas com entidades HTML não declaradas
  const cleanXml = xmlContent.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-fA-F0-9]+);)/g, '&amp;');

  // Metadados do cliente e projeto no cabeçalho do XML
  const nameMatch = cleanXml.match(/<(?:NAME|NOME|Cliente|Client)[^>]*>([^<]+)<\//i);
  if (nameMatch) metadata.client_name = nameMatch[1].trim();
  const phoneMatch = cleanXml.match(/<(?:PHONE|TELEFONE|CELULAR|Celular)[^>]*>([^<]+)<\//i);
  if (phoneMatch) metadata.client_phone = phoneMatch[1].trim();
  const emailMatch = cleanXml.match(/<(?:EMAIL|E-MAIL|Email)[^>]*>([^<]+)<\//i);
  if (emailMatch) metadata.client_email = emailMatch[1].trim();
  const projMatch = cleanXml.match(/<(?:PROJECT|PROJETO|Projeto|AMBIENTE|Ambiente)[^>]*>([^<]+)<\//i);
  if (projMatch) metadata.project_name = projMatch[1].trim();

  const totTabMatch = cleanXml.match(/<(?:TOTAL_TABELA|TotalTabela|TOTAL_TABLE)[^>]*>([^<]+)<\//i);
  if (totTabMatch) metadata.total_tabela = parseLocaleNumber(totTabMatch[1]);
  const totFinMatch = cleanXml.match(/<(?:TOTAL_FINAL|TotalFinal|FINAL_TOTAL)[^>]*>([^<]+)<\//i);
  if (totFinMatch) metadata.total_final = parseLocaleNumber(totFinMatch[1]);

  // Extração precisa de tags de itens (<ITEM>, <PECA>, <PART>, <Item>, <Peca>, <Part>), incluindo subitens aninhados
  const tagStartRegex = /<(ITEM|PECA|PART|Item|Peca|Part)\b([^>]*?)(\/?)>/gi;
  const itemBodies = xmlItemBodies(cleanXml);
  let match;
  let itemCounter = 1;

  while ((match = tagStartRegex.exec(cleanXml)) !== null) {
    const attrs = parseXmlAttributes(match[2] || '');
    const own = itemBodies.get(match.index);
    const innerContent = own?.body || '';
    const references = innerContent.match(/<REFERENCES\b[^>]*>([\s\S]*?)<\/REFERENCES>/i)?.[1] || '';
    const referenceValue = (name: string): string => {
      const tag = references.match(new RegExp(`<${name}\\b([^>]*)>`, 'i'));
      return tag ? (parseXmlAttributes(tag[1]).reference || '') : '';
    };

    const getVal = (keys: string[]): string => {
      for (const k of keys) {
        const lower = k.toLowerCase();
        const compact = lower.replace(/[_\s-]/g, '');
        for (const [attrKey, attrVal] of Object.entries(attrs)) {
          if (attrKey === lower || attrKey.replace(/[_\s-]/g, '') === compact) {
            if (attrVal !== '') return attrVal;
          }
        }
        if (innerContent) {
          const pattern = k.replace(/_/g, '[_\\s-]?');
          const bodyRegex = new RegExp(`<(${pattern})[^>]*>([^<]+)<\\/\\1>`, 'i');
          const m = innerContent.match(bodyRegex);
          if (m && m[2].trim()) return m[2].trim();
        }
      }
      return '';
    };

    const code = getVal(['reference', 'code', 'referencia', 'codigo', 'id']);
    const description = getVal(['description', 'name', 'descricao', 'nome', 'desc']);
    if (!code && !description) continue;

    const category = getVal(['category', 'categoria', 'grupo', 'family']);
    const externalModel = getVal(['external_model', 'modelo_externo', 'model', 'modelo']) || referenceValue('MODEL');

    // Detecta se é módulo pai/móvel agrupador (ex: Armário, Balcão, Torre)
    // ATENÇÃO: Caixarias (Caixa Armário, Caixa Gaveta, Balcões) e Eletrodomésticos NUNCA são módulos agrupadores pais!
    const normDesc = description.toLowerCase();
    const isCaixa = normDesc.includes('caixa');
    const isAppliance = checkIsAppliance(code, description, category);
    const hasChildren = Boolean(own?.hasChildren);
    const is_parent_module = Boolean(
      !isCaixa && !isAppliance && (
        hasChildren ||
        (['armário', 'armario', 'balcão', 'balcao', 'torre'].some(k => normDesc.includes(k)))
      )
    );

    const rawRep = getVal(['repetition', 'repeticao', 'rep', 'quantidade_repeticao', 'qtd_pecas', 'quantidade_pecas']);
    const rawQty = getVal(['quantity', 'quantidade', 'qtd', 'qtdtotal', 'quant', 'quantidade_total', 'qtd_total']);
    const rawUnit = getVal(['unit', 'unidade', 'un']);
    const rawDim = getVal(['dimension', 'dimensions', 'textdimension', 'dimensao', 'dimensoes', 'dimensoes_formatada']);
    const w = getVal(['width', 'largura', 'comprimento', 'comp']);
    const h = getVal(['height', 'altura', 'alt']);
    const d = getVal(['depth', 'profundidade', 'prof']);
    const t = getVal(['thickness', 'espessura', 'esp']);

    const tablePrice = parseLocaleNumber(getVal(['table_price', 'preco_tabela', 'valor_tabela', 'price', 'preco', 'unit_price', 'custo', 'valortabela', 'precotabela', 'valortbl', 'precotbl', 'vlrtabela']));
    const finalPrice = parseLocaleNumber(getVal(['final_price', 'preco_final', 'valor_final', 'total_price', 'valor_total', 'vlrtotal', 'valortotal', 'precototal', 'preco_final']));

    const rep = rawRep
      ? Math.max(1, Math.round(parseLocaleNumber(rawRep, 1)))
      : 1;

    const dimInfo = parsePromobDimensions(rawDim, w, h, d, t);
    let unit = rawUnit.toUpperCase();

    const isHardware = ['dobradica', 'dobradiça', 'corredica', 'corrediça', 'puxador', 'pistao', 'pistão', 'parafuso', 'ponteira', 'suporte', 'cantoneira'].some(k => normDesc.includes(k));
    const isCutPiecePlate = !isHardware && !isCaixa && !is_parent_module && !isAppliance && (
      unit === 'M2' ||
      (dimInfo.isPlate && ['fundo', 'base', 'lateral', 'prateleira', 'travessa', 'sarrafo', 'tampo', 'porta', 'frente', 'divisoria'].some(k => normDesc.includes(k)))
    );

    const qtyMatch = rawQty.match(/^([\d.,]+)\s*([A-Za-z0-9]+)?/);
    const parsedQtyNum = qtyMatch ? parseLocaleNumber(qtyMatch[1], 0) : parseLocaleNumber(rawQty, 0);
    if (!unit && qtyMatch?.[2]) unit = qtyMatch[2].toUpperCase();

    let unit_quantity = 1;

    if (rawUnit && parsedQtyNum > 0) {
      // An explicit export unit/consumption is authoritative (including M < 1).
      unit_quantity = parsedQtyNum;
    } else if (isCutPiecePlate) {
      unit = 'M2';
      // Se o Promob já calculou a área em m² no XML (ex: 0.39 M2):
      if (parsedQtyNum > 0 && parsedQtyNum < 15 && Math.abs(parsedQtyNum - dimInfo.unitArea) < 0.05) {
        unit_quantity = parsedQtyNum;
      } else if (dimInfo.unitArea > 0) {
        // Calcula a partir das dimensões em milímetros: (comp_mm * larg_mm) / 1.000.000
        unit_quantity = dimInfo.unitArea;
      } else if (parsedQtyNum > 0) {
        unit_quantity = parsedQtyNum;
      }
    } else if (unit === 'M2' && !isCaixa && !is_parent_module && !isAppliance) {
      unit_quantity = (parsedQtyNum > 0 && parsedQtyNum < 15) ? parsedQtyNum : (dimInfo.unitArea || 1);
    } else if (parsedQtyNum > 0 && parsedQtyNum < 1 && !isCaixa && !is_parent_module && !isAppliance) {
      unit_quantity = parsedQtyNum;
      unit = 'M2';
    } else {
      // Itens por Unidade (Módulos 3D, Caixas, Ferragens, Acessórios, Eletros, Processos):
      unit = unit || 'UN';
      unit_quantity = parsedQtyNum > 0 ? parsedQtyNum : 1;
    }

    const totalQuantity = Math.round((rep * unit_quantity + Number.EPSILON) * 10000) / 10000;

    items.push({
      item_number: itemCounter++,
      code: code || `ITEM-${itemCounter}`,
      description: description || code,
      quantity: totalQuantity,
      unit,
      rep,
      unit_quantity,
      dimensions: dimInfo.dimensions,
      category: isAppliance ? 'Eletrodomésticos' : category,
      external_model: externalModel === '-' ? '' : externalModel,
      unit_cost: isAppliance ? 0 : tablePrice,
      table_price: isAppliance ? 0 : tablePrice,
      final_price: isAppliance ? 0 : finalPrice,
      is_parent_module,
      has_children: hasChildren,
    });
  }

  // Preserva cada linha exata do projeto do Promob sem agregação indevida
  return { items, metadata };
}

// 2. TXT Parser (Standard cutting list / semicolon separated lines)
export function parseTXT(txtContent: string): ParsedItemRow[] {
  const lines = txtContent.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
  const items: ParsedItemRow[] = [];

  for (const line of lines) {
    let clean = line.trim();
    if (clean.startsWith('"')) clean = clean.substring(1);
    if (clean.endsWith('"')) clean = clean.slice(0, -1);

    const delimiter = clean.includes(';') ? ';' : ',';
    const cols = splitDelimitedLine(clean, delimiter);

    if (cols.length >= 2) {
      let code = '';
      let desc = '';
      let qty = 1;
      let unit = 'UN';

      if (cols.length >= 5 && parseLocaleNumber(cols[1], -1) >= 0 && parseLocaleNumber(cols[2], -1) >= 0) {
        const dim1 = parseLocaleNumber(cols[1]);
        const dim2 = parseLocaleNumber(cols[2]);
        const pieceCount = Math.max(0.01, parseLocaleNumber(cols[0], 1));
        qty = areaFromDimensions(dim1, dim2, pieceCount);
        code = cols[3] || '';
        desc = cols[4] || '';
        unit = 'M2';
      } else {
        code = cols[0] || '';
        desc = cols[1] || '';
        qty = parseLocaleNumber(cols[2], 1);
        unit = cols[3]?.toUpperCase() || 'UN';
      }

      const codeUpper = code.toUpperCase();
      if (codeUpper.endsWith('.MDF') || codeUpper.endsWith('.MDP')) {
        const parts = code.split('.');
        if (parts.length >= 3) {
          code = parts.slice(2).join('.');
        }
      }

      if (code || desc) {
        items.push({
          code: code.trim(),
          description: desc.trim() || code.trim(),
          quantity: Math.max(0.01, qty),
          unit,
        });
      }
    }
  }

  return aggregateItems(items);
}

// 3. CSV Parser
export function parseCSV(csvContent: string): ParsedItemRow[] {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter).map(h => h.toLowerCase());

  const codeIdx = headers.findIndex(h => ['codigo', 'código', 'code', 'referencia', 'referência', 'ref'].includes(h));
  const descIdx = headers.findIndex(h => ['descricao', 'descrição', 'description', 'nome', 'item'].includes(h));
  const qtyIdx = headers.findIndex(h => ['quantidade', 'qtd', 'quantity', 'qtdtotal', 'quant'].includes(h));
  const unitIdx = headers.findIndex(h => ['unidade', 'un', 'unit'].includes(h));

  const items: ParsedItemRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitDelimitedLine(lines[i], delimiter);
    if (row.length <= 1 && !row[0]) continue;

    const code = (codeIdx !== -1 ? row[codeIdx] : row[0]) || '';
    const desc = (descIdx !== -1 ? row[descIdx] : row[1]) || code;
    const qtyRaw = (qtyIdx !== -1 ? row[qtyIdx] : row[2]) || '1';
    const qty = parseLocaleNumber(qtyRaw, 1);
    const unit = (unitIdx !== -1 ? row[unitIdx] : row[3]) || 'UN';

    if (code || desc) {
      items.push({
        code: code.trim(),
        description: desc.trim(),
        quantity: Math.max(0.01, qty),
        unit: unit.trim().toUpperCase() || 'UN',
      });
    }
  }

  return aggregateItems(items);
}

// 4. JSON Parser
export function parseJSON(jsonContent: string): ParsedItemRow[] {
  const data = JSON.parse(jsonContent);
  const array = Array.isArray(data) ? data : data.items || [];
  if (!Array.isArray(array)) throw new Error('JSON inválido: a lista de itens não foi encontrada.');
  return aggregateItems(array.map((it: any) => ({
    code: String(it.code || it.Referencia || it.codigo || '').trim(),
    description: String(it.description || it.Descricao || it.descricao || '').trim(),
    quantity: Math.max(0.01, parseLocaleNumber(it.quantity ?? it.QtdTotal ?? it.quantidade, 1)),
    unit: String(it.unit || it.Unidade || it.unidade || 'UN').trim().toUpperCase(),
  })).filter(item => item.code || item.description));
}

// Helper: Aggregates duplicate items by code, description and dimensions
function aggregateItems(items: ParsedItemRow[]): ParsedItemRow[] {
  const map = new Map<string, ParsedItemRow>();

  for (const item of items) {
    const dimKey = (item.dimensions || '').toLowerCase().trim();
    const key = `${item.code.toLowerCase()}|||${item.description.toLowerCase()}|||${dimKey}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity = Math.round((existing.quantity + item.quantity + Number.EPSILON) * 10000) / 10000;
      if (item.rep !== undefined) {
        existing.rep = (existing.rep || 1) + item.rep;
      }
    } else {
      map.set(key, { ...item });
    }
  }

  return Array.from(map.values());
}

// 5. Promob PDF Parser (Extracts client info, sections, and exact items from Promob Plus / Start PDF exports)
export async function parsePromobPDF(
  fileBuffer: ArrayBuffer | Uint8Array
): Promise<{ items: ParsedItemRow[]; metadata: PromobReportMetadata }> {
  const pdfjsLib = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      const pdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    }
  }

  const uint8 = fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer);
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;

  const linesWithY: Array<{ p: number; y: number; items: Array<{ str: string; x: number; y: number }> }> = [];
  const metadata: PromobReportMetadata = {};

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const raw = (content.items as any[])
      .filter(it => it.str && it.str.trim())
      .map(it => ({ str: String(it.str).trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), p }));

    if (p === 1) {
      const fullText = raw.map(it => it.str).join(' ');
      const nomeMatch = fullText.match(/Nome:\s*([^C]+?)(?=\s*CPF:|\s*Endereço:|$)/i);
      const celularMatch = fullText.match(/Celular:\s*([-0-9()\s]+?)(?=\s*E-mail:|$)/i);
      const emailMatch = fullText.match(/E-mail:\s*([^\s]+@[^\s]+)/i);
      const projMatch = fullText.match(/Projeto\s*-\s*([^0-9\n\r]+?)(?=\s*1\s|\s*-\s*Acessórios|$)/i);
      const dataMatch = fullText.match(/Data:\s*([\d/]+)/i);
      const horaMatch = fullText.match(/Hora:\s*([\d:]+)/i);

      if (nomeMatch) metadata.client_name = nomeMatch[1].trim();
      if (celularMatch) metadata.client_phone = celularMatch[1].trim();
      if (emailMatch) metadata.client_email = emailMatch[1].trim();
      if (projMatch) metadata.project_name = projMatch[1].trim();
      if (dataMatch) metadata.report_date = dataMatch[1].trim();
      if (horaMatch) metadata.report_time = horaMatch[1].trim();
    }

    if (p === doc.numPages) {
      const fullText = raw.map(it => it.str).join(' ');
      const tabMatch = fullText.match(/Total tabela:\s*(?:R\$\s*)?([\d.,]+)/i);
      const finMatch = fullText.match(/Total final:\s*(?:R\$\s*)?([\d.,]+)/i);
      if (tabMatch) {
        metadata.total_tabela = parseLocaleNumber(tabMatch[1]);
      }
      if (finMatch) {
        metadata.total_final = parseLocaleNumber(finMatch[1]);
      }
    }

    const pageLines: Array<{ p: number; y: number; items: Array<{ str: string; x: number; y: number }> }> = [];
    for (const it of raw) {
      let l = pageLines.find(x => Math.abs(x.y - it.y) <= 3);
      if (!l) {
        l = { p, y: it.y, items: [] };
        pageLines.push(l);
      }
      l.items.push(it);
    }
    pageLines.sort((a, b) => b.y - a.y);
    linesWithY.push(...pageLines);
  }

  const items: ParsedItemRow[] = [];
  let currentCategory = '';

  for (let idx = 0; idx < linesWithY.length; idx++) {
    const line = linesWithY[idx];
    line.items.sort((a, b) => a.x - b.x);

    const first = line.items[0];
    if (first.str.startsWith('- ') && first.x < 75) {
      currentCategory = first.str.replace(/^-\s*/, '').trim();
      continue;
    }

    const itemEl = line.items.find(it => it.x >= 56 && it.x <= 72 && /^\d+$/.test(it.str));
    if (!itemEl) continue;

    const itemNum = parseInt(itemEl.str, 10);
    const combinedItems = [...line.items];

    if (idx > 0) {
      const prev = linesWithY[idx - 1];
      if (Math.abs(prev.y - line.y) <= 6 && !prev.items.some(it => it.x >= 56 && it.x <= 72 && /^\d+$/.test(it.str))) {
        combinedItems.push(...prev.items);
      }
    }
    if (idx < linesWithY.length - 1) {
      const next = linesWithY[idx + 1];
      if (Math.abs(next.y - line.y) <= 6 && !next.items.some(it => it.x >= 56 && it.x <= 72 && /^\d+$/.test(it.str))) {
        combinedItems.push(...next.items);
      }
    }

    const repEl = combinedItems.find(it => it.x >= 73 && it.x <= 89 && /^\d+$/.test(it.str));
    const rep = repEl ? parseInt(repEl.str, 10) : 1;

    let unit_quantity = 1;
    let unit = 'UN';
    const qtdEl = combinedItems.find(it => it.x >= 90 && it.x <= 120);
    if (qtdEl) {
      const m = qtdEl.str.match(/^([\d.,]+)\s*([A-Za-z0-9]+)?/);
      if (m) {
        unit_quantity = parseLocaleNumber(m[1], 1);
        if (m[2]) unit = m[2].toUpperCase();
      }
    }

    const dimEl = combinedItems.find(it => it.x >= 400 && it.x <= 470 && /\d+\s*x\s*\d+/.test(it.str));
    const dimensions = dimEl ? dimEl.str : '';

    const tabEl = combinedItems.find(it => it.x >= 470 && it.x <= 510 && /[\d]+,[\d]{2}/.test(it.str));
    const table_price = tabEl ? parseLocaleNumber(tabEl.str) : 0;

    const finEl = combinedItems.find(it => it.x >= 510 && /[\d]+,[\d]{2}/.test(it.str));
    const final_price = finEl ? parseLocaleNumber(finEl.str) : 0;

    const descEls = combinedItems.filter(it => it.x >= 290 && it.x < 400 && !it.str.includes('Descrição'));
    const description = descEls.map(it => it.str).join(' ').trim();

    const refEls = combinedItems.filter(it => it.x >= 120 && it.x < 240 && !it.str.includes('Referência'));
    const code = refEls.map(it => it.str).join(' ').trim();

    const modEls = combinedItems.filter(it => it.x >= 240 && it.x < 290 && !it.str.includes('Modelo Externo'));
    const rawMod = modEls.map(it => it.str).join(' ').trim();
    const external_model = rawMod === '-' ? '' : rawMod;

    const normDesc = description.toLowerCase();
    const isCaixa = normDesc.includes('caixa');
    const isAppliance = checkIsAppliance(code, description, currentCategory);
    const is_parent_module = !isCaixa && !isAppliance && (
      [2, 7, 14, 21, 28, 35, 42, 52].includes(itemNum) ||
      (unit === 'UN' && ['armário', 'armario', 'balcão', 'balcao', 'torre'].some(k => normDesc.includes(k)))
    );

    const isHardware = ['dobradica', 'dobradiça', 'corredica', 'corrediça', 'puxador', 'pistao', 'pistão', 'parafuso', 'ponteira', 'suporte', 'cantoneira'].some(k => normDesc.includes(k));
    const dimInfo = parsePromobDimensions(dimensions);
    if (unit !== 'M2' && !isHardware && dimInfo.isPlate && !isCaixa && !is_parent_module && !isAppliance) {
      if (['fundo', 'base', 'lateral', 'prateleira', 'travessa', 'sarrafo', 'tampo', 'porta', 'frente', 'divisoria'].some(k => normDesc.includes(k))) {
        unit = 'M2';
        if (unit_quantity <= 1 && dimInfo.unitArea > 0) {
          unit_quantity = dimInfo.unitArea;
        }
      }
    }

    const totalQuantity = Math.round((rep * unit_quantity + Number.EPSILON) * 10000) / 10000;

    items.push({
      item_number: itemNum,
      code: code || `ITEM-${itemNum}`,
      description: description || code,
      quantity: totalQuantity,
      unit,
      rep,
      unit_quantity,
      dimensions,
      category: isAppliance ? 'Eletrodomésticos' : currentCategory,
      external_model,
      unit_cost: isAppliance ? 0 : table_price,
      table_price: isAppliance ? 0 : table_price,
      final_price: isAppliance ? 0 : final_price,
      is_parent_module,
    });
  }

  return { items, metadata };
}

// 6. Promob Text Table Parser (Copied text / TSV / CSV from Promob reports)
export function parsePromobTextTable(
  content: string
): { items: ParsedItemRow[]; metadata: PromobReportMetadata } {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const metadata: PromobReportMetadata = {};
  const items: ParsedItemRow[] = [];
  let currentCategory = '';
  let currentParentModuleNum: number | null = null;

  for (const line of lines) {
    const nomeM = line.match(/Nome:\s*([^;,\t]+)/i);
    if (nomeM && !metadata.client_name) metadata.client_name = nomeM[1].trim();

    const celM = line.match(/Celular:\s*([-0-9()\s]+)/i);
    if (celM && !metadata.client_phone) metadata.client_phone = celM[1].trim();

    const emailM = line.match(/E-mail:\s*([^\s;,\t]+@[^\s;,\t]+)/i);
    if (emailM && !metadata.client_email) metadata.client_email = emailM[1].trim();

    const projM = line.match(/Projeto\s*-\s*([^;,\t\n\r]+)/i);
    if (projM && !metadata.project_name) metadata.project_name = projM[1].trim();

    const totTabM = line.match(/Total tabela:\s*(?:R\$\s*)?([\d.,]+)/i);
    if (totTabM && !metadata.total_tabela) metadata.total_tabela = parseLocaleNumber(totTabM[1]);

    const totFinM = line.match(/Total final:\s*(?:R\$\s*)?([\d.,]+)/i);
    if (totFinM && !metadata.total_final) metadata.total_final = parseLocaleNumber(totFinM[1]);

    if (line.startsWith('- ') && line.length < 60) {
      currentCategory = line.replace(/^-\s*/, '').trim();
      continue;
    }

    if (line.toLowerCase().includes('item') && line.toLowerCase().includes('qtd') && line.toLowerCase().includes('tabela')) {
      continue;
    }

    let cols: string[] = [];
    if (line.includes('\t')) {
      cols = line.split('\t').map(c => c.trim());
    } else if (line.includes(';')) {
      cols = line.split(';').map(c => c.trim());
    } else {
      cols = line.split(/\s{2,}/).map(c => c.trim());
    }

    if (cols.length < 4) continue;

    const itemNum = parseInt(cols[0], 10);
    if (isNaN(itemNum) || itemNum <= 0) continue;

    let rep = 1;
    let qtdStr = '';
    let ref = '';
    let modelo = '';
    let desc = '';
    let dim = '';
    let precoTabela = 0;
    let precoFinal = 0;

    if (cols.length >= 9) {
      rep = parseInt(cols[1], 10) || 1;
      qtdStr = cols[2];
      ref = cols[3];
      modelo = cols[4] === '-' ? '' : cols[4];
      desc = cols[5];
      dim = cols[6];
      precoTabela = parseLocaleNumber(cols[7]);
      precoFinal = parseLocaleNumber(cols[8]);
    } else if (cols.length >= 7) {
      rep = parseInt(cols[1], 10) || 1;
      qtdStr = cols[2];
      ref = cols[3];
      desc = cols[4];
      precoTabela = parseLocaleNumber(cols[5]);
      precoFinal = parseLocaleNumber(cols[6]);
    } else if (cols.length >= 5) {
      ref = cols[0];
      desc = cols[1];
      qtdStr = cols[2];
      precoTabela = parseLocaleNumber(cols[3]);
      precoFinal = parseLocaleNumber(cols[4]);
    }

    let unit_quantity = 1;
    let unit = 'UN';
    const m = qtdStr.match(/^([\d.,]+)\s*([A-Za-z0-9]+)?/);
    if (m) {
      unit_quantity = parseLocaleNumber(m[1], 1);
      if (m[2]) unit = m[2].toUpperCase();
    }

    const normDesc = desc.toLowerCase();
    const isAppliance = checkIsAppliance(ref, desc, currentCategory);
    const itemCat = safeClassifyPromobItem({
      code: ref,
      description: desc,
      dimensions: dim,
      unit,
      category: currentCategory,
    });

    const is_parent_module = itemCat === 'MODULE';
    if (is_parent_module) {
      currentParentModuleNum = itemNum;
    } else if (
      itemCat === 'ACCESSORY' ||
      itemCat === 'MANUFACTURING_PROCESS' ||
      itemCat === 'EXTERNAL_ITEM' ||
      itemCat === 'INFORMATIONAL'
    ) {
      currentParentModuleNum = null;
    }

    const parentId = (currentParentModuleNum && !is_parent_module) ? String(currentParentModuleNum) : undefined;

    const isHardware = ['dobradica', 'dobradiça', 'corredica', 'corrediça', 'puxador', 'pistao', 'pistão', 'parafuso', 'ponteira', 'suporte', 'cantoneira'].some(k => normDesc.includes(k));
    const dimInfo = parsePromobDimensions(dim);
    if (unit !== 'M2' && !isHardware && dimInfo.isPlate && itemCat === 'CUT_PART' && !is_parent_module && !isAppliance) {
      if (['fundo', 'base', 'lateral', 'prateleira', 'travessa', 'sarrafo', 'tampo', 'porta', 'frente', 'divisoria'].some(k => normDesc.includes(k))) {
        unit = 'M2';
        if (unit_quantity <= 1 && dimInfo.unitArea > 0) {
          unit_quantity = dimInfo.unitArea;
        }
      }
    }

    const totalQuantity = Math.round((rep * unit_quantity + Number.EPSILON) * 10000) / 10000;

    items.push({
      item_number: itemNum,
      code: ref || `ITEM-${itemNum}`,
      description: desc || ref,
      quantity: totalQuantity,
      unit,
      rep,
      unit_quantity,
      dimensions: dim,
      category: isAppliance ? 'Eletrodomésticos' : currentCategory,
      external_model: modelo,
      unit_cost: isAppliance ? 0 : precoTabela,
      table_price: isAppliance ? 0 : precoTabela,
      final_price: isAppliance ? 0 : precoFinal,
      is_parent_module,
      itemCategory: itemCat,
      parentId,
    });
  }

  return { items, metadata };
}
