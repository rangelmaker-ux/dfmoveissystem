import { BudgetItem, BudgetSettings, ProductItem, ModuleGroup, ItemCategory, PricingAudit } from './types';
import { INITIAL_CHAPAS_CATALOG, CatalogByBrand, BrandCatalog, ChapaLineItem } from './chapas-catalog';
import { DEFAULT_MATERIALS } from './default-materials';

// Constante padrão de Marcenaria no Brasil: Chapa MDF (2,75m x 1,85m = 5,0875 m² ≈ 5,09 m²)
export const CHAPA_AREA_M2 = 2.75 * 1.85;

export function chapaSalePrice(price: number, area = CHAPA_AREA_M2): number {
  return area > 0 ? round2(price * 1.30 / area) : 0;
}

// Arredondamento contábil preciso para 2 casas decimais
export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// Arredondamento com precisão de 4 casas decimais para quantidades em m² e fita
export function round4(val: number): number {
  return Math.round((val + Number.EPSILON) * 10000) / 10000;
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

// Detecta se o item é eletrodoméstico ou equipamento (não entra no custo da marcenaria)
export function isEletrodomestico(code?: string, description?: string, category?: string): boolean {
  const text = normalizeText(`${code || ''} ${description || ''} ${category || ''}`);
  if (!text) return false;
  // A cabinet for an appliance is still furniture, not the appliance itself.
  if (/\b(armario|balcao|torre|nicho|painel|modulo)\b/.test(normalizeText(description || ''))) return false;
  const applianceKeywords = [
    'forno',
    'fogao',
    'fogão',
    'cooktop',
    'coifa',
    'depurador',
    'geladeira',
    'refrigerador',
    'freezer',
    'microondas',
    'micro-ondas',
    'lava loucas',
    'lava louças',
    'lava-loucas',
    'lava-louças',
    'lava e seca',
    'maquina de lavar',
    'máquina de lavar',
    'adega',
    'cervejeira',
    'electrolux',
    'brastemp',
    'consul',
    'eletrodomestico',
    'eletrodoméstico',
    'eletros',
  ];
  return applianceKeywords.some(kw => text.includes(kw));
}

// Detecta se o item é chapa de MDF ou MDP
export function isChapa(code: string, description: string): boolean {
  if (isEletrodomestico(code, description)) return false;
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
    normDesc.includes('porta') ||
    normDesc.includes('caixa')
  );
}

