import { BudgetItem, BudgetSettings, ProductItem, ModuleGroup } from './types';
import { INITIAL_CHAPAS_CATALOG, CatalogByBrand, BrandCatalog } from './chapas-catalog';
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

  // Verifica também chaves de marcas presentes no catálogo recebido
  if (!detectedBrand && catalog) {
    for (const b of Object.keys(catalog)) {
      if (catalog[b].type === 'brand' && normText.includes(normalizeText(b))) {
        detectedBrand = b;
        break;
      }
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

  // Se não foi encontrada marca explícita, mas é peça de chapa MDF/MDP (comum na caixaria Promob):
  const isChapaItem = isChapa(code, description) || normText.includes('mdf') || normText.includes('mdp') || normText.includes('bp');
  if (!detectedBrand && isChapaItem && catalog) {
    if (normText.includes('freijo')) {
      if (catalog['Arauco']) detectedBrand = 'Arauco';
    } else if (normText.includes('grafite')) {
      if (catalog['Duratex']) detectedBrand = 'Duratex';
    } else {
      // Padrão de marcenaria para caixaria: MDF Branco (Arauco ou Duratex)
      if (catalog['Arauco']) detectedBrand = 'Arauco';
      else if (catalog['Duratex']) detectedBrand = 'Duratex';
      else {
        const firstBrand = Object.keys(catalog).find(k => catalog[k].type === 'brand');
        if (firstBrand) detectedBrand = firstBrand;
      }
    }
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

  // Se o item contém "branco" e não encontrou score alto, busca linha com "branco"
  if (!bestLine && (normText.includes('branco') || normText.includes('branca'))) {
    bestLine = lines.find(l => {
      const nl = normalizeText(l.name);
      return nl.includes('branco') && !nl.includes('ultra');
    }) || lines.find(l => normalizeText(l.name).includes('branco'));
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
  const normText = normalizeText(`${code} ${description} ${dimensions || ''}`);
  const acessoriosCat = catalog['Acessórios'];
  const acessoriosList = acessoriosCat && acessoriosCat.type === 'acessorios' ? acessoriosCat.items : [];

  const findAcessorio = (predicate: (name: string) => boolean) => {
    return acessoriosList.find(a => predicate(normalizeText(a.name)));
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
    }
    if (normText.includes('gola')) {
      const match = findAcessorio(n => n.includes('puxador') && n.includes('gola'));
      if (match && match.price > 0) {
        return { matched: true, name: match.name, price: match.price, unit: 'UN', source: 'catalog_acessorio', code: match.id };
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
    const dbPistao = findDbProduct(p => normalizeCode(p.code).includes('pistao'));
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

  // 12. Fitas de Borda
  if (isFitaBorda(code, description)) {
    if (normText.includes('35')) {
      const dbFita = findDbProduct(p => p.code === 'FITA-BRANCA-35');
      if (dbFita) return { matched: true, name: dbFita.description, price: dbFita.unit_price, unit: dbFita.unit || 'UN', source: 'database', code: dbFita.code };
    }
    if (normText.includes('freijo')) {
      const dbFita = findDbProduct(p => p.code === 'FITA-FREIJO-22');
      if (dbFita) return { matched: true, name: dbFita.description, price: dbFita.unit_price, unit: dbFita.unit || 'UN', source: 'database', code: dbFita.code };
    }
    const dbFita = findDbProduct(p => p.code === 'FITA-BRANCA-22') || findDbProduct(p => normalizeText(p.category || '').includes('fita'));
    if (dbFita) return { matched: true, name: dbFita.description, price: dbFita.unit_price, unit: dbFita.unit || 'UN', source: 'database', code: dbFita.code };
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
    found = database.find(p =>
      p.subcodes && p.subcodes.some(sub => normalizeCode(sub) === cleanCode)
    );
    if (found) return { product: found, isSubcodeMatch: true };

    // 3. Busca por descrição contendo o código
    found = database.find(p =>
      normalizeText(p.description).includes(cleanCode) ||
      cleanCode.includes(normalizeCode(p.code))
    );
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
  target: { code: string; description: string; dimensions?: string; unit?: string; is_parent_module?: boolean; is_chapa?: boolean },
  candidate: { id?: string; code: string; description: string; dimensions?: string; unit?: string; is_parent_module?: boolean; is_chapa?: boolean },
  isAccessoryTarget = false
): boolean {
  if (candidate.is_parent_module) return false;

  const tCode = normalizeCode(target.code);
  const cCode = normalizeCode(candidate.code);
  const tDesc = normalizeText(target.description);
  const cDesc = normalizeText(candidate.description);

  // 1. Mesmo código exato
  if (tCode && cCode && tCode === cCode) return true;

  if (isAccessoryTarget) {
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

  // Chapas MDF/MDP
  const isTargetChapa = target.is_chapa || isChapa(target.code, target.description) || (target.unit || '').toUpperCase() === 'M2';
  const isCandChapa = candidate.is_chapa || isChapa(candidate.code, candidate.description) || (candidate.unit || '').toUpperCase() === 'M2';
  if (!isTargetChapa || !isCandChapa) return false;

  const extractThick = (str: string) => {
    const m = str.match(/\b(6|15|18|25)mm\b|\.(6|15|18|25)\./i);
    return m ? (m[1] || m[2]) : null;
  };
  const cThick = extractThick(candidate.code) || extractThick(candidate.description);
  const tThick = extractThick(target.code) || extractThick(target.description);
  if (cThick && tThick && cThick !== tThick) {
    return false;
  }

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
  source: 'database' | 'catalog_chapa' | 'catalog_acessorio' | 'mdf_padrao' | 'catalog_maodeobra';
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
    unit?: string;
    is_parent_module?: boolean;
    is_chapa?: boolean;
    is_fita?: boolean;
    fita_metros?: number;
  },
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG,
  database: ProductItem[] = DEFAULT_MATERIALS
): PriceMatchResult {
  // Pula módulos pais agrupadores
  if (item.is_parent_module) {
    return {
      matched: false,
      source: 'database',
      unit_cost: 0,
      code: item.code,
      description: item.description,
      unit: item.unit || 'UN',
    };
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

  const isChapaItem = isChapa(item.code, item.description) || (item.unit || '').toUpperCase() === 'M2';

  if (isChapaItem) {
    // 1. Tenta encontrar no catálogo de Chapas por marca e acabamento
    const smart = smartMatchPromobChapa(item.code, item.description, catalog);
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
    if (dbMdf && dbMdf.unit_price > 0) {
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
    if (isFitaBorda(item.code, item.description) && (item.unit || '').toUpperCase() === 'M') {
      const fitaMetros = extractFitaMetros(accessory.name) || extractFitaMetros(item.description) || 20;
      if (fitaMetros > 0) unitCost = round2(accessory.price / fitaMetros);
    }
    return {
      matched: true,
      source: accessory.source === 'catalog_acessorio' ? 'catalog_acessorio' : 'database',
      unit_cost: unitCost,
      code: accessory.code || item.code,
      description: item.description,
      unit: accessory.unit || item.unit || 'UN',
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
    rep?: number;
    unit_quantity?: number;
    dimensions?: string;
    category?: string;
    external_model?: string;
    table_price?: number;
    final_price?: number;
    is_parent_module?: boolean;
    is_chapa?: boolean;
    is_fita?: boolean;
    fita_metros?: number;
  },
  database: ProductItem[] = DEFAULT_MATERIALS,
  settings: BudgetSettings,
  catalog: CatalogByBrand = INITIAL_CHAPAS_CATALOG
): BudgetItem {
  // Resolve correspondência e preço de tabela automático se não estiver desvinculado
  const resolved = !item.price_unlinked
    ? resolveItemPrice(
        {
          code: item.code,
          description: item.description,
          dimensions: item.dimensions,
          unit: item.unit,
          is_parent_module: item.is_parent_module,
          is_chapa: item.is_chapa,
          is_fita: item.is_fita,
          fita_metros: item.fita_metros,
        },
        catalog,
        database
      )
    : null;

  const found = !item.price_unlinked && (
    (resolved ? resolved.matched : false) ||
    (item.table_price !== undefined && item.table_price > 0)
  );

  const isItemChapa = item.is_chapa !== undefined
    ? item.is_chapa
    : (resolved?.source === 'catalog_chapa' || resolved?.source === 'mdf_padrao' || isChapa(item.code, item.description));
  const isItemFita = item.is_fita !== undefined
    ? item.is_fita
    : isFitaBorda(item.code, item.description);

  // Quantidade efetiva e unidade:
  let effectiveQuantity = item.quantity;
  if (item.rep !== undefined && item.unit_quantity !== undefined && item.rep > 0 && item.unit_quantity > 0) {
    effectiveQuantity = round4(item.rep * item.unit_quantity);
  } else if (!effectiveQuantity || effectiveQuantity <= 0) {
    effectiveQuantity = 1;
  }
  effectiveQuantity = round4(effectiveQuantity);

  let displayUnit = resolved?.unit || item.unit || 'UN';

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
  if (item.price_unlinked) {
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
  if (isItemFita && fitaMetros > 0 && displayUnit.toUpperCase() === 'M' && unit_cost > 0 && (!item.table_price || resolved?.matched)) {
    if (unit_cost > 10) {
      unit_cost = round2(unit_cost / fitaMetros);
    }
  }

  // Preço de venda, custo total e margem
  let unit_price = 0;
  let total_cost = 0;
  let total_price = 0;
  let marginPercent = 0;

  if (item.final_price !== undefined && item.final_price > 0 && effectiveQuantity > 0) {
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
  if (resolved && resolved.matched && resolved.source === 'catalog_chapa' && resolved.brand && resolved.line) {
    if (!finalDescription.includes(`[${resolved.brand}`)) {
      finalDescription = `${item.description} [${resolved.brand} - ${resolved.line} ${resolved.thickness}]`;
    }
  } else if (resolved && resolved.matched && resolved.matched_name) {
    if (!finalDescription.includes(`(${resolved.matched_name})`)) {
      finalDescription = `${item.description} (${resolved.matched_name})`;
    }
  }

  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    item_number: 1,
    code: resolved?.code || item.code,
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
    resolved_from_subcode: resolved ? resolved.matched : false,
    rep: item.rep,
    unit_quantity: item.unit_quantity,
    dimensions: item.dimensions,
    category: item.category,
    external_model: item.external_model,
    table_price: item.table_price !== undefined ? item.table_price : unit_cost,
    final_price: item.final_price !== undefined ? item.final_price : total_price,
    is_parent_module: item.is_parent_module,
  };
}

// Recalcula todos os itens do orçamento de forma ultra rápida
export function recalculateBudget(
  items: BudgetItem[],
  database: ProductItem[],
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
        rep: it.rep,
        unit_quantity: it.unit_quantity,
        dimensions: it.dimensions,
        category: it.category,
        external_model: it.external_model,
        table_price: it.price_unlinked ? 0 : it.table_price,
        final_price: it.price_unlinked ? undefined : it.final_price,
        is_parent_module: it.is_parent_module,
        is_chapa: it.is_chapa,
        is_fita: it.is_fita,
        fita_metros: it.fita_metros,
      },
      database,
      settings,
      catalog
    );
    return {
      ...updated,
      id: it.id,
      item_number: it.item_number || idx + 1,
      rep: it.rep,
      unit_quantity: it.unit_quantity,
      dimensions: it.dimensions,
      category: it.category,
      external_model: it.external_model,
      table_price: it.price_unlinked ? 0 : (it.table_price !== undefined ? it.table_price : updated.unit_cost),
      final_price: it.price_unlinked ? updated.total_price : (it.final_price !== undefined ? it.final_price : updated.total_price),
      is_parent_module: it.is_parent_module,
    };
  });

  // Se houver módulos pais agrupadores (Promob), não duplicamos a contagem!
  // Itens faturáveis são os itens que não são módulos agrupadores pais
  const hasParentModules = recalculatedItems.some(it => it.is_parent_module);
  const billableItems = hasParentModules
    ? recalculatedItems.filter(it => !it.is_parent_module)
    : recalculatedItems;

  const total_cost = round2(billableItems.reduce((acc, curr) => acc + curr.total_cost, 0));
  const total_price = round2(billableItems.reduce((acc, curr) => acc + curr.total_price, 0));
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

// Agrupa as peças e processos por Móvel / Módulo para visualização executiva
export function groupItemsByModule(items: BudgetItem[]): ModuleGroup[] {
  const groups: ModuleGroup[] = [];
  let currentGroup: ModuleGroup | null = null;
  let moduleCounter = 1;

  for (const it of items) {
    const normDesc = normalizeText(it.description || '');
    const normCat = normalizeText(it.category || '');

    // 1. Processos de Fabricação (Mão de Obra Fixa)
    const isLabor = it.is_processo || it.is_mao_de_obra ||
      normCat.includes('processo') || normCat.includes('mao de obra') ||
      normDesc.includes('processo de fabricacao') || normDesc.includes('porta reta') ||
      normDesc.includes('porta cava') || normDesc.includes('frente cava');

    if (isLabor) {
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
      procGroup.totalCost = round2(procGroup.totalCost + it.total_cost);
      procGroup.subtotal_cost = procGroup.totalCost;
      procGroup.totalPrice = round2(procGroup.totalPrice + it.total_price);
      procGroup.subtotal_price = procGroup.totalPrice;
      continue;
    }

    // 2. Eletrodomésticos
    if (normCat.includes('electrolux') || normDesc.includes('forno') || normDesc.includes('fogao') || normDesc.includes('cooktop') || normDesc.includes('coifa') || normDesc.includes('lava loucas')) {
      let eletroGroup = groups.find(g => g.id === 'group-eletros');
      if (!eletroGroup) {
        eletroGroup = {
          id: 'group-eletros',
          name: 'Eletrodomésticos & Equipamentos',
          category: 'Eletrodomésticos',
          piecesCount: 0,
          totalCost: 0,
          totalPrice: 0,
          subtotal_cost: 0,
          subtotal_price: 0,
          total_pieces: 0,
          items: [],
        };
        groups.push(eletroGroup);
      }
      eletroGroup.items.push(it);
      eletroGroup.piecesCount += (it.rep || 1);
      eletroGroup.total_pieces = eletroGroup.piecesCount;
      eletroGroup.totalCost = round2(eletroGroup.totalCost + it.total_cost);
      eletroGroup.subtotal_cost = eletroGroup.totalCost;
      eletroGroup.totalPrice = round2(eletroGroup.totalPrice + it.total_price);
      eletroGroup.subtotal_price = eletroGroup.totalPrice;
      continue;
    }

    // 3. Ferragens e Acessórios Gerais avulsos
    const isStandaloneHardware = (normCat.includes('acessorio') || normCat.includes('hettich') || normCat.includes('wurth') || normCat.includes('ferragem') ||
      normDesc.includes('dobradica') || normDesc.includes('corredica') || normDesc.includes('pistao') || normDesc.includes('lift')) &&
      !it.is_parent_module;

    if (isStandaloneHardware && !currentGroup) {
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
      ferragemGroup.totalCost = round2(ferragemGroup.totalCost + it.total_cost);
      ferragemGroup.subtotal_cost = ferragemGroup.totalCost;
      ferragemGroup.totalPrice = round2(ferragemGroup.totalPrice + it.total_price);
      ferragemGroup.subtotal_price = ferragemGroup.totalPrice;
      continue;
    }

    // 4. Módulos / Móveis Mestres (Armário, Balcão, Torre)
    const isTopModule = it.is_parent_module &&
      !normDesc.includes('caixa armario') &&
      !normDesc.includes('caixa gaveta') &&
      !normDesc.includes('balcao 1 div') &&
      !normDesc.includes('balcao gav/pia');

    if (isTopModule) {
      currentGroup = {
        id: `module-${it.id || moduleCounter++}`,
        name: it.description,
        dimensions: it.dimensions,
        category: it.category || 'Móvel',
        parentModuleItem: it,
        parent_item: it,
        piecesCount: 0,
        totalCost: 0,
        totalPrice: 0,
        subtotal_cost: 0,
        subtotal_price: 0,
        total_pieces: 0,
        items: [],
      };
      groups.push(currentGroup);
      continue;
    }

    // 5. Tamponamentos e Fechamentos
    if (normDesc.includes('tamponamento') && !currentGroup?.name.toLowerCase().includes('balcão') && !currentGroup?.name.toLowerCase().includes('armário')) {
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
      tampGroup.totalCost = round2(tampGroup.totalCost + it.total_cost);
      tampGroup.subtotal_cost = tampGroup.totalCost;
      tampGroup.totalPrice = round2(tampGroup.totalPrice + it.total_price);
      tampGroup.subtotal_price = tampGroup.totalPrice;
      continue;
    }

    // 6. Peça filha do móvel atual
    if (currentGroup) {
      currentGroup.items.push(it);
      if (!it.is_parent_module) {
        currentGroup.piecesCount += (it.rep || 1);
        currentGroup.total_pieces = currentGroup.piecesCount;
        currentGroup.totalCost = round2(currentGroup.totalCost + it.total_cost);
        currentGroup.subtotal_cost = currentGroup.totalCost;
        currentGroup.totalPrice = round2(currentGroup.totalPrice + it.total_price);
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
      if (!it.is_parent_module) {
        generalGroup.piecesCount += (it.rep || 1);
        generalGroup.total_pieces = generalGroup.piecesCount;
        generalGroup.totalCost = round2(generalGroup.totalCost + it.total_cost);
        generalGroup.subtotal_cost = generalGroup.totalCost;
        generalGroup.totalPrice = round2(generalGroup.totalPrice + it.total_price);
        generalGroup.subtotal_price = generalGroup.totalPrice;
      }
    }
  }

  return groups;
}
