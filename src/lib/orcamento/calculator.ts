import { BudgetItem, BudgetSettings, ProductItem } from './types';
import { INITIAL_CHAPAS_CATALOG, CatalogByBrand, BrandCatalog } from './chapas-catalog';

// Constante padrão de Marcenaria no Brasil: Chapa MDF (2,75m x 1,85m = 5,0875 m² ≈ 5,09 m²)
export const CHAPA_AREA_M2 = 2.75 * 1.85;

export function chapaSalePrice(price: number, area = CHAPA_AREA_M2): number {
  return area > 0 ? round2(price * 1.30 / area) : 0;
}

// Arredondamento contábil preciso para 2 casas decimais
export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// Normalização de código para comparação consistente
export function normalizeCode(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

// Normalização de texto removendo acentos e caracteres especiais
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Lista de marcas conhecidas na marcenaria
const KNOWN_BRANDS = [
  'Arauco',
  'Duratex',
  'Guararapes',
  'Greenplac',
  'Bernek',
  'Berneck',
  'Sudati',
  'Eucatex',
  'Formica',
  'Fórmica',
];

// Detecta se o item é chapa de MDF ou MDP
export function isChapa(code: string, description: string): boolean {
  const normCode = normalizeCode(code);
  const normDesc = normalizeText(description);
  return (
    normCode.includes('chapa') ||
    normCode.includes('.mdf') ||
    normCode.includes('.mdp') ||
    normDesc.includes('mdf') ||
    normDesc.includes('mdp') ||
    normDesc.includes('chapa') ||
    normDesc.includes('lateral') ||
    normDesc.includes('fundo') ||
    normDesc.includes('prateleira') ||
    normDesc.includes('gaveta') ||
    normDesc.includes('tampo') ||
    normDesc.includes('painel') ||
    normDesc.includes('porta')
  );
}

// Detecta se o item é Fita de Borda
export function isFitaBorda(code: string, description: string): boolean {
  const text = normalizeText(`${code} ${description}`);
  return text.includes('fita') && (text.includes('borda') || text.includes('pvc'));
}

// Extrai metragem do rolo de fita a partir da descrição (ex: "Rolo 20m", "50M")
export function extractFitaMetros(description: string): number | null {
  const match = description.match(/(\d+)\s*(?:m|metros|metro|mt)\b/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (val > 0 && val <= 500) return val;
  }
  return null;
}

// Calcula o fator multiplicador dos acréscimos globais
export function calculateAdditionsFactor(settings: BudgetSettings): number {
  const frete = Number(settings.frete) || 0;
  const montagem = Number(settings.montagem) || 0;
  const comissaoVendas = Number(settings.comissao_vendas) || 0;
  const comissaoExecutivo = Number(settings.comissao_executivo) || 0;
  const outrosTotal = (settings.outros || []).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

  const totalAcrescimosPercentual = frete + montagem + comissaoVendas + comissaoExecutivo + outrosTotal;
  return 1 + totalAcrescimosPercentual / 100;
}

// SMART MATCHER DE PROMOB: Analisa códigos complexos como 1.0139E.15.Arauco.Beige Matt.MDF BP 2L Revest
export function smartMatchPromobChapa(
  code: string,
  description: string,
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG
): {
  matched: boolean;
  brand: string | null;
  line: string | null;
  thickness: '6mm' | '15mm' | '18mm' | '25mm';
  m2Cost: number;
  boardPrice: number;
} {
  const rawText = `${code} ${description}`.trim();
  const normText = normalizeText(rawText);

  // 1. Detecta Marca
  let detectedBrand: string | null = null;
  for (const b of KNOWN_BRANDS) {
    if (normText.includes(normalizeText(b))) {
      detectedBrand = b === 'Berneck' ? 'Bernek' : b === 'Formica' ? 'Fórmica' : b;
      break;
    }
  }

  // 2. Detecta Espessura (6, 15, 18, 25)
  let thickness: '6mm' | '15mm' | '18mm' | '25mm' = '15mm';
  if (
    /\.6\./.test(code) ||
    /\b6mm\b/i.test(code) ||
    /\b6mm\b/i.test(description) ||
    description.endsWith(' 6') ||
    code.includes('.6.arauco') ||
    code.includes('.6.duratex')
  ) {
    thickness = '6mm';
  } else if (
    /\.18\./.test(code) ||
    /\b18mm\b/i.test(code) ||
    /\b18mm\b/i.test(description) ||
    description.endsWith(' 18')
  ) {
    thickness = '18mm';
  } else if (
    /\.25\./.test(code) ||
    /\b25mm\b/i.test(code) ||
    /\b25mm\b/i.test(description) ||
    description.endsWith(' 25')
  ) {
    thickness = '25mm';
  } else if (
    /\.15\./.test(code) ||
    /\b15mm\b/i.test(code) ||
    /\b15mm\b/i.test(description) ||
    description.endsWith(' 15')
  ) {
    thickness = '15mm';
  }

  if (!detectedBrand || !catalog[detectedBrand] || catalog[detectedBrand].type !== 'brand') {
    return { matched: false, brand: null, line: null, thickness, m2Cost: 0, boardPrice: 0 };
  }

  const brandData = catalog[detectedBrand] as BrandCatalog;
  const lines = brandData.lines;

  // Extrai palavras-chave do acabamento/cor (ex: "Beige Matt" -> ["beige", "matt"])
  const tokens = normalizeText(code)
    .replace(/[0-9._-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !['mdf', 'revest', 'arauco', 'duratex', 'guararapes'].includes(t));

  let bestScore = 0;
  let bestLine = null;

  for (const line of lines) {
    const normLine = normalizeText(line.name);
    let score = 0;

    for (const t of tokens) {
      if (normLine.includes(t)) {
        score += 2;
      } else if (t.includes('mat') && normLine.includes('matt')) {
        score += 3;
      } else if (t.includes('vert') && normLine.includes('vert')) {
        score += 3;
      } else if (t.includes('chess') && normLine.includes('chess')) {
        score += 3;
      } else if (t.includes('ultra') && normLine.includes('ultra')) {
        score += 3;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestLine = line;
    }
  }

  // Se não encontrou por tokens específicos mas é da marca, usa a linha padrão/intermediária
  if (!bestLine && lines.length > 0) {
    bestLine = lines[0];
  }

  if (bestLine) {
    const boardPrice = bestLine.prices[thickness] || 0;
    if (boardPrice && boardPrice > 0) {
      const m2Cost = chapaSalePrice(boardPrice, bestLine.width * bestLine.height);
      return {
        matched: true,
        brand: detectedBrand,
        line: bestLine.name,
        thickness,
        m2Cost,
        boardPrice,
      };
    }
  }

  return { matched: false, brand: detectedBrand, line: null, thickness, m2Cost: 0, boardPrice: 0 };
}

// Localiza o produto no banco cadastrado pelo código ou subcódigos
export function matchProduct(
  code: string,
  description: string,
  database: ProductItem[]
): { product: ProductItem | undefined; isSubcodeMatch: boolean } {
  const cleanCode = normalizeCode(code);
  if (!cleanCode) return { product: undefined, isSubcodeMatch: false };

  // 1. Busca exata por código principal
  let found = database.find(p => normalizeCode(p.code) === cleanCode);
  if (found) return { product: found, isSubcodeMatch: false };

  // 2. Busca por subcódigos / apelidos
  found = database.find(p =>
    p.subcodes && p.subcodes.some(sub => normalizeCode(sub) === cleanCode)
  );
  if (found) return { product: found, isSubcodeMatch: true };

  // 3. Busca por descrição contendo o código
  found = database.find(p =>
    normalizeText(p.description).includes(cleanCode) ||
    cleanCode.includes(normalizeCode(p.code))
  );

  return { product: found, isSubcodeMatch: false };
}

// Calcula preços e totais de um item individual
export function calculateItemPrice(
  item: {
    code: string;
    description: string;
    quantity: number;
    unit?: string;
    unit_cost?: number;
    margin?: number;
    price_unlinked?: boolean;
  },
  database: ProductItem[],
  settings: BudgetSettings
): BudgetItem {
  // 1. Tenta correspondência direta no banco de produtos
  const { product: matched, isSubcodeMatch } = matchProduct(item.code, item.description, item.price_unlinked ? [] : database);

  // 2. Se não encontrou no banco direto, roda o Smart Matcher de Chapas por Marca (Arauco, Duratex, etc.)
  const smart = !matched && !item.price_unlinked ? smartMatchPromobChapa(item.code, item.description) : null;

  const found = !!matched || (smart ? smart.matched : false);
  const isItemChapa = isChapa(item.code, item.description) || (smart ? smart.matched : false);
  const isItemFita = isFitaBorda(item.code, item.description);

  // Custo base unitário
  let unit_cost = 0;
  if (item.unit_cost !== undefined && item.unit_cost >= 0) {
    unit_cost = item.unit_cost;
  } else if (matched) {
    unit_cost = matched.unit_price;
  } else if (smart && smart.matched) {
    unit_cost = smart.m2Cost;
  }

  const fitaMetros = matched?.fita_metros || extractFitaMetros(item.description) || 20;

  // Se for Fita de Borda em rolo e a lista vier em metros lineares (M):
  if (isItemFita && fitaMetros > 0 && item.unit?.toUpperCase() === 'M' && unit_cost > 0) {
    unit_cost = round2(unit_cost / fitaMetros);
  }

  // Margem de lucro do item ou margem padrão
  const marginPercent = Math.max(0, Number(item.margin !== undefined ? item.margin : settings.margin) || 0);

  // Fator de acréscimos globais
  const additionsFactor = calculateAdditionsFactor(settings);

  // Fórmula central: Custo x (1 + Margem/100) x Fator de Acréscimos
  const priceWithMargin = unit_cost * (1 + marginPercent / 100);
  const unit_price = round2(priceWithMargin * additionsFactor);

  // Quantidade e unidade (considera modo chapa se aplicável)
  let effectiveQuantity = Math.max(0.01, Number(item.quantity) || 1);
  let displayUnit = matched?.unit || item.unit || 'UN';

  if (isItemChapa && settings.chapa_mode === 'chapa' && displayUnit.toUpperCase() === 'M2') {
    const chapasCount = item.quantity / CHAPA_AREA_M2;
    if (settings.chapa_rounding === 'up') {
      effectiveQuantity = Math.ceil(chapasCount);
    } else if (settings.chapa_rounding === 'down') {
      effectiveQuantity = Math.floor(chapasCount);
    } else {
      effectiveQuantity = round2(chapasCount);
    }
    displayUnit = 'CHAPA';
  }

  const total_cost = round2(unit_cost * effectiveQuantity);
  const total_price = round2(unit_price * effectiveQuantity);

  let finalDescription = item.description;
  if (smart && smart.matched && smart.brand && smart.line) {
    finalDescription = `${item.description} [${smart.brand} - ${smart.line} ${smart.thickness}]`;
  } else if (matched) {
    finalDescription = `${item.description} (${matched.description})`;
  }

  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    item_number: 1,
    code: matched ? matched.code : item.code,
    description: finalDescription,
    quantity: effectiveQuantity,
    unit: displayUnit,
    unit_cost,
    margin: marginPercent,
    unit_price,
    total_cost,
    total_price,
    found,
    price_unlinked: item.price_unlinked,
    is_chapa: isItemChapa,
    is_fita: isItemFita,
    fita_metros: isItemFita ? fitaMetros : undefined,
    original_code: item.code,
    original_quantity: item.quantity,
    original_unit: item.unit,
    resolved_from_subcode: isSubcodeMatch || (smart ? smart.matched : false),
  };
}

// Recalcula todos os itens do orçamento de forma ultra rápida
export function recalculateBudget(
  items: BudgetItem[],
  database: ProductItem[],
  settings: BudgetSettings
): {
  items: BudgetItem[];
  totals: {
    total_cost: number;
    total_price: number;
    gross_profit: number;
    profit_margin_percent: number;
    items_count: number;
  };
} {
  const recalculatedItems = items.map((it, idx) => {
    const updated = calculateItemPrice(
      {
        code: it.original_code || it.code,
        description: it.description,
        quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
        unit: it.original_unit || it.unit,
        unit_cost: it.unit_cost,
        margin: it.margin,
        price_unlinked: it.price_unlinked,
      },
      database,
      settings
    );
    return {
      ...updated,
      id: it.id,
      item_number: idx + 1,
    };
  });

  const total_cost = round2(recalculatedItems.reduce((acc, curr) => acc + curr.total_cost, 0));
  const total_price = round2(recalculatedItems.reduce((acc, curr) => acc + curr.total_price, 0));
  const gross_profit = round2(total_price - total_cost);
  const profit_margin_percent = total_cost > 0 ? round2((gross_profit / total_cost) * 100) : 0;

  return {
    items: recalculatedItems,
    totals: {
      total_cost,
      total_price,
      gross_profit,
      profit_margin_percent,
      items_count: recalculatedItems.length,
    },
  };
}