// Detecta se o item é Fita de Borda
export function isFitaBorda(code: string, description: string): boolean {
  if (isEletrodomestico(code, description)) return false;
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
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG,
  dimensions?: string
): {
  matched: boolean;
  brand: string | null;
  line: string | null;
  thickness: '6mm' | '15mm' | '18mm' | '25mm' | '30mm';
  m2Cost: number;
  boardPrice: number;
} {
  if (isEletrodomestico(code, description)) {
    return { matched: false, brand: null, line: null, thickness: '15mm', m2Cost: 0, boardPrice: 0 };
  }

  const rawText = `${code} ${description} ${dimensions || ''}`.trim();
  const normText = normalizeText(rawText);

  // 1. Detecta Marca
  let detectedBrand: string | null = null;
  for (const b of KNOWN_BRANDS) {
    if (normText.includes(normalizeText(b))) {
      detectedBrand = (b === 'Berneck' || b === 'Bernek') ? (catalog && catalog['Berneck'] ? 'Berneck' : 'Bernek') : b === 'Formica' ? 'Fórmica' : b;
      break;
    }
  }

  // Verifica também chaves de marcas presentes no catálogo recebido
  if (!detectedBrand && catalog) {
    for (const b of Object.keys(catalog)) {
      if (catalog[b].type === 'brand' && normText.includes(normalizeText(b))) {
        detectedBrand = b;
        break;
      }
    }
  }

  // Se não detectou marca explícita, mas é caixaria ou branco padrão: Arauco é o padrão de marcenaria no Promob e DF Móveis
  const isGenericWhiteOrCaixa = !detectedBrand && (normText.includes('branco') || normText.includes('branca') || normText.includes('caixa'));
  if (isGenericWhiteOrCaixa) {
    detectedBrand = 'Arauco';
  }

  const explicitMm = description.match(/espessura\s+(\d+(?:[.,]\d+)?)\s*mm/i)?.[1];
  if (explicitMm && ![6,15,18,25,30].includes(Number(explicitMm.replace(',', '.')))) {
    return { matched: false, brand: detectedBrand, line: null, thickness: '15mm', m2Cost: 0, boardPrice: 0 };
  }

  const requiresWhiteTx = /branc[oa][\s._-]*(?:\(?tx\)?|texturizad[oa])/i.test(rawText);

  // 2. Detecta Espessura (6, 15, 18, 25)
  let thickness: '6mm' | '15mm' | '18mm' | '25mm' | '30mm' = '15mm';
  if (/\.30\./.test(code) || /\b30\s*mm\b/i.test(`${code} ${description}`) || description.endsWith(' 30')) {
    thickness = '30mm';
  } else if (
    /\.0?6\./.test(code) ||
    /\b6\s*mm\b/i.test(code) ||
    /\b6\s*mm\b/i.test(description) ||
    description.endsWith(' 6') ||
    code.includes('.6.arauco') ||
    code.includes('.6.duratex')
  ) {
    thickness = '6mm';
  } else if (
    /\.18\./.test(code) ||
    /\b18\s*mm\b/i.test(code) ||
    /\b18\s*mm\b/i.test(description) ||
    description.endsWith(' 18')
  ) {
    thickness = '18mm';
  } else if (
    /\.25\./.test(code) ||
    /\b25\s*mm\b/i.test(code) ||
    /\b25\s*mm\b/i.test(description) ||
    description.endsWith(' 25')
  ) {
    thickness = '25mm';
  } else if (
    /\.15\./.test(code) ||
    /\b15\s*mm\b/i.test(code) ||
    /\b15\s*mm\b/i.test(description) ||
    description.endsWith(' 15')
  ) {
    thickness = '15mm';
  } else if (dimensions) {
    // Dimensões do Promob em milímetros: ex: '670 x 15 x 580' ou '700 x 6 x 700'
    const dNums = (dimensions.match(/[\d.,]+/g) || []).map(n => parseFloat(n.replace(',', '.')));
    if (dNums.length === 3) {
      const minD = Math.min(...dNums);
      if (minD === 6) thickness = '6mm';
      else if (minD === 18) thickness = '18mm';
      else if (minD === 25) thickness = '25mm';
      else if (minD === 30) thickness = '30mm';
      else if (minD === 15) thickness = '15mm';
    }
  }

  // Tokens para pesquisa sem ruídos
  const tokens = normalizeText(`${code} ${description}`)
    .replace(/[0-9._-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !['mdf', 'mdp', 'revest', 'arauco', 'duratex', 'guararapes', 'greenplac', 'berneck', 'bernek', 'eucatex', 'formica', 'sudati', 'chapa', 'promob', 'porta', 'lateral', 'fundo', 'gaveta', 'base'].includes(t));

  const scoreBrand = (bName: string) => {
    const bCat = catalog && catalog[bName];
    if (!bCat || bCat.type !== 'brand' || !Array.isArray(bCat.lines)) {
      return { bestLine: null as ChapaLineItem | null, bestScore: 0 };
    }

    let topScore = 0;
    let topLine: ChapaLineItem | null = null;
    let ambiguous = false;

    for (const line of bCat.lines) {
      const normLine = normalizeText(line.name);
      let score = 0;
      const finishPaths = [line.name, ...(line.aliases || [])].map(value =>
        normalizeText(value).replace(/[\\>_-]+/g, ' ').replace(/\s+/g, ' ').trim());
      const searchableText = normText.replace(/[\\>_-]+/g, ' ').replace(/\s+/g, ' ');
      if (finishPaths.some(value => value.length >= 4 && searchableText.includes(value))) score = 80;
      if (requiresWhiteTx) {
        const exactFinish = [line.name, ...(line.colors || [])].some(value =>
          /branc[oa][\s._-]*(?:\(?tx\)?|texturizad[oa])/i.test(value));
        if (!exactFinish) continue;
        score = 100;
      }

      // 1. Cores e padrões oficiais
      if (Array.isArray(line.colors) && line.colors.length > 0) {
        for (const color of line.colors) {
          const normColor = normalizeText(color);
          if (normText.includes(normColor)) {
            if (score < 40) score = 40;
            break;
          }
          // Se o texto traz 'branco'/'branca' e a cor do catálogo é 'branco supremo', 'branco diamante', etc.
          if ((normText.includes('branco') || normText.includes('branca')) && (normColor === 'branco' || normColor.startsWith('branco ') || normColor.includes('branco'))) {
            if (score < 40) score = 40;
            break;
          }
          const colorWords = normColor.split(/\s+/).filter(w => w.length >= 3);
          const matchedWords = colorWords.filter(w => normText.includes(w));
          if (colorWords.length > 0 && matchedWords.length === colorWords.length) {
            if (score < 30) score = 30;
            break;
          } else if (matchedWords.length > 0) {
            const s = matchedWords.length * 6;
            if (s > score) score = s;
          }
        }
      }

      // 2. Tokens de nome de linha
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

      if (score > topScore) {
        topScore = score;
        topLine = line;
        ambiguous = false;
      } else if (score > 0 && score === topScore && topLine &&
        line.prices[thickness] !== topLine.prices[thickness]) {
        ambiguous = true;
      }
    }

    return { bestLine: ambiguous ? null : topLine, bestScore: topScore };
  };

  let winningBrand: string | null = detectedBrand;
  let bestLine: ChapaLineItem | null = null;
  let bestScore = 0;

  if (detectedBrand) {
    const res = scoreBrand(detectedBrand);
    bestLine = res.bestLine;
    bestScore = res.bestScore;
  }

  // Se não detectou marca explícita OU a marca detectada não encontrou linha com score >= 20:
  // Varre as marcas do catálogo na ordem oficial para encontrar o padrão/cor correspondente (ex: Carmel -> Greenplac)
  const BRAND_SCAN_ORDER = ['Arauco', 'Duratex', 'Guararapes', 'Greenplac', 'Berneck', 'Eucatex', 'Fórmica', 'Sudati'];
  if (!requiresWhiteTx && !detectedBrand && catalog) {
    const brandsToScan = [
      ...BRAND_SCAN_ORDER.filter(b => catalog[b] && catalog[b]?.type === 'brand'),
      ...Object.keys(catalog).filter(b => !BRAND_SCAN_ORDER.includes(b) && b !== 'Acessórios' && b !== 'Bernek' && catalog[b]?.type === 'brand')
    ];
    for (const b of brandsToScan) {
      const res = scoreBrand(b);
      if (res.bestScore > bestScore && res.bestScore >= 20) {
        bestScore = res.bestScore;
        bestLine = res.bestLine;
        winningBrand = b;
      }
    }
  }

  // Se o item contém "branco" ou "caixa" e não encontrou score alto, busca linha com "branco"
  if (!requiresWhiteTx && bestScore === 0 && !bestLine && !catalog[detectedBrand || '']?.type && (normText.includes('branco') || normText.includes('branca') || normText.includes('caixa'))) {
    const findWhiteInBrand = (bName: string) => {
      const bCat = catalog && catalog[bName];
      if (!bCat || bCat.type !== 'brand' || !Array.isArray(bCat.lines)) return null;
      return bCat.lines.find(l => {
        const hasWhiteColor = Array.isArray(l.colors) && l.colors.some(c => normalizeText(c).includes('branco'));
        const nl = normalizeText(l.name);
        return (hasWhiteColor || nl.includes('branco')) && !nl.includes('ultra');
      }) || bCat.lines.find(l => {
        const hasWhiteColor = Array.isArray(l.colors) && l.colors.some(c => normalizeText(c).includes('branco'));
        return hasWhiteColor || normalizeText(l.name).includes('branco');
      });
    };

    const targetB = winningBrand || detectedBrand || 'Arauco';
    bestLine = findWhiteInBrand(targetB) || findWhiteInBrand('Arauco') || findWhiteInBrand('Duratex') || null;
    if (bestLine) {
      winningBrand = targetB;
    }
  }

  const strictSource = winningBrand && catalog[winningBrand]?.type === 'brand'
    ? (catalog[winningBrand] as BrandCatalog).authoritative : false;
  if (bestLine && winningBrand && (!strictSource || bestScore >= 20)) {
    const boardPrice = (bestLine.prices && typeof bestLine.prices[thickness] === 'number')
      ? bestLine.prices[thickness]
      : 0;
    if (boardPrice && boardPrice > 0) {
      const width = bestLine.width || 2.75;
      const height = bestLine.height || 1.85;
      const m2Cost = chapaSalePrice(boardPrice, width * height);
      return {
        matched: true,
        brand: winningBrand,
        line: bestLine.name,
        thickness,
        m2Cost,
        boardPrice,
      };
    }
  }

  return { matched: false, brand: winningBrand, line: null, thickness, m2Cost: 0, boardPrice: 0 };

}

// SMART MATCHER DE ACESSÓRIOS E FERRAGENS (Dobradiças, Corrediças, Puxadores, Pistões, etc.)
export function smartMatchAccessory(
  code: string,
  description: string,
  dimensions?: string,
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG,
  database: ProductItem[] = DEFAULT_MATERIALS
): {
  matched: boolean;
  name: string;
  price: number;
  unit: string;
  source: 'catalog_acessorio' | 'database';
  code?: string;
} {
  if (isEletrodomestico(code, description)) {
    return { matched: false, name: '', price: 0, unit: 'UN', source: 'catalog_acessorio' };
  }

  const normText = normalizeText(`${code} ${description} ${dimensions || ''}`);
  const acessoriosCat = (catalog as any)?.['Acessórios'];
  const acessoriosList = acessoriosCat && acessoriosCat.type === 'acessorios' ? acessoriosCat.items : [];

  const findAcessorio = (predicate: (name: string) => boolean): { id: string; name: string; price: number; unit?: string } | undefined => {
    // 1. Prioridade no Catálogo Geral de Materiais (database): busca primeiro na descrição
    const dbDescMatch = database.find(p => {
      const isAcc = p.category === 'FERRAGEM' || p.category === 'ACESSORIO' || p.category === 'FITA' || p.category === 'OUTROS';
      if (!isAcc) return false;
      return predicate(normalizeText(p.description));
    });
    if (dbDescMatch && dbDescMatch.unit_price > 0) {
      return { id: dbDescMatch.code, name: dbDescMatch.description, price: dbDescMatch.unit_price, unit: dbDescMatch.unit || 'UN' };
    }

    const dbSubMatch = database.find(p => {
      const isAcc = p.category === 'FERRAGEM' || p.category === 'ACESSORIO' || p.category === 'FITA' || p.category === 'OUTROS';
      if (!isAcc) return false;
      const fullText = normalizeText(`${p.code} ${(p.subcodes || []).join(' ')}`);
      return predicate(fullText);
    });
    if (dbSubMatch && dbSubMatch.unit_price > 0) {
      return { id: dbSubMatch.code, name: dbSubMatch.description, price: dbSubMatch.unit_price, unit: dbSubMatch.unit || 'UN' };
    }

    // 2. Fallback caso ainda exista no catálogo legado
    return acessoriosList.find((a: { name: string }) => predicate(normalizeText(a.name)));
  };

  const findDbProduct = (predicate: (p: ProductItem) => boolean) => {
    return database.find(predicate);
  };

  // 1. Dobradiças
  if (normText.includes('dobradica') || normText.includes('calco')) {
    const isCantoL = normText.includes('canto') || normText.includes('angulo');
    const isCurva = normText.includes('curva') || normText.includes('alta');

    if (isCantoL) {
      const match = findAcessorio(n => n.includes('dobradica') && n.includes('canto l') && (isCurva ? n.includes('curva') : n.includes('reta')));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
      }
    }

    if (isCurva) {
      const match = findAcessorio(n => n.includes('dobradica') && n.includes('curva') && !n.includes('canto'));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
      }
    }

    const isSemAmort = normText.includes('s/ amort') || normText.includes('sem amort') || normText.includes('s/amort');
    if (isSemAmort) {
      const match = findAcessorio(n => n.includes('dobradica') && (n.includes('sem amort') || n.includes('s/ amort')));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
      }
    }

    const retaMatch = findAcessorio(n => n.includes('dobradica') && n.includes('reta') && !n.includes('canto') && !n.includes('sem amort')) ||
                      findAcessorio(n => n.includes('dobradica') && !n.includes('canto') && !n.includes('sem amort'));
    if (retaMatch && retaMatch.price > 0) {
      return { matched: true, name: retaMatch.name, price: retaMatch.price, unit: 'UN', source: 'catalog_acessorio', code: retaMatch.id };
    }

    const dbDobradica = findDbProduct(p => normalizeText(p.description).includes('dobradica') || normalizeCode(p.code).includes('dobr'));
    if (dbDobradica && dbDobradica.unit_price > 0) {
      return { matched: true, name: dbDobradica.description, price: dbDobradica.unit_price, unit: dbDobradica.unit || 'UN', source: 'database', code: dbDobradica.code };
    }
  }

  // 2. Corrediças
  if (
    normText.includes('corredica') ||
    normText.includes('telescopica') ||
    normText.includes('invisivel') ||
    (normText.includes('trilho') && normText.includes('gaveta'))
  ) {
    let size = '450';
    const sizeMatch = normText.match(/\b(300|350|400|450|500|550|600)\b/) || (dimensions || '').match(/\b(300|350|400|450|500|550|600)\b/);
    if (sizeMatch) {
      size = sizeMatch[1];
    } else {
      const cmMatch = normText.match(/\b(30|35|40|45|50|55|60)\s*cm\b/);
      if (cmMatch) size = `${parseInt(cmMatch[1], 10) * 10}`;
    }

    const isInvisivel = normText.includes('invisivel') || normText.includes('oculta') || normText.includes('slowmotion') || normText.includes('tandem');
    if (isInvisivel) {
      const match = findAcessorio(n => n.includes('invisivel') && n.includes(size)) ||
                    findAcessorio(n => n.includes('invisivel'));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: 'PAR', source: 'catalog_acessorio', code: match.id };
      }
    }

    const match = findAcessorio(n => n.includes('telescopica') && (n.includes(size) || n.includes(`${size}mm`))) ||
                  findAcessorio(n => n.includes('telescopica'));
    if (match && match.price > 0) {
      return { matched: true, name: `${match.name} ${size}mm`, price: match.price, unit: 'PAR', source: 'catalog_acessorio', code: match.id };
    }

    const dbSize = size === '500' ? '50' : '45';
    const dbCorr = findDbProduct(p => p.code === `CORREDICA-TELESC-${dbSize}`) ||
                   findDbProduct(p => normalizeText(p.description).includes('corredica'));
    if (dbCorr && dbCorr.unit_price > 0) {
      return { matched: true, name: dbCorr.description, price: dbCorr.unit_price, unit: dbCorr.unit || 'PAR', source: 'database', code: dbCorr.code };
    }
  }

  // 3. Puxadores e Ponteiras
  if (normText.includes('ponteira')) {
    const isContinuo = normText.includes('continuo');
    const match = findAcessorio(n => n.includes('ponteira') && (isContinuo ? n.includes('continuo') : n.includes('gola'))) ||
                  findAcessorio(n => n.includes('ponteira'));
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
    }
  }

  if (normText.includes('puxador') || normText.includes('perfil')) {
    if (normText.includes('continuo')) {
      const match = findAcessorio(n => n.includes('puxador') && n.includes('continuo'));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
      }
      const dbCont = findDbProduct(p => normalizeText(p.description).includes('continuo') || normalizeCode(p.code).includes('continuo') || (p.subcodes && p.subcodes.some(s => normalizeCode(s).includes('continuo'))));
      if (dbCont && dbCont.unit_price > 0) {
        return { matched: true, name: dbCont.description, price: dbCont.unit_price, unit: dbCont.unit || 'UN', source: 'database', code: dbCont.code };
      }
    }
    if (normText.includes('gola')) {
      const match = findAcessorio(n => n.includes('puxador') && n.includes('gola'));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
      }
      const dbGola = findDbProduct(p => normalizeText(p.description).includes('gola') || normalizeCode(p.code).includes('gola') || (p.subcodes && p.subcodes.some(s => normalizeCode(s).includes('gola'))));
      if (dbGola && dbGola.unit_price > 0) {
        return { matched: true, name: dbGola.description, price: dbGola.unit_price, unit: dbGola.unit || 'UN', source: 'database', code: dbGola.code };
      }
    }
    const dbPux = findDbProduct(p => normalizeCode(p.code) === 'puxador-perfil-alum' || normalizeText(p.description).includes('puxador'));
    if (dbPux && dbPux.unit_price > 0) {
      return { matched: true, name: dbPux.description, price: dbPux.unit_price, unit: dbPux.unit || 'UN', source: 'database', code: dbPux.code };
    }
  }

  // 4. Pistão / Articulador basculante
  if (normText.includes('pistao') || normText.includes('basculante') || normText.includes('articulador')) {
    const isInvertido = normText.includes('invertido');
    const match = findAcessorio(n => n.includes('pistao') && (isInvertido ? n.includes('invertido') : !n.includes('invertido'))) ||
                  findAcessorio(n => n.includes('pistao'));
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
    }
    const dbPistao = findDbProduct(p => (normalizeCode(p.code).includes('pistao') || normalizeText(p.description).includes('pistao')) && p.unit_price > 0);
    if (dbPistao && dbPistao.unit_price > 0) {
      return { matched: true, name: dbPistao.description, price: dbPistao.unit_price, unit: dbPistao.unit || 'UN', source: 'database', code: dbPistao.code };
    }
  }

  // 5. Cabideiros
  if (normText.includes('cabideiro')) {
    if (normText.includes('curvo')) {
      const match = findAcessorio(n => n.includes('cabideiro') && n.includes('curvo'));
      if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
    }
    if (normText.includes('extensivo') || normText.includes('articulado')) {
      const match = findAcessorio(n => n.includes('cabideiro') && n.includes('extensivo'));
      if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
    }
    if (normText.includes('suporte')) {
      const match = findAcessorio(n => n.includes('suporte') && n.includes('cabideiro'));
      if (match) return { matched: true, name: match.name, price: match.price, unit: 'PAR', source: 'catalog_acessorio', code: match.id };
    }
    const match = findAcessorio(n => n.includes('cabideiro') && n.includes('reto')) ||
                  findAcessorio(n => n.includes('cabideiro'));
    if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
  }

  // 6. Sistema de Correr
  if (normText.includes('correr') && (normText.includes('sistema') || normText.includes('kit') || normText.includes('porta') || normText.includes('roldana'))) {
    const match = findAcessorio(n => n.includes('sistema de correr') || n.includes('correr'));
    if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
  }

  // 7. Rodízios
  if (normText.includes('rodizio')) {
    const hasFreio = normText.includes('com freio') || normText.includes('c/ freio') || normText.includes('c/freio');
    const match = findAcessorio(n => n.includes('rodizio') && (hasFreio ? n.includes('com freio') : n.includes('sem freio'))) ||
                  findAcessorio(n => n.includes('rodizio'));
    if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
  }

  // 8. Tábua de passar
  if (normText.includes('tabua') && normText.includes('passar')) {
    const match = findAcessorio(n => n.includes('tabua de passar'));
    if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
  }

  // 9. Lixeira
  if (normText.includes('lixeira')) {
    const match = findAcessorio(n => n.includes('lixeira'));
    if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
  }

  // 10. Suporte Mão Francesa
  if (normText.includes('mao francesa') || normText.includes('francesa')) {
    const match = findAcessorio(n => n.includes('mao francesa') || n.includes('francesa'));
    if (match) return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
  }

  // 11. Parafusos / Fixações
  if (normText.includes('parafuso')) {
    const dbParafuso = findDbProduct(p => normalizeCode(p.code).includes('parafuso'));
    if (dbParafuso) {
      return { matched: true, name: dbParafuso.description, price: dbParafuso.unit_price, unit: dbParafuso.unit || 'CENTO', source: 'database', code: dbParafuso.code };
    }
  }

  // Tape color and width are part of its identity. A Carmel tape must not
  // silently inherit the price of the first white tape in the database.
  if (isFitaBorda(code, description)) {
    const width = normText.match(/\d+(?:[.,]\d+)?\s*x\s*(\d+)\s*mm/)?.[1] ||
      normText.match(/\b(22|35|45|64)\s*mm/)?.[1];
    const finish = /branc[oa][\s._-]*tx/.test(normText) ? 'branco tx' :
      normText.includes('carmel') ? 'carmel' : normText.includes('freijo') ? 'freijo' :
      /branc[oa]/.test(normText) ? 'branco' : '';
    if (!finish) return { matched: false, name: '', price: 0, unit: 'M', source: 'catalog_acessorio' };
    const match = findAcessorio(name => {
      const white = finish.startsWith('branco') && /branc[oa]/.test(name);
      const colorMatches = finish === 'branco tx' ? white && /\btx\b/.test(name) : white || name.includes(finish);
      const sizeMatches = !width || new RegExp(`(?:^|[^0-9])${width}(?:[^0-9]|$)`).test(name);
      return name.includes('fita') && colorMatches && sizeMatches;
    });
    if (match && match.price > 0) return { matched: true, name: match.name, price: match.price, unit: match.unit || 'ROLO', source: 'catalog_acessorio', code: match.id };
    return { matched: false, name: '', price: 0, unit: 'M', source: 'catalog_acessorio' };
  }

  // 13. Fuzzy Match genérico no database
  const words = normText.replace(/[0-9._-]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !['para', 'com', 'sem', 'item', 'mdf', 'mdp'].includes(w));
  if (words.length > 0) {
    let bestScore = 0;
    let bestProd: ProductItem | null = null;
    for (const p of database) {
      if ((p.category || '').toUpperCase() === 'MDF' || (p.category || '').toUpperCase() === 'MDP') continue;
      const pText = normalizeText(`${p.code} ${p.description} ${(p.subcodes || []).join(' ')}`);
      let score = 0;
      for (const w of words) {
        if (pText.includes(w)) score++;
      }
      if (score > bestScore && score >= 2) {
        bestScore = score;
        bestProd = p;
      }
    }
    if (bestProd && bestProd.unit_price > 0) {
      return { matched: true, name: bestProd.description, price: bestProd.unit_price, unit: bestProd.unit || 'UN', source: 'database', code: bestProd.code };
    }
  }

  return { matched: false, name: '', price: 0, unit: 'UN', source: 'catalog_acessorio' };
}

