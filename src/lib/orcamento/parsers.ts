export interface ParsedItemRow {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  dimensions?: string;
  has_children?: boolean;
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

function areaFromDimensions(width: number, height: number, count: number): number {
  if (width <= 0 || height <= 0 || count <= 0) return count;
  const divisor = width > 20 || height > 20 ? 1_000_000 : 1;
  return (width * height * count) / divisor;
}

// 1. Promob XML Parser (Supports Promob Plus <ITEM>, exploded lists and generic <Item>)
export function parsePromobXML(xmlContent: string): ParsedItemRow[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
  
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  const items: ParsedItemRow[] = [];
  const itemElements = xmlDoc.getElementsByTagName('ITEM');

  if (itemElements.length > 0) {
    for (let i = 0; i < itemElements.length; i++) {
      const el = itemElements[i];
      const reference = el.getAttribute('REFERENCE') || el.getAttribute('CODE') || '';
      const description = el.getAttribute('DESCRIPTION') || el.getAttribute('NAME') || '';
      const quantity = parseFloat(el.getAttribute('QUANTITY') || el.getAttribute('REPETITION') || '1') || 1;
      const unit = el.getAttribute('UNIT') || 'UN';
      const dimensions = el.getAttribute('DIMENSION') || el.getAttribute('DIMENSIONS') || '';
      const hasChildren = el.getElementsByTagName('ITEM').length > 0;

      if (!reference && !description) continue;
      if (hasChildren) continue;

      items.push({
        code: reference.trim(),
        description: description.trim(),
        quantity: Math.max(0.01, quantity),
        unit: unit.trim().toUpperCase() || 'UN',
        dimensions,
        has_children: hasChildren,
      });
    }
  } else {
    const genericItems = xmlDoc.getElementsByTagName('Item');
    for (let i = 0; i < genericItems.length; i++) {
      const el = genericItems[i];
      const ref = el.getElementsByTagName('Referencia')[0]?.textContent || el.getElementsByTagName('Codigo')[0]?.textContent || '';
      const desc = el.getElementsByTagName('Descricao')[0]?.textContent || '';
      const qtd = parseFloat(el.getElementsByTagName('QtdTotal')[0]?.textContent || el.getElementsByTagName('Quantidade')[0]?.textContent || '1') || 1;
      const un = el.getElementsByTagName('Unidade')[0]?.textContent || 'UN';
      const dim = el.getElementsByTagName('Dimensoes')[0]?.textContent || '';

      if (!ref && !desc) continue;

      items.push({
        code: ref.trim(),
        description: desc.trim(),
        quantity: Math.max(0.01, qtd),
        unit: un.trim().toUpperCase() || 'UN',
        dimensions: dim,
      });
    }
  }

  return aggregateItems(items);
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

// Helper: Aggregates duplicate items by code and description
function aggregateItems(items: ParsedItemRow[]): ParsedItemRow[] {
  const map = new Map<string, ParsedItemRow>();

  for (const item of items) {
    const key = `${item.code.toLowerCase()}|||${item.description.toLowerCase()}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }

  return Array.from(map.values());
}
