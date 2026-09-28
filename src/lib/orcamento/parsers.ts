import { PromobReportMetadata } from './types';

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

    const is_parent_module =
      [2, 7, 8, 14, 15, 21, 22, 28, 29, 35, 36, 42, 43, 52, 53, 58, 63, 68, 73].includes(itemNum) ||
      (unit === 'UN' && ['armário', 'balcão', 'torre', 'caixa armário', 'caixa gaveta'].some(k => description.toLowerCase().includes(k)));

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
      category: currentCategory,
      external_model,
      unit_cost: table_price,
      table_price,
      final_price,
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

    const totalQuantity = Math.round((rep * unit_quantity + Number.EPSILON) * 10000) / 10000;
    const is_parent_module =
      [2, 7, 8, 14, 15, 21, 22, 28, 29, 35, 36, 42, 43, 52, 53, 58, 63, 68, 73].includes(itemNum) ||
      (unit === 'UN' && ['armário', 'balcão', 'torre', 'caixa armário', 'caixa gaveta'].some(k => desc.toLowerCase().includes(k)));

    items.push({
      item_number: itemNum,
      code: ref || `ITEM-${itemNum}`,
      description: desc || ref,
      quantity: totalQuantity,
      unit,
      rep,
      unit_quantity,
      dimensions: dim,
      category: currentCategory,
      external_model: modelo,
      unit_cost: precoTabela,
      table_price: precoTabela,
      final_price: precoFinal,
      is_parent_module,
    });
  }

  return { items, metadata };
}