// Correspondência inteligente para processos de fabricação e mão de obra fixa
export function smartMatchMaoDeObra(
  code: string,
  description: string,
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG,
  database: ProductItem[] = DEFAULT_MATERIALS
): { matched: boolean; name: string; price: number; unit: string; code: string; source: 'catalog_maodeobra' | 'database' } {
  if (isEletrodomestico(code, description)) {
    return { matched: false, name: '', price: 0, unit: 'UN', code: '', source: 'catalog_maodeobra' };
  }

  const normText = normalizeText(`${code} ${description}`);

  // 1. Catálogo Mão de Obra Fixa
  const moCatalog = catalog['Mão de Obra Fixa'];
  const moItems = moCatalog && moCatalog.type === 'maodeobra' ? moCatalog.items : [];

  const findMo = (predicate: (name: string, desc: string) => boolean) => {
    return moItems.find(item => predicate(normalizeText(item.name), normalizeText(item.description || '')));
  };

  // Porta Reta
  if (normText.includes('porta reta') || (normText.includes('porta') && normText.includes('reta') && !normText.includes('cava'))) {
    const match = findMo(n => n.includes('porta reta')) || moItems.find(i => i.id === 'mo-1');
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: match.unit || 'UN', code: match.id, source: 'catalog_maodeobra' };
    }
  }

  // Porta Cava Horizontal
  if (normText.includes('porta cava') || (normText.includes('porta') && normText.includes('cava'))) {
    const match = findMo(n => n.includes('porta cava horizontal') || n.includes('porta cava')) || moItems.find(i => i.id === 'mo-2');
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: match.unit || 'UN', code: match.id, source: 'catalog_maodeobra' };
    }
  }

  // Frente Cava Horizontal
  if (normText.includes('frente cava') || (normText.includes('frente') && normText.includes('cava'))) {
    const match = findMo(n => n.includes('frente cava')) || moItems.find(i => i.id === 'mo-3');
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: match.unit || 'UN', code: match.id, source: 'catalog_maodeobra' };
    }
  }

  // Cava 45
  if (normText.includes('45') && normText.includes('cava')) {
    const match = findMo(n => n.includes('45')) || moItems.find(i => i.id === 'mo-4');
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: match.unit || 'UN', code: match.id, source: 'catalog_maodeobra' };
    }
  }

  // Montagem
  if (normText.includes('montagem')) {
    if (normText.includes('gaveta')) {
      const match = findMo(n => n.includes('gaveta'));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: match.unit || 'UN', code: match.id, source: 'catalog_maodeobra' };
      }
    }
    const match = findMo(n => n.includes('modulo') || n.includes('estrutural')) ||
                  findMo(n => n.includes('montagem') && !n.includes('gaveta')) ||
                  findMo(n => n.includes('montagem')) ||
                  moItems.find(i => i.id === 'mo-9');
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: match.unit || 'UN', code: match.id, source: 'catalog_maodeobra' };
    }
  }

  // Usinagem
  if (normText.includes('usinagem')) {
    const match = findMo(n => n.includes('usinagem')) || moItems.find(i => i.id === 'mo-6');
    if (match && match.price > 0) {
      return { matched: true, name: match.name, price: match.price, unit: match.unit || 'UN', code: match.id, source: 'catalog_maodeobra' };
    }
  }

  // Processo de Fabricação genérico
  if (normText.includes('processo de fabricacao') || normText.includes('processo de fabricação') || normText.includes('processo')) {
    for (const item of moItems) {
      const n = normalizeText(item.name);
      if (normText.includes(n)) {
        return { matched: true, name: item.name, price: item.price, unit: item.unit || 'UN', code: item.id, source: 'catalog_maodeobra' };
      }
    }
  }

  // 2. Busca no banco de dados de materiais com categoria MAO_DE_OBRA
  const dbMo = database.find(p => p.category === 'MAO_DE_OBRA' && (
    normText.includes(normalizeText(p.description)) ||
    normalizeCode(p.code) === normalizeCode(code)
  ));
  if (dbMo && dbMo.unit_price > 0) {
    return { matched: true, name: dbMo.description, price: dbMo.unit_price, unit: dbMo.unit || 'UN', code: dbMo.code, source: 'database' };
  }

  return { matched: false, name: '', price: 0, unit: 'UN', code: '', source: 'catalog_maodeobra' };
}

// Localiza o produto no banco cadastrado pelo código ou subcódigos
export function matchProduct(
  code: string,
  description: string,
  database: ProductItem[]
): { product: ProductItem | undefined; isSubcodeMatch: boolean } {
  const cleanCode = normalizeCode(code);
  const normDesc = normalizeText(description);

  if (!cleanCode && !normDesc) return { product: undefined, isSubcodeMatch: false };

  // 1. Busca exata por código principal
  if (cleanCode) {
    let found = database.find(p => normalizeCode(p.code) === cleanCode);
    if (found) return { product: found, isSubcodeMatch: false };

    // 2. Busca por subcódigos / apelidos
    const aliases = database.filter(p => p.subcodes?.some(sub => normalizeCode(sub) === cleanCode));
    if (aliases.length > 1) return { product: undefined, isSubcodeMatch: false };
    found = aliases[0];
    if (found) return { product: found, isSubcodeMatch: true };

    // 3. Busca por descrição contendo o código
    found = database.find(p => {
      const candidate = normalizeCode(p.code);
      return cleanCode.length >= 4 && candidate.length >= 4 && (normalizeText(p.description).includes(cleanCode) || cleanCode.includes(candidate));
    });
    if (found) return { product: found, isSubcodeMatch: false };
  }

  // 4. Busca por subcódigo ou código contido na descrição
  if (normDesc) {
    const found = database.find(p => {
      const pCode = normalizeCode(p.code);
      if (pCode && normDesc.includes(pCode)) return true;
      return p.subcodes && p.subcodes.some(sub => {
        const s = normalizeCode(sub);
        return s.length >= 4 && normDesc.includes(s);
      });
    });
    if (found) return { product: found, isSubcodeMatch: true };
  }

  return { product: undefined, isSubcodeMatch: false };
}

// Identifica se outro item do orçamento é semelhante (mesmo material de chapa ou mesma ferragem)
export function isSimilarPromobItem(
  target: { code: string; description: string; dimensions?: string; unit?: string; is_parent_module?: boolean; is_chapa?: boolean; category?: string; targetThickness?: string; unit_cost?: number; table_price?: number; found?: boolean; price_unlinked?: boolean },
  candidate: { id?: string; code: string; description: string; dimensions?: string; unit?: string; is_parent_module?: boolean; is_chapa?: boolean; category?: string; unit_cost?: number; table_price?: number; found?: boolean; price_unlinked?: boolean },
  isAccessoryTarget = false,
  onlyUnpriced = false
): boolean {
  if (candidate.is_parent_module) return false;

  // Eletrodomésticos NUNCA são similares a chapas, acessórios ou processos
  if (isEletrodomestico(candidate.code, candidate.description, candidate.category) ||
      isEletrodomestico(target.code, target.description, target.category)) {
    return false;
  }

  // Se solicitado apenas não precificados, pula quem já tem preço definido
  if (onlyUnpriced) {
    const hasPrice = (candidate.unit_cost !== undefined && candidate.unit_cost > 0) ||
      (candidate.table_price !== undefined && candidate.table_price > 0 && !candidate.price_unlinked);
    if (hasPrice) return false;
  }

  const tCode = normalizeCode(target.code);
  const cCode = normalizeCode(candidate.code);
  const tDesc = normalizeText(target.description);
  const cDesc = normalizeText(candidate.description);

  if (isAccessoryTarget) {
    if (tCode && cCode && tCode === cCode) return true;
    const families = [
      'dobradica', 'dobradiça',
      'corredica', 'corrediça', 'telescopica', 'telescópica',
      'puxador',
      'pistao', 'pistão',
      'cabideiro',
      'rodizio', 'rodízio',
      'parafuso',
      'ponteira'
    ];
    for (const fam of families) {
      const normFam = normalizeText(fam);
      if ((cCode.includes(normFam) || cDesc.includes(normFam)) && (tCode.includes(normFam) || tDesc.includes(normFam))) {
        const cMm = (candidate.code + ' ' + candidate.description).match(/\b(300|350|400|450|500|550)\b/);
        const tMm = (target.code + ' ' + target.description).match(/\b(300|350|400|450|500|550)\b/);
        if (cMm && tMm && cMm[1] !== tMm[1]) {
          continue;
        }
        return true;
      }
    }
    return tDesc === cDesc && tDesc.length > 3;
  }

  // Mão de Obra e Processos de Fabricação
  const isLaborTarget = tDesc.includes('processo') || tDesc.includes('porta reta') || tDesc.includes('porta cava') || tDesc.includes('frente cava') || tDesc.includes('usinagem') || tDesc.includes('mao de obra') || tDesc.includes('mão de obra');
  if (isLaborTarget) {
    if (tDesc.includes('porta reta') && (cDesc.includes('porta reta') || cCode.includes('porta reta'))) return true;
    if (tDesc.includes('porta cava') && (cDesc.includes('porta cava') || cCode.includes('porta cava'))) return true;
    if (tDesc.includes('frente cava') && (cDesc.includes('frente cava') || cCode.includes('frente cava'))) return true;
    if (tDesc.includes('usinagem') && (cDesc.includes('usinagem') || cCode.includes('usinagem'))) return true;
    return tCode === cCode || tDesc === cDesc;
  }

  // Chapas MDF/MDP e Caixaria
  const isTargetChapa = target.is_chapa || isChapa(target.code, target.description) || (target.unit || '').toUpperCase() === 'M2' || tDesc.includes('caixa');
  const isCandChapa = candidate.is_chapa || isChapa(candidate.code, candidate.description) || (candidate.unit || '').toUpperCase() === 'M2' || cDesc.includes('caixa');
  if (!isTargetChapa || !isCandChapa) return false;

  // Extração rigorosa de espessura (6mm, 15mm, 18mm, 25mm)
  const extractThick = (code: string, desc: string, explicitThick?: string, dim?: string): string => {
    if (explicitThick) return explicitThick.replace('mm', '');
    const combined = `${code} ${desc} ${dim || ''}`.toLowerCase();
    const m = combined.match(/\b(6|15|18|25)mm\b|\.(6|15|18|25)\./i);
    if (m) return m[1] || m[2];
    if (dim) {
      const nums = (dim.match(/[\d.,]+/g) || []).map(n => parseFloat(n.replace(',', '.')));
      if (nums.length === 3) {
        const minVal = Math.min(...nums);
        if ([6, 15, 18, 25].includes(minVal)) return String(minVal);
      }
    }
    if (combined.includes('fundo')) return '6';
    if (combined.includes('porta') || combined.includes('frente')) return '18';
    return '15';
  };

  const tThick = extractThick(target.code, target.description, (target as any).targetThickness, target.dimensions);
  const cThick = extractThick(candidate.code, candidate.description, undefined, candidate.dimensions);

  // Espessuras DEVEM bater rigorosamente! 15mm NUNCA pode ser vinculado a 6mm (fundo) ou 18mm (porta)!
  if (tThick !== cThick) {
    return false;
  }

  // Se o target for Caixaria (Caixa Armário, Caixa Balcão, Caixa Gaveta)
  const isTargetCaixa = tDesc.includes('caixa');
  const isCandCaixa = cDesc.includes('caixa');
  if (isTargetCaixa && isCandCaixa && tThick === cThick) {
    return true;
  }
  if (isTargetCaixa !== isCandCaixa) {
    // Não mistura caixarias com peças avulsas de corte, a menos que tenham o mesmo código/assinatura
    const tParts = tCode.split('.');
    const cParts = cCode.split('.');
    if (!(tParts.length >= 4 && cParts.length >= 4 && tParts.slice(2).join('.') === cParts.slice(2).join('.'))) {
      return false;
    }
  }

  // 1. Mesmo código exato
  if (tCode && cCode && tCode === cCode) return true;

  const extractSignature = (code: string) => {
    const parts = code.split('.');
    if (parts.length >= 4) {
      return parts.slice(2).join('.').toLowerCase();
    }
    return '';
  };
  const cSig = extractSignature(candidate.code);
  const tSig = extractSignature(target.code);
  if (cSig && tSig && cSig === tSig) {
    return true;
  }

  const finishes = ['branco', 'freijo', 'freijó', 'carmel', 'louro', 'noce', 'carvalho', 'grafite', 'preto', 'cinza', 'titanio', 'titânio', 'argila'];
  for (const fin of finishes) {
    const normFin = normalizeText(fin);
    if ((cCode.includes(normFin) || cDesc.includes(normFin)) && (tCode.includes(normFin) || tDesc.includes(normFin))) {
      return true;
    }
  }

  return false;
}

export interface PriceMatchResult {
  matched: boolean;
  source: 'database' | 'catalog_chapa' | 'catalog_acessorio' | 'mdf_padrao' | 'catalog_maodeobra' | 'promob_table';
  unit_cost: number;
  code: string;
  description: string;
  unit: string;
  brand?: string;
  line?: string;
  thickness?: string;
  board_price?: number;
  matched_name?: string;
}

// Resolvedor Universal de Preços: vincula chapas, acessórios, mão de obra e materiais da tabela DF Móveis
export function resolveItemPrice(
  item: {
    code: string;
    description: string;
    dimensions?: string;
    external_model?: string;
    catalog_override?: BudgetItem['catalog_override'];
    unit?: string;
    category?: string;
    is_parent_module?: boolean;
    has_children?: boolean;
    promob_xml?: boolean;
    promob_structure?: boolean;
    promob_description?: string;
    parentId?: string;
    is_chapa?: boolean;
    is_fita?: boolean;
    fita_metros?: number;
    table_price?: number;
  },
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG,
  database: ProductItem[] = DEFAULT_MATERIALS
): PriceMatchResult {
  // 0. Eletrodomésticos NUNCA possuem custo nem cobrança para o cliente/marcenaria
  if (isEletrodomestico(item.code, item.description, item.category)) {
    return {
      matched: true,
      source: 'database',
      unit_cost: 0,
      code: item.code,
      description: item.description,
      unit: item.unit || 'UN',
      matched_name: 'Eletrodoméstico (Informativo - Sem Cobrança)',
    };
  }

  // 1. Se o item já veio com preço de tabela do Promob (ou custo válido), vincula e preserva com prioridade
  if (item.table_price !== undefined && item.table_price > 0) {
    return {
      matched: true,
      source: 'promob_table',
      unit_cost: item.table_price,
      code: item.code,
      description: item.description,
      unit: item.unit || 'UN',
      matched_name: `Tabela Promob (${item.table_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
    };
  }

  // Pula apenas módulos pais agrupadores que não tenham preço definido
  const hardwareAssembly = /dobradica|corredica|pistao|parafuso/.test(normalizeText(item.description));
  if (item.is_parent_module || (item.has_children && !hardwareAssembly) || (item.promob_xml && classifyPromobItem(item) === 'MODULE')) {
    return {
      matched: false,
      source: 'database',
      unit_cost: 0,
      code: item.code,
      description: item.description,
      unit: item.unit || 'UN',
    };
  }

  if (item.catalog_override) {
    const selected = item.catalog_override;
    const brand = catalog[selected.brand];
    const line = brand?.type === 'brand' ? brand.lines.find(line => line.id === selected.line_id) : undefined;
    const price = line?.prices[selected.thickness];
    if (line && price && price > 0) return { matched: true, source: 'catalog_chapa', unit_cost: chapaSalePrice(price,line.width*line.height), code: item.code, description: item.description, unit: 'M2', brand: selected.brand, line: line.name, thickness: selected.thickness };
    return { matched: false, source: 'database', unit_cost: 0, code: item.code, description: item.description, unit: 'M2' };
  }

  const panel = xmlPanelDimensions(item);
  if (panel && item.external_model) {
    const thickness = panel[0];
    // An unlisted thickness is pending; never silently substitute 15mm or 18mm.
    if (![6,15,18,25,30].includes(thickness)) return { matched: false, source: 'database', unit_cost: 0, code: item.code, description: item.description, unit: 'M2' };
    const finish = /^(?:arauco[ .\\/_-]*)?branco(?:[ ._-]*tx)?$/.test(normalizeText(item.external_model)) ? 'Arauco Branco TX' : item.external_model;
    const match = smartMatchPromobChapa('', `MDF ${finish} espessura ${thickness}mm`, catalog, item.dimensions);
    if (match.matched && match.m2Cost > 0) return {
      matched: true, source: 'catalog_chapa', unit_cost: match.m2Cost, code: item.code,
      description: item.description, unit: 'M2', brand: match.brand || undefined,
      line: match.line || undefined, thickness: match.thickness, board_price: match.boardPrice,
      matched_name: `${match.brand} - ${match.line} (${match.thickness})`,
    };
    return { matched: false, source: 'database', unit_cost: 0, code: item.code, description: item.description, unit: 'M2' };
  }

  // 0. Verifica se é Processo de Fabricação / Mão de Obra Fixa (Porta Reta, Porta Cava, Frente Cava, etc.)
  const moMatch = smartMatchMaoDeObra(item.code, item.description, catalog, database);
  if (moMatch.matched && moMatch.price > 0) {
    return {
      matched: true,
      source: moMatch.source,
      unit_cost: moMatch.price,
      code: moMatch.code || item.code,
      description: item.description,
      unit: moMatch.unit || item.unit || 'UN',
      matched_name: moMatch.name,
    };
  }

  const direct = database.filter(p => normalizeCode(p.code) === normalizeCode(item.code) ||
    p.subcodes?.some(alias => normalizeCode(alias) === normalizeCode(item.code)));
  if (direct.length === 1 && direct[0].catalog_line_id) {
    const p = direct[0];
    const brand = p.catalog_brand ? catalog[p.catalog_brand] : undefined;
    const line = brand?.type === 'brand' ? brand.lines.find(l => l.id === p.catalog_line_id) : undefined;
    const boardPrice = p.catalog_thickness ? line?.prices[p.catalog_thickness] : null;
    if (line && boardPrice && boardPrice > 0) return { matched: true, source: 'catalog_chapa',
      unit_cost: chapaSalePrice(boardPrice, line.width * line.height), code: p.code,
      description: item.description, unit: 'M2', matched_name: p.description,
      brand: p.catalog_brand, line: line.name, thickness: p.catalog_thickness };
    return { matched: false, source: 'database', unit_cost: 0, code: p.code, description: item.description, unit: item.unit || p.unit };
  }
  if (direct.length === 1 && !(direct[0].unit_price > 0)) return { matched: false, source: 'database', unit_cost: 0, code: direct[0].code, description: item.description, unit: item.unit || direct[0].unit };
  if (direct.length === 1 && direct[0].unit_price > 0) {
    const p = direct[0];
    const meterTape = isFitaBorda(item.code, item.description) && item.unit === 'M';
    const meters = p.fita_metros || extractFitaMetros(p.description);
    const cost = meterTape && p.unit !== 'M' && meters ? round2(p.unit_price / meters) : p.unit_price;
    return { matched: true, source: 'database', unit_cost: cost, code: p.code, description: item.description,
      unit: meterTape ? 'M' : p.unit, matched_name: p.description };
  }
  if (direct.length > 1) return { matched: false, source: 'database', unit_cost: 0, code: item.code, description: item.description, unit: item.unit || 'UN' };

  const isChapaItem = isChapa(item.code, item.description) || (item.unit || '').toUpperCase() === 'M2';

  if (isChapaItem) {
    // 1. Tenta encontrar no catálogo de Chapas por marca e acabamento
    const smart = smartMatchPromobChapa(item.code, item.description, catalog, item.dimensions);
    if (smart.matched && smart.m2Cost > 0) {
      return {
        matched: true,
        source: 'catalog_chapa',
        unit_cost: smart.m2Cost,
        code: `${smart.brand?.toUpperCase()}-${smart.line?.toUpperCase().replace(/\s+/g, '_')}-${smart.thickness}`,
        description: item.description,
        unit: 'M2',
        brand: smart.brand || undefined,
        line: smart.line || undefined,
        thickness: smart.thickness,
        board_price: smart.boardPrice,
        matched_name: `${smart.brand} - ${smart.line} (${smart.thickness})`,
      };
    }

    const finishText = normalizeText(`${item.code} ${item.description}`);
    const explicitBrand = Object.entries(catalog).find(([brand, data]) =>
      data.type === 'brand' && data.authoritative && finishText.includes(normalizeText(brand)));
    if (explicitBrand) return { matched: false, source: 'catalog_chapa', unit_cost: 0,
      code: item.code, description: item.description, unit: item.unit || 'M2' };
    if (/branc[oa]\s*tx/.test(finishText)) {
      const explicit = finishText.match(/espessura\s+(\d+(?:[.,]\d+)?)\s*mm/)?.[1];
      const thickness = explicit || finishText.match(/(?:\.|\b)(6|15|18|25)(?:\.|\s*mm\b)/)?.[1];
      const white = database.filter(p => /branc[oa]\s*tx/.test(normalizeText(p.description)) &&
        (p.unit || '').toUpperCase() === 'M2' && thickness &&
        new RegExp(`\\b${thickness}\\s*mm\\b`).test(normalizeText(p.description)));
      if (white.length === 1 && white[0].unit_price > 0) return {
        matched: true, source: 'database', unit_cost: white[0].unit_price, code: white[0].code,
        description: item.description, unit: 'M2', matched_name: white[0].description,
      };
    }

    // 2. Busca direta no banco de materiais (por código principal ou subcódigo)
    const prodMatch = matchProduct(item.code, item.description, database);
    if (prodMatch.product && prodMatch.product.unit_price > 0) {
      return {
        matched: true,
        source: 'database',
        unit_cost: prodMatch.product.unit_price,
        code: prodMatch.product.code,
        description: item.description,
        unit: prodMatch.product.unit || 'M2',
        matched_name: prodMatch.product.description,
      };
    }

    // 3. Fallback: chapa sem marca, tenta padrão MDF Branco do database
    const raw = `${item.code} ${item.description}`.toLowerCase();
    let thicknessCode = '15';
    if (/\b6mm\b|\.6\./i.test(raw)) thicknessCode = '06';
    else if (/\b18mm\b|\.18\./i.test(raw)) thicknessCode = '18';
    else if (/\b25mm\b|\.25\./i.test(raw)) thicknessCode = '25';

    const dbMdf = database.find(p => p.code === `MDF-BRANCO-${thicknessCode}`) ||
                  database.find(p => p.code === 'MDF-BRANCO-15');
    if (dbMdf && dbMdf.unit_price > 0 && /branc[oa]/i.test(raw) && !/branc[oa][\s._-]*(?:tx|texturizad[oa])/i.test(raw)) {
      return {
        matched: true,
        source: 'mdf_padrao',
        unit_cost: dbMdf.unit_price,
        code: dbMdf.code,
        description: item.description,
        unit: 'M2',
        matched_name: dbMdf.description,
      };
    }
  }

  // 1. Busca direta no banco de materiais (por código principal ou subcódigo)
  const prodMatch = matchProduct(item.code, item.description, database);
  if (prodMatch.product && prodMatch.product.unit_price > 0) {
    return {
      matched: true,
      source: 'database',
      unit_cost: prodMatch.product.unit_price,
      code: prodMatch.product.code,
      description: item.description,
      unit: prodMatch.product.unit || item.unit || 'UN',
      matched_name: prodMatch.product.description,
    };
  }

  // 2. Se for ferragem / acessório / fita, busca nos Acessórios do catálogo e no banco
  const accessory = smartMatchAccessory(item.code, item.description, item.dimensions, catalog, database);
  if (accessory.matched && accessory.price > 0) {
    let unitCost = accessory.price;
    if (isFitaBorda(item.code, item.description) && (item.unit || '').toUpperCase() === 'M' && accessory.unit !== 'M') {
      const fitaMetros = extractFitaMetros(accessory.name) || extractFitaMetros(item.description) || 20;
      if (fitaMetros > 0) unitCost = round2(accessory.price / fitaMetros);
    }
    return {
      matched: true,
      source: accessory.source === 'catalog_acessorio' ? 'catalog_acessorio' : 'database',
      unit_cost: unitCost,
      code: accessory.code || item.code,
      description: item.description,
      unit: isFitaBorda(item.code, item.description) && (item.unit || '').toUpperCase() === 'M' ? 'M' : accessory.unit || item.unit || 'UN',
      matched_name: accessory.name,
    };
  }

  return {
    matched: false,
    source: 'database',
    unit_cost: 0,
    code: item.code,
    description: item.description,
    unit: item.unit || 'UN',
  };
}

// Promob panels may arrive in UN with the finish only in MODEL/REFERENCE.
// Convert pieces to m² once, preserving the original export consumption for recalculation.
function xmlPanelDimensions(item: { dimensions?: string; description?: string; category?: string; promob_xml?: boolean }): number[] | null {
  if (!item.promob_xml || /processo|mao de obra|fabrica/.test(normalizeText(`${item.description || ''} ${item.category || ''}`))) return null;
  if (/dobradica|corredica|parafuso|pistao|puxador|ponteira|fita/.test(normalizeText(item.description || ''))) return null;
  const dims = (item.dimensions || '').split(/\s*[x×]\s*/i).map(n => Number(n.trim().replace(',', '.'))).sort((a,b) => a-b);
  return dims.length === 3 && dims.every(n => Number.isFinite(n) && n > 0) && dims[0] <= 30 && dims[1] > 30 ? dims : null;
}

// Calcula preços e totais de um item individual
export function calculateItemPrice(
  item: {
    id?: string;
    item_number?: number;
    code: string;
    description: string;
    quantity: number;
    unit?: string;
    original_unit?: string;
    catalog_override?: BudgetItem['catalog_override'];
    unit_cost?: number;
    margin?: number;
    margin_override?: boolean;
    price_unlinked?: boolean;
    rep?: number;
    unit_quantity?: number;
    dimensions?: string;
    category?: string;
    external_model?: string;
    table_price?: number;
    final_price?: number;
    price_origin?: 'calculated' | 'imported' | 'manual';
    is_processo?: boolean;
    is_mao_de_obra?: boolean;
    is_parent_module?: boolean;
    has_children?: boolean;
    promob_xml?: boolean;
    promob_structure?: boolean;
    promob_description?: string;
    parentId?: string;
    is_chapa?: boolean;
    is_fita?: boolean;
    fita_metros?: number;
  },
  database: ProductItem[] = DEFAULT_MATERIALS,
  settings: BudgetSettings,
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG
): BudgetItem {
  const isAppliance = isEletrodomestico(item.code, item.description, item.category);

  // Resolve correspondência e preço de tabela automático se não estiver desvinculado nem for eletrodoméstico
  const resolved = (!item.price_unlinked && !isAppliance)
    ? resolveItemPrice(
        {
          code: item.code,
          description: item.description,
          dimensions: item.dimensions,
          external_model: item.external_model,
          catalog_override: item.catalog_override,
          promob_xml: item.promob_xml,
          unit: item.unit,
          category: item.category,
          is_parent_module: item.is_parent_module,
          has_children: item.has_children,
          is_chapa: item.is_chapa,
          is_fita: item.is_fita,
          fita_metros: item.fita_metros,
          table_price: item.table_price,
        },
        catalog,
        database
      )
    : null;

  const found = isAppliance || (!item.price_unlinked && (
    (resolved ? resolved.matched : false) ||
    (item.table_price !== undefined && item.table_price > 0)
  ));

  const isItemChapa = !isAppliance && (resolved?.source === 'catalog_chapa' || (item.is_chapa !== undefined
    ? item.is_chapa
    : (resolved?.source === 'mdf_padrao' || isChapa(item.code, item.description))));
  const isItemFita = !isAppliance && (item.is_fita !== undefined
    ? item.is_fita
    : isFitaBorda(item.code, item.description));

  // Quantidade efetiva e unidade:
  let effectiveQuantity = item.quantity;
  if (item.rep !== undefined && item.unit_quantity !== undefined && item.rep > 0 && item.unit_quantity > 0) {
    effectiveQuantity = round4(item.rep * item.unit_quantity);
  } else if (!effectiveQuantity || effectiveQuantity <= 0) {
    effectiveQuantity = 1;
  }
  effectiveQuantity = round4(effectiveQuantity);

  let displayUnit = resolved?.unit || item.unit || 'UN';
  const panelDims = xmlPanelDimensions(item);
  if (panelDims && resolved?.unit === 'M2' && (item.original_unit || item.unit || 'UN').toUpperCase() === 'UN') {
    effectiveQuantity = round4(effectiveQuantity * panelDims[1] * panelDims[2] / 1_000_000);
  }


  // Importante: NÃO converte peças de corte Promob (com m² quebrado, rep ou dimensões) para chapa inteira!
  const isPromobCutPiece = !!item.dimensions || (item.rep !== undefined && item.rep > 0) || (displayUnit.toUpperCase() === 'M2' && effectiveQuantity < CHAPA_AREA_M2);

  if (!isPromobCutPiece && isItemChapa && settings.chapa_mode === 'chapa' && displayUnit.toUpperCase() === 'M2') {
    const chapasCount = effectiveQuantity / CHAPA_AREA_M2;
    if (settings.chapa_rounding === 'up') {
      effectiveQuantity = Math.ceil(chapasCount);
    } else if (settings.chapa_rounding === 'down') {
      effectiveQuantity = Math.floor(chapasCount);
    } else {
      effectiveQuantity = round2(chapasCount);
    }
    displayUnit = 'CHAPA';
  }

  // Custo base unitário (preço tabela do Promob ou catálogo)
  let unit_cost = 0;
  if (isAppliance) {
    unit_cost = 0;
  } else if (item.price_unlinked) {
    unit_cost = item.unit_cost !== undefined ? item.unit_cost : 0;
  } else if (item.unit_cost !== undefined && item.unit_cost > 0) {
    unit_cost = item.unit_cost;
  } else if (resolved && resolved.matched && resolved.unit_cost > 0) {
    unit_cost = resolved.unit_cost;
  } else if (item.table_price !== undefined && item.table_price >= 0) {
    unit_cost = item.table_price;
  }

  const fitaMetros = item.fita_metros || extractFitaMetros(item.description) || 20;

  // Se for Fita de Borda em rolo e a lista vier em metros lineares (M):
  if (isItemFita && fitaMetros > 0 && displayUnit.toUpperCase() === 'M' && unit_cost > 0 && !resolved?.matched && !item.table_price) {
    if (unit_cost > 10) {
      unit_cost = round2(unit_cost / fitaMetros);
    }
  }

  // Preço de venda, custo total e margem
  let unit_price = 0;
  let total_cost = 0;
  let total_price = 0;
  let marginPercent = 0;

  if (isAppliance) {
    unit_cost = 0;
    unit_price = 0;
    total_cost = 0;
    total_price = 0;
    marginPercent = 0;
  } else if (item.price_origin !== 'calculated' && item.final_price !== undefined && item.final_price > 0 && effectiveQuantity > 0) {
    total_cost = round2(unit_cost * effectiveQuantity);
    total_price = round2(item.final_price);
    unit_price = round2(total_price / effectiveQuantity);
    marginPercent = total_cost > 0
      ? round2(((total_price - total_cost) / total_cost) * 100)
      : (Number(item.margin !== undefined ? item.margin : settings.margin) || 0);
  } else {
    marginPercent = Math.max(0, Number(item.margin !== undefined ? item.margin : settings.margin) || 0);
    const additionsFactor = calculateAdditionsFactor(settings);
    const priceWithMargin = unit_cost * (1 + marginPercent / 100);
    unit_price = round2(priceWithMargin * additionsFactor);
    total_cost = round2(unit_cost * effectiveQuantity);
    total_price = round2(unit_price * effectiveQuantity);
  }

  let finalDescription = item.description;
  if (!isAppliance) {
    if (resolved && resolved.matched && resolved.source === 'catalog_chapa' && resolved.brand && resolved.line) {
      if (!finalDescription.includes(`[${resolved.brand}`)) {
        finalDescription = `${item.description} [${resolved.brand} - ${resolved.line} ${resolved.thickness}]`;
      }
    } else if (resolved && resolved.matched && resolved.matched_name && resolved.source !== 'database') {
      if (!finalDescription.includes(`(${resolved.matched_name})`)) {
        finalDescription = `${item.description} (${resolved.matched_name})`;
      }
    }
  }

  return {
    id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
    item_number: item.item_number !== undefined ? item.item_number : 1,
    code: item.code, // Mantém SEMPRE o código original do item Promob
    description: finalDescription,
    quantity: effectiveQuantity,
    unit: displayUnit,
    unit_cost,
    margin: marginPercent,
    margin_override: item.margin_override,
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
    original_unit: item.original_unit || item.unit,
    resolved_from_subcode: resolved ? resolved.matched : false,
    rep: item.rep,
    unit_quantity: item.unit_quantity,
    dimensions: item.dimensions,
    category: isAppliance ? 'Eletrodomésticos' : item.category,
    external_model: item.external_model,
    table_price: isAppliance ? 0 : (item.table_price !== undefined ? item.table_price : unit_cost),
    final_price: isAppliance ? 0 : (item.price_origin !== 'calculated' ? item.final_price : undefined),
    price_origin: item.price_origin || (item.final_price !== undefined ? 'imported' : 'calculated'),
    is_parent_module: item.is_parent_module,
    has_children: item.has_children,
    promob_xml: item.promob_xml,
    promob_structure: item.promob_structure,
    promob_description: item.promob_description,
    parentId: item.parentId,
    catalog_override: item.catalog_override,
    catalog_match: resolved?.matched ? { source: resolved.source, code: resolved.code, brand: resolved.brand, line: resolved.line } : undefined,
  };
}

// Classifica o item do Promob em sua categoria hierárquica oficial
export function classifyPromobItem(
  item: {
    code?: string;
    description?: string;
    dimensions?: string;
    unit?: string;
    promob_xml?: boolean;
    category?: string;
    is_parent_module?: boolean;
    has_children?: boolean;
    is_processo?: boolean;
    is_mao_de_obra?: boolean;
  },
  activeParentModule?: BudgetItem | null
): ItemCategory {
  const normDesc = normalizeText(item.description || '');
  const normRef = normalizeCode(item.code || '');
  const normCat = normalizeText(item.category || '');

  // 1. INFORMATIONAL: Eletrodomésticos & Equipamentos (sem cobrança industrial / comercial de marcenaria)
  if (isEletrodomestico(item.code, item.description, item.category) || normCat.includes('eletro')) {
    return 'INFORMATIONAL';
  }

  // 2. MANUFACTURING_PROCESS: Mão de obra e serviços adicionais cobrados separadamente (Porta Reta, Frente Cava, etc.)
  if (
    item.is_processo ||
    item.is_mao_de_obra ||
    normCat.includes('processo') ||
    normCat.includes('mao de obra') ||
    normDesc.includes('processo de fabricacao') ||
    normRef.startsWith('proc_')
  ) {
    return 'MANUFACTURING_PROCESS';
  }

  // 3. ACCESSORY: Ferragens e acessórios avulsos (Dobradiça, Pistão, Corrediça, Puxador, etc.)
  const isHardware =
    normCat.includes('acessorio') ||
    normCat.includes('ferragem') ||
    normCat.includes('hettich') ||
    normCat.includes('wurth') ||
    normCat.includes('blum') ||
    normCat.includes('fgv') ||
    ['dobradica', 'corredica', 'pistao', 'lift advanced', 'puxador', 'cantoneira', 'parafuso', 'ponteira', 'articulador'].some(k => normDesc.includes(k));

  if (isHardware && !item.is_parent_module) {
    return 'ACCESSORY';
  }

  // 4. EXTERNAL_ITEM: Tamponamentos, molduras e painéis externos avulsos (não são caixaria interna de módulo)
  const isTrimOrCladding =
    normCat.includes('tamponamento') ||
    normCat.includes('moldura') ||
    normCat.includes('acabamento') ||
    normDesc.includes('tamponamento') ||
    normDesc.includes('moldura');

  if (isTrimOrCladding) {
    return 'EXTERNAL_ITEM';
  }

  // 5. SUBMODULE: Caixarias e submódulos intermediários internos de um móvel (Caixa Armário, Caixa Gaveta, Balcão 1 Div, etc.)
  const isSub =
    ['caixa armario', 'caixa gaveta', 'balcao 1 div', 'balcao gav/pia'].some(k => normDesc.includes(k)) ||
    (normDesc.includes('caixa') && !normDesc.includes('ferramenta'));

  if (isSub) {
    return 'SUBMODULE';
  }

  // 6. MODULE: Móvel principal / módulo pai (Torre, Armário, Balcão, Paneleiro, etc.)
  const isUnitUN = (item.unit || 'UN').toUpperCase() === 'UN';
  const hasModuleKeyword = ['armario', 'balcao', 'torre', 'paneleiro', 'gaveteiro', 'nicho', 'modulo'].some(k => normDesc.includes(k));
  const hasModuleRef = normRef.startsWith('4.');

  // Verifica se as dimensões são de móvel 3D montado (largura x altura x profundidade onde todos são > 100mm e não uma chapa fina)
  let is3DAssembly = false;
  if (item.dimensions) {
    const parts = item.dimensions.split('x').map(s => parseFloat(s.trim().replace(',', '.')));
    if (parts.length === 3) {
      const isPlate = (parts[1] === 6 || parts[1] === 15 || parts[1] === 18 || parts[1] === 25) && (parts[0] > 100 && parts[2] > 100);
      is3DAssembly = !isPlate && parts[0] > 150 && parts[1] > 150 && parts[2] > 150;
    }
  }

  if (item.is_parent_module || ((hasModuleKeyword || hasModuleRef || is3DAssembly) && (isUnitUN || item.promob_xml) && !isSub)) {
    return 'MODULE';
  }

  // 7. CUT_PART: Peça de corte interna (Base, Fundo, Lateral, Prateleira, Divisória, Porta Reta física, etc.)
  return 'CUT_PART';
}

// Structured XML quantities already describe the exported consumption. Aggregate
// recursively by actual IDs, never by whichever row happened to precede a part.
function calculateStructuredXml(items: BudgetItem[], database: ProductItem[], settings: BudgetSettings, catalog: CatalogByBrand) {
  const ids = new Set(items.map(item => item.id));
  if (ids.size !== items.length) throw new Error('O XML contém identificadores de peças duplicados.');
  const nodes = items.map(original => {
    const automatic = original.price_origin === 'calculated' && !original.price_unlinked;
    const xml = original.promob_xml || Boolean(original.external_model && original.original_code && original.price_origin === 'calculated');
    const description = original.promob_description || original.description.replace(/\s*\[[^\]]+\]|\s*\(Tabela Promob \(.*?\)\)/g, '').trim();
    const updated = calculateItemPrice({ ...original,
      promob_xml: xml,
      promob_description: description,
      description,
      unit: original.original_unit || original.unit,
      ...(automatic ? { unit_cost: undefined, table_price: undefined, final_price: undefined } : {}),
    }, database, settings, catalog);
    return { ...updated, parentId: original.parentId, promob_xml: xml,
      promob_structure: original.promob_structure, promob_description: description,
      itemCategory: classifyPromobItem(updated), saleIncluded: !original.parentId || !ids.has(original.parentId),
      productionCost: updated.total_cost, salePrice: updated.total_price };
  });
  const children = new Map<string, typeof nodes>();
  for (const node of nodes) if (node.parentId && ids.has(node.parentId)) {
    const list = children.get(node.parentId) || []; list.push(node); children.set(node.parentId, list);
  }
  const visiting = new Set<string>(), completed = new Set<string>();
  const visit = (node: typeof nodes[number]) => {
    if (completed.has(node.id)) return;
    if (visiting.has(node.id)) throw new Error('O XML contém uma relação circular entre móveis e peças.');
    visiting.add(node.id);
    const descendants = children.get(node.id) || [];
    descendants.forEach(visit);
    if (descendants.length) {
      const childCost = round2(descendants.reduce((sum, child) => sum + child.productionCost, 0));
      const childSale = round2(descendants.reduce((sum, child) => sum + child.salePrice, 0));
      const ownPrice = (node.price_origin !== 'calculated' && ((node.final_price || 0) > 0 || (node.table_price || 0) > 0 || (node.price_origin === 'manual' && node.unit_cost > 0))) ||
        (classifyPromobItem(node) === 'ACCESSORY' && Boolean(node.catalog_match) && node.total_price > 0);
      node.productionCost = ownPrice ? node.total_cost : childCost || node.total_cost;
      node.salePrice = ownPrice ? node.total_price : childSale;
      node.total_cost = node.productionCost;
      node.total_price = node.salePrice;
      node.unit_cost = node.quantity > 0 ? round2(node.total_cost / node.quantity) : 0;
      node.unit_price = node.quantity > 0 ? round2(node.total_price / node.quantity) : 0;
      node.has_children = true;
    }
    visiting.delete(node.id); completed.add(node.id);
  };
  nodes.forEach(visit);
  const roots = nodes.filter(node => node.saleIncluded);
  const total_cost = round2(roots.reduce((sum, node) => sum + node.total_cost, 0));
  const total_price = round2(roots.reduce((sum, node) => sum + node.total_price, 0));
  const gross_profit = round2(total_price - total_cost);
  return { items: nodes, totals: { total_cost, total_price, gross_profit,
    profit_margin_percent: total_price > 0 ? round2(gross_profit / total_price * 100) : 0,
    items_count: structuredModuleGroups(nodes).length } };
}

function structuredModuleGroups(items: BudgetItem[]): ModuleGroup[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const groups = new Map<string, ModuleGroup>();
  const rootGroups = new Map<string, string>();
  for (const root of items.filter(item => !item.parentId || !byId.has(item.parentId))) {
    const key = JSON.stringify([root.environment_id, root.code, root.promob_description || root.description,
      root.dimensions?.replace(/\s+/g, ''), root.external_model, root.unit, root.category]);
    let group = groups.get(key);
    if (!group) {
      group = { id: `xml-group-${root.id}`, name: root.promob_description || root.description, category: root.category,
        dimensions: root.dimensions, piecesCount: 0, totalCost: 0, totalPrice: 0, subtotal_cost: 0,
        subtotal_price: 0, total_pieces: 0, items: [], parent_item: { ...root, quantity: 0 },
        is_hardware_only: classifyPromobItem(root) === 'ACCESSORY' };
      groups.set(key, group);
    }
    rootGroups.set(root.id, key);
    group.parent_item!.quantity += root.quantity;
    group.totalCost = round2(group.totalCost + root.total_cost);
    group.totalPrice = round2(group.totalPrice + root.total_price);
    group.subtotal_cost = group.totalCost; group.subtotal_price = group.totalPrice;
    group.piecesCount += root.quantity;
  }
  for (const item of items) {
    let root = item;
    const visited = new Set<string>();
    while (root.parentId && byId.has(root.parentId)) {
      if (visited.has(root.id)) throw new Error('Hierarquia circular no orçamento.');
      visited.add(root.id); root = byId.get(root.parentId)!;
    }
    const group = groups.get(rootGroups.get(root.id)!);
    if (group) { group.items.push(item); group.total_pieces++; }
  }
  return [...groups.values()];
}

// MOTOR CENTRAL DE PRECIFICAÇÃO HIERÁRQUICA DO PROMOB
export function calculatePricingTree(
  items: BudgetItem[],
  database: ProductItem[] = DEFAULT_MATERIALS,
  settings: BudgetSettings,
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG
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
  if (items.some(item => item.promob_xml)) return calculateStructuredXml(items, database, settings, catalog);

  const additionsFactor = calculateAdditionsFactor(settings);
  const marginPercent = Math.max(0, Number(settings.margin !== undefined ? settings.margin : 200));

  // 1. Identifica hierarquia pai-filho e categorias estruturais
  let currentParentModule: BudgetItem | null = null;
  const categorized = items.map((original, idx) => {
    const it = { ...original, margin: original.margin_override ? original.margin : settings.margin, ...(original.price_origin === 'calculated' ? { final_price: undefined } : {}) };
    const category: ItemCategory = it.itemCategory || classifyPromobItem(it, currentParentModule);

    if (category === 'MODULE') {
      currentParentModule = it;
    } else if (
      category === 'MANUFACTURING_PROCESS' ||
      category === 'EXTERNAL_ITEM' ||
      category === 'INFORMATIONAL'
    ) {
      currentParentModule = null;
    }

    const isChildComponent = category === 'CUT_PART' || category === 'SUBMODULE';
    const parentId = it.parentId || ((currentParentModule && isChildComponent)
      ? (currentParentModule.id || String(currentParentModule.item_number || idx))
      : (isChildComponent ? it.parentId : undefined));

    return {
      ...it,
      itemCategory: category,
      parentId,
      is_parent_module: category === 'MODULE',
    };
  });

  // 2. Calcula custos industriais, preços comerciais e auditoria
  const recalculatedItems: BudgetItem[] = categorized.map((it, idx) => {
    const isAppliance = it.itemCategory === 'INFORMATIONAL' || isEletrodomestico(it.code, it.description, it.category);

    // Resolve base unitária do item
    const updated = calculateItemPrice(
      {
        code: it.original_code || it.code,
        description: it.description,
        quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
        unit: it.original_unit || it.unit,
        unit_cost: isAppliance ? 0 : it.unit_cost,
        margin: isAppliance ? 0 : it.margin,
        margin_override: it.margin_override,
        price_unlinked: it.price_unlinked,
        rep: it.rep,
        unit_quantity: it.unit_quantity,
        dimensions: it.dimensions,
        category: isAppliance ? 'Eletrodomésticos' : it.category,
        external_model: it.external_model,
        table_price: isAppliance ? 0 : (it.price_unlinked ? 0 : it.table_price),
        final_price: isAppliance ? 0 : (it.price_unlinked ? undefined : it.final_price),
        price_origin: it.price_origin,
        is_parent_module: it.is_parent_module,
        has_children: it.has_children,
        is_chapa: it.is_chapa,
        is_fita: it.is_fita,
        fita_metros: it.fita_metros,
      },
      database,
      settings,
      catalog
    );

    const effectiveQuantity = updated.quantity || 1;
    let productionCost = 0;
    let salePrice = 0;
    let saleIncluded = false;
    let pricingRule = '';

    if (isAppliance) {
      productionCost = 0;
      salePrice = 0;
      saleIncluded = false;
      pricingRule = 'INFORMATIONAL_NO_CHARGE';
    } else if (it.price_unlinked) {
      productionCost = round2((it.unit_cost !== undefined ? it.unit_cost : updated.unit_cost) * effectiveQuantity);
      salePrice = round2((it.unit_price !== undefined ? it.unit_price : updated.unit_price) * effectiveQuantity);
      saleIncluded = !it.parentId || (it.itemCategory !== 'CUT_PART' && it.itemCategory !== 'SUBMODULE');
      pricingRule = 'MANUALLY_OVERRIDDEN';
    } else {
      switch (it.itemCategory) {
        case 'MODULE': {
          // Preço comercial do módulo no Promob
          if (it.final_price !== undefined && it.final_price > 0) {
            salePrice = round2(it.final_price);
          } else if (it.table_price !== undefined && it.table_price > 0) {
            salePrice = round2(it.table_price * effectiveQuantity * (1 + marginPercent / 100) * additionsFactor);
          } else {
            salePrice = updated.total_price;
          }
          // Custo industrial de produção
          productionCost = round2((it.table_price !== undefined && it.table_price > 0)
            ? it.table_price * effectiveQuantity
            : updated.total_cost);
          saleIncluded = true;
          pricingRule = 'PROMOB_MODULE_PRICE';
          break;
        }

        case 'SUBMODULE': {
          // Submódulo dentro do móvel pai: não entra na proposta comercial novamente
          productionCost = round2((it.table_price !== undefined && it.table_price > 0)
            ? it.table_price * effectiveQuantity
            : updated.total_cost);
          salePrice = 0;
          saleIncluded = false;
          pricingRule = 'INCLUDED_IN_PARENT_MODULE';
          break;
        }

        case 'CUT_PART': {
          // Peça de corte interna: se pertence a um módulo, não entra na proposta comercial novamente
          productionCost = round2((it.table_price !== undefined && it.table_price > 0)
            ? it.table_price * effectiveQuantity
            : (it.total_cost !== undefined && it.total_cost > 0)
              ? (it.price_origin === 'calculated' ? updated.total_cost : it.total_cost)
              : updated.total_cost);

          if (it.parentId) {
            salePrice = 0;
            saleIncluded = false;
            pricingRule = 'INCLUDED_IN_PARENT_MODULE';
          } else {
            // Peça avulsa fora de módulo
            if (it.final_price !== undefined && it.final_price > 0) {
              salePrice = round2(it.final_price);
            } else {
              const itemMargin = it.margin !== undefined ? it.margin : marginPercent;
              salePrice = round2(productionCost * (1 + itemMargin / 100) * additionsFactor);
            }
            saleIncluded = true;
            pricingRule = 'STANDALONE_CUT_PART';
          }
          break;
        }

        case 'ACCESSORY': {
          // Acessórios e ferragens: preço comercial próprio (do operador ou tabela), sem margem global de +200%
          const unitBase = (it.table_price !== undefined && it.table_price > 0)
            ? it.table_price
            : (it.unit_cost !== undefined && it.unit_cost > 0)
              ? it.unit_cost
              : (updated.unit_cost || 0);

          productionCost = round2((it.price_origin !== 'calculated' && it.total_cost !== undefined && it.total_cost > 0 && it.total_cost !== it.total_price)
            ? it.total_cost
            : unitBase * effectiveQuantity);

          if (it.final_price !== undefined && it.final_price > 0) {
            salePrice = round2(it.final_price);
          } else if (it.price_origin !== 'calculated' && it.total_price !== undefined && it.total_price > 0 && it.total_price !== it.total_cost) {
            salePrice = round2(it.total_price);
          } else if (it.price_origin !== 'calculated' && it.unit_price !== undefined && it.unit_price > 0) {
            salePrice = round2(it.unit_price * effectiveQuantity);
          } else {
            salePrice = productionCost;
          }
          saleIncluded = salePrice > 0 || productionCost > 0;
          pricingRule = 'PROMOB_ACCESSORY_PRICE';
          break;
        }

        case 'MANUFACTURING_PROCESS': {
          // Serviços de fabricação adicionais (Porta Reta, Frente Cava, Porta Cava)
          if (it.final_price !== undefined && it.final_price > 0) {
            salePrice = round2(it.final_price);
          } else if (it.price_origin !== 'calculated' && it.total_price !== undefined && it.total_price > 0) {
            salePrice = round2(it.total_price);
          } else {
            const unitServ = it.table_price || updated.unit_cost || 70;
            salePrice = round2(unitServ * effectiveQuantity * 3);
          }
          productionCost = round2((it.table_price !== undefined && it.table_price > 0)
            ? it.table_price * effectiveQuantity
            : (it.price_origin !== 'calculated' && it.total_cost !== undefined && it.total_cost > 0)
              ? it.total_cost
              : round2(salePrice / 3));
          saleIncluded = true;
          pricingRule = 'MANUFACTURING_SERVICE_PRICE';
          break;
        }

        case 'EXTERNAL_ITEM': {
          // Tamponamentos e molduras avulsas
          if (it.final_price !== undefined && it.final_price > 0) {
            salePrice = round2(it.final_price);
            productionCost = round2((it.table_price !== undefined && it.table_price > 0 && it.table_price < it.final_price)
              ? it.table_price * effectiveQuantity
              : (it.total_cost !== undefined && it.total_cost > 0)
                ? it.total_cost
                : salePrice / 3);
          } else if (it.price_origin !== 'calculated' && it.total_price !== undefined && it.total_price > 0 && it.total_price !== it.total_cost) {
            salePrice = round2(it.total_price);
            productionCost = round2(it.total_cost || (salePrice / 3));
          } else {
            const uCost = it.table_price || updated.unit_cost || 0;
            productionCost = round2((it.price_origin !== 'calculated' && it.total_cost !== undefined && it.total_cost > 0) ? it.total_cost : uCost * effectiveQuantity);
            salePrice = round2(productionCost * (1 + marginPercent / 100) * additionsFactor);
          }
          saleIncluded = true;
          pricingRule = 'PROMOB_EXTERNAL_PANEL_PRICE';
          break;
        }
      }
    }

    const audit: PricingAudit = {
      id: it.id || `item-${idx + 1}`,
      description: it.description,
      category: it.itemCategory || 'CUT_PART',
      parentId: it.parentId,
      productionCost,
      salePrice,
      saleIncluded,
      pricingRule,
    };

    return {
      ...updated,
      id: it.id || `item-${idx + 1}`,
      item_number: it.item_number || idx + 1,
      code: it.code,
      itemCategory: it.itemCategory,
      parentId: it.parentId,
      environment_id: it.environment_id,
      productionCost,
      salePrice,
      saleIncluded,
      pricingAudit: audit,
      total_cost: productionCost,
      total_price: salePrice,
      unit_cost: effectiveQuantity > 0 ? round2(productionCost / effectiveQuantity) : 0,
      unit_price: (saleIncluded && effectiveQuantity > 0) ? round2(salePrice / effectiveQuantity) : 0,
      table_price: isAppliance ? 0 : (it.table_price !== undefined ? it.table_price : updated.unit_cost),
      final_price: isAppliance ? 0 : it.final_price,
      price_origin: it.price_origin || (it.final_price !== undefined ? 'imported' : 'calculated'),
    };
  });

  // Se um módulo pai tiver peças filhas (CUT_PART e SUBMODULE), seu custo industrial de materiais é a soma delas
  for (const it of recalculatedItems) {
    if (it.itemCategory === 'MODULE') {
      const children = recalculatedItems.filter(child =>
        (child.parentId === it.id || child.parentId === String(it.item_number)) &&
        (child.itemCategory === 'CUT_PART' || child.itemCategory === 'SUBMODULE')
      );
      const childrenCost = round2(children.reduce((acc, c) => acc + (c.productionCost || 0), 0));
      if (childrenCost > 0) {
        it.productionCost = childrenCost;
        it.total_cost = childrenCost;
        it.unit_cost = childrenCost;
      }
      if (it.salePrice === 0 && (it.productionCost || 0) > 0) {
        const childrenSale = round2(children.reduce((acc, c) => acc + (c.salePrice || 0), 0));
        it.salePrice = childrenSale > 0 ? childrenSale : round2((it.productionCost || 0) * (1 + marginPercent / 100) * additionsFactor);
        it.total_price = it.salePrice;
        it.unit_price = it.salePrice;
      }
      if (it.pricingAudit) {
        it.pricingAudit.productionCost = it.productionCost || 0;
        it.pricingAudit.salePrice = it.salePrice || 0;
      }
    }
  }

  // 3. Totais globais
  const hasModules = recalculatedItems.some(it => it.itemCategory === 'MODULE');
  const hasExplicitFinalPrices = recalculatedItems.some(
    it => it.final_price !== undefined && it.final_price > 0 && it.final_price !== it.total_cost
  );

  let total_cost = 0;
  if (hasModules) {
    total_cost = round2(
      recalculatedItems
        .filter(it =>
          it.itemCategory === 'MODULE' ||
          it.itemCategory === 'ACCESSORY' ||
          it.itemCategory === 'MANUFACTURING_PROCESS' ||
          it.itemCategory === 'EXTERNAL_ITEM' ||
          (it.itemCategory === 'CUT_PART' && !it.parentId)
        )
        .reduce((acc, curr) => acc + (curr.productionCost || 0), 0)
    );
  } else {
    total_cost = round2(
      recalculatedItems
        .filter(it => it.itemCategory !== 'INFORMATIONAL')
        .reduce((acc, curr) => acc + (curr.productionCost || 0), 0)
    );
  }

  let total_price = 0;
  let gross_profit = 0;

  if (hasExplicitFinalPrices || hasModules) {
    total_price = round2(
      recalculatedItems
        .filter(it => it.saleIncluded)
        .reduce((acc, curr) => acc + (curr.salePrice || 0), 0)
    );
    gross_profit = round2(total_price - total_cost);
  } else {
    total_price = round2(recalculatedItems.filter(it => it.saleIncluded).reduce((acc, it) => acc + (it.salePrice || 0), 0));
    gross_profit = round2(total_price - total_cost);
  }

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

// Recalcula todos os itens do orçamento utilizando o motor central de precificação
export function recalculateBudget(
  items: BudgetItem[],
  database: ProductItem[] = DEFAULT_MATERIALS,
  settings: BudgetSettings,
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG
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
  return calculatePricingTree(items, database, settings, catalog);
}

// Agrupa as peças e processos por Móvel / Módulo para visualização executiva
export function groupItemsByModule(items: BudgetItem[]): ModuleGroup[] {
  if (items.some(item => item.promob_xml)) return structuredModuleGroups(items);
  const groups: ModuleGroup[] = [];
  let eletroGroup: ModuleGroup | null = null;
  let currentGroup: ModuleGroup | null = null;
  let moduleCounter = 1;

  for (const it of items) {
    const cat = it.itemCategory || classifyPromobItem(it);

    // 1. Eletrodomésticos & Equipamentos (sempre no final de tudo com custo e preço R$ 0,00)
    if (cat === 'INFORMATIONAL' || isEletrodomestico(it.code, it.description, it.category)) {
      if (!eletroGroup) {
        eletroGroup = {
          id: 'group-eletros',
          name: 'Eletrodomésticos & Equipamentos (Informativo - Sem Cobrança)',
          category: 'Eletrodomésticos',
          piecesCount: 0,
          totalCost: 0,
          totalPrice: 0,
          subtotal_cost: 0,
          subtotal_price: 0,
          total_pieces: 0,
          items: [],
        };
      }
      eletroGroup.items.push({
        ...it,
        unit_cost: 0,
        unit_price: 0,
        total_cost: 0,
        total_price: 0,
        productionCost: 0,
        salePrice: 0,
        saleIncluded: false,
      });
      eletroGroup.piecesCount += (it.rep || 1);
      eletroGroup.total_pieces = eletroGroup.piecesCount;
      continue;
    }

    // 2. Processos de Fabricação (Mão de Obra Fixa)
    if (cat === 'MANUFACTURING_PROCESS') {
      currentGroup = null; // encerra móvel anterior
      let procGroup = groups.find(g => g.id === 'group-processos');
      if (!procGroup) {
        procGroup = {
          id: 'group-processos',
          name: 'Processos de Fabricação (Mão de Obra Fixa)',
          category: 'Processo de Fabricação',
          piecesCount: 0,
          totalCost: 0,
          totalPrice: 0,
          subtotal_cost: 0,
          subtotal_price: 0,
          total_pieces: 0,
          items: [],
          is_process_only: true,
        };
        groups.push(procGroup);
      }
      procGroup.items.push(it);
      procGroup.piecesCount += (it.rep || 1);
      procGroup.total_pieces = procGroup.piecesCount;
      procGroup.totalCost = round2(procGroup.totalCost + (it.productionCost || it.total_cost || 0));
      procGroup.subtotal_cost = procGroup.totalCost;
      procGroup.totalPrice = round2(procGroup.totalPrice + (it.salePrice || it.total_price || 0));
      procGroup.subtotal_price = procGroup.totalPrice;
      continue;
    }

    // 3. Ferragens e Acessórios avulsos
    if (cat === 'ACCESSORY' && !it.parentId) {
      currentGroup = null; // encerra móvel anterior
      let ferragemGroup = groups.find(g => g.id === 'group-ferragens');
      if (!ferragemGroup) {
        ferragemGroup = {
          id: 'group-ferragens',
          name: 'Ferragens & Acessórios Gerais',
          category: 'Acessórios',
          piecesCount: 0,
          totalCost: 0,
          totalPrice: 0,
          subtotal_cost: 0,
          subtotal_price: 0,
          total_pieces: 0,
          items: [],
          is_hardware_only: true,
        };
        groups.push(ferragemGroup);
      }
      ferragemGroup.items.push(it);
      ferragemGroup.piecesCount += (it.rep || 1);
      ferragemGroup.total_pieces = ferragemGroup.piecesCount;
      ferragemGroup.totalCost = round2(ferragemGroup.totalCost + (it.productionCost || it.total_cost || 0));
      ferragemGroup.subtotal_cost = ferragemGroup.totalCost;
      ferragemGroup.totalPrice = round2(ferragemGroup.totalPrice + (it.salePrice || it.total_price || 0));
      ferragemGroup.subtotal_price = ferragemGroup.totalPrice;
      continue;
    }

    // 4. Tamponamentos e Fechamentos avulsos
    if (cat === 'EXTERNAL_ITEM') {
      currentGroup = null; // encerra móvel anterior
      let tampGroup = groups.find(g => g.id === 'group-tamponamentos');
      if (!tampGroup) {
        tampGroup = {
          id: 'group-tamponamentos',
          name: 'Tamponamentos & Fechamentos',
          category: 'Acabamentos',
          piecesCount: 0,
          totalCost: 0,
          totalPrice: 0,
          subtotal_cost: 0,
          subtotal_price: 0,
          total_pieces: 0,
          items: [],
        };
        groups.push(tampGroup);
      }
      tampGroup.items.push(it);
      tampGroup.piecesCount += (it.rep || 1);
      tampGroup.total_pieces = tampGroup.piecesCount;
      tampGroup.totalCost = round2(tampGroup.totalCost + (it.productionCost || it.total_cost || 0));
      tampGroup.subtotal_cost = tampGroup.totalCost;
      tampGroup.totalPrice = round2(tampGroup.totalPrice + (it.salePrice || it.total_price || 0));
      tampGroup.subtotal_price = tampGroup.totalPrice;
      continue;
    }

    // 5. Módulo Pai Principal
    if (cat === 'MODULE') {
      const moduleSale = (it.salePrice !== undefined && it.salePrice > 0) ? it.salePrice : it.total_price;
      const moduleCost = (it.productionCost !== undefined && it.productionCost > 0) ? it.productionCost : it.total_cost;

      currentGroup = {
        id: `module-${it.id || moduleCounter++}`,
        name: it.description,
        dimensions: it.dimensions,
        category: it.category || 'Móvel',
        parentModuleItem: it,
        parent_item: it,
        piecesCount: 0,
        totalCost: moduleCost,
        totalPrice: moduleSale,
        subtotal_cost: moduleCost,
        subtotal_price: moduleSale,
        total_pieces: 0,
        items: [],
      };
      groups.push(currentGroup);
      continue;
    }

    // 6. Peças filhas (SUBMODULE ou CUT_PART) pertencentes ao módulo atual
    if (currentGroup) {
      currentGroup.items.push(it);
      currentGroup.piecesCount += (it.rep || 1);
      currentGroup.total_pieces = currentGroup.piecesCount;
      // Se o módulo não tiver preço/custo fixo de tabela do Promob definido no cabeçalho, acumula das peças físicas:
      const parentHasFixedPrice = Boolean(
        (currentGroup.parentModuleItem?.table_price && currentGroup.parentModuleItem.table_price > 0) ||
        (currentGroup.parentModuleItem?.final_price && currentGroup.parentModuleItem.final_price > 0)
      );
      if (!parentHasFixedPrice) {
        currentGroup.totalCost = round2(currentGroup.totalCost + (it.productionCost || it.total_cost || 0));
        currentGroup.subtotal_cost = currentGroup.totalCost;
        currentGroup.totalPrice = round2(currentGroup.totalPrice + (it.salePrice || it.total_price || 0));
        currentGroup.subtotal_price = currentGroup.totalPrice;
      }
    } else {
      let generalGroup = groups.find(g => g.id === 'group-geral');
      if (!generalGroup) {
        generalGroup = {
          id: 'group-geral',
          name: 'Peças & Componentes Gerais',
          piecesCount: 0,
          totalCost: 0,
          totalPrice: 0,
          subtotal_cost: 0,
          subtotal_price: 0,
          total_pieces: 0,
          items: [],
        };
        groups.push(generalGroup);
      }
      generalGroup.items.push(it);
      generalGroup.piecesCount += (it.rep || 1);
      generalGroup.total_pieces = generalGroup.piecesCount;
      generalGroup.totalCost = round2(generalGroup.totalCost + (it.productionCost || it.total_cost || 0));
      generalGroup.subtotal_cost = generalGroup.totalCost;
      generalGroup.totalPrice = round2(generalGroup.totalPrice + (it.salePrice || it.total_price || 0));
      generalGroup.subtotal_price = generalGroup.totalPrice;
    }
  }

  // Eletrodomésticos sempre ficam no final de tudo ("lá embaixo"), conforme solicitado pelo usuário
  if (eletroGroup && eletroGroup.items.length > 0) {
    groups.push(eletroGroup);
  }

  return groups;
}

// Zero-priced structural containers are intentional; purchasable leaves are not.
export function missingPriceItems(items: BudgetItem[]): BudgetItem[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const missing = items.filter(item => {
    if (isEletrodomestico(item.code, item.description, item.category)) return false;
    if (item.promob_xml && classifyPromobItem(item) === 'MODULE') return false;
    let ancestor = item.parentId ? byId.get(item.parentId) : undefined;
    const visited = new Set<string>();
    while (ancestor && !visited.has(ancestor.id)) {
      visited.add(ancestor.id);
      if ((ancestor.catalog_match || (ancestor.price_origin !== 'calculated' && ((ancestor.final_price || 0) > 0 || (ancestor.table_price || 0) > 0 || ancestor.price_origin === 'manual'))) && ancestor.total_price > 0) return false;
      ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
    }
    const hardwareContainer = item.has_children && /dobradica|corredica|pistao/.test(normalizeText(item.description));
    if ((item.has_children || item.is_parent_module) && !hardwareContainer) return false;
    if (hardwareContainer) return !item.catalog_match && !(item.price_origin === 'manual' && item.unit_cost > 0) && !(item.price_unlinked && item.unit_cost > 0);
    return !(item.unit_cost > 0) && !(item.total_price > 0);
  });
  return [...new Map(missing.map(item => [`${item.code}:${item.unit}`, item])).values()];
}

export function budgetPresentationItems(items: BudgetItem[]): BudgetItem[] {
  if (!items.some(item => item.promob_xml)) return items;
  return structuredModuleGroups(items).map((group, index) => ({ ...group.parent_item!,
    item_number: index + 1, description: group.name + (group.parent_item?.external_model ? ` — ${group.parent_item.external_model}` : ''), total_cost: group.totalCost, total_price: group.totalPrice,
    unit_cost: group.piecesCount > 0 ? round2(group.totalCost / group.piecesCount) : 0,
    unit_price: group.piecesCount > 0 ? round2(group.totalPrice / group.piecesCount) : 0 }));
}
