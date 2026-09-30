// Catálogo Oficial de Chapas, Linhas e Cores por Marca - Promob Plus & DF Móveis
// Estrutura completa de 8 marcas com todas as linhas e 800 padrões/cores oficiais

export interface ChapaLineItem {
  id: string;
  name: string;
  colors: string[];
  width: number;
  height: number;
  area: number;
  prices: {
    '6mm': number | null;
    '15mm': number | null;
    '18mm': number | null;
    '25mm': number | null;
  };
}

export interface AcessorioItem {
  id: string;
  name: string;
  size: string;
  price: number;
}

export interface MaoDeObraItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  description?: string;
}

export interface BrandCatalog {
  brandName: string;
  type: 'brand';
  lines: ChapaLineItem[];
}

export interface AcessoriosCatalog {
  brandName: 'Acessórios';
  type: 'acessorios';
  items: AcessorioItem[];
}

export interface MaoDeObraCatalog {
  brandName: 'Mão de Obra Fixa';
  type: 'maodeobra';
  items: MaoDeObraItem[];
}

export type CatalogByBrand = Record<string, BrandCatalog | AcessoriosCatalog | MaoDeObraCatalog>;

export const INITIAL_CHAPAS_CATALOG: CatalogByBrand = {
  "Arauco": {
    "brandName": "Arauco",
    "type": "brand",
    "lines": [
      {
        "id": "arauco-1",
        "name": "Cores > Chess > Lisos",
        "colors": [
          "Branco Supremo",
          "Cacao",
          "Canela",
          "Cinza Cristal",
          "Ébano",
          "Grafito",
          "Íris",
          "Kashmir"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 176,
          "15mm": 220,
          "18mm": 270,
          "25mm": null
        }
      },
      {
        "id": "arauco-2",
        "name": "Cores > Dueto > Lisos",
        "colors": [
          "Blues",
          "Frevo"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320.69,
          "15mm": 456.78,
          "18mm": 548.08,
          "25mm": null
        }
      },
      {
        "id": "arauco-3",
        "name": "Cores > Matt > Lisos",
        "colors": [
          "Azul Sereno",
          "Beige",
          "Beton",
          "Blues",
          "Branco Supremo",
          "Cacao",
          "Cafelatte",
          "Cinza Puro",
          "Connect",
          "Cristalina",
          "Damasco",
          "Frapê",
          "Frevo",
          "Jalapão",
          "Jazz",
          "Lavanda",
          "Lord",
          "Maragogi",
          "Oceano",
          "Sal Rosa",
          "Sálvia",
          "Verde Jade"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 176,
          "15mm": 220,
          "18mm": 270,
          "25mm": null
        }
      },
      {
        "id": "arauco-4",
        "name": "Cores > TX > Lisos",
        "colors": [
          "Cinza Cristal",
          "Ébano"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320.69,
          "15mm": 456.78,
          "18mm": 548.08,
          "25mm": null
        }
      },
      {
        "id": "arauco-5",
        "name": "Madeiras > Bold",
        "colors": [
          "Amendoeira",
          "Areal",
          "Carvalho Mel",
          "Cerrado",
          "Escarlate",
          "Maraú",
          "Nogal Terracota",
          "Petar"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 369.12,
          "15mm": 494.48,
          "18mm": 576.86,
          "25mm": null
        }
      },
      {
        "id": "arauco-6",
        "name": "Madeiras > Chess - FL DEZEMBRO/2026",
        "colors": [
          "Canelato - FL DEZEMBRO/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 374.65,
          "15mm": 431.64,
          "18mm": 518.1,
          "25mm": null
        }
      },
      {
        "id": "arauco-7",
        "name": "Madeiras > Matt - FL DEZEMBRO/2026",
        "colors": [
          "Castanheira Natural - FL DEZEMBRO/2026",
          "Elmo Suíço - FL DEZEMBRO/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 293.68,
          "15mm": 419.42,
          "18mm": 503.16,
          "25mm": null
        }
      },
      {
        "id": "arauco-8",
        "name": "Madeiras > Nature",
        "colors": [
          "Ameixa Negra",
          "Bambu - FL DEZEMBRO/2026",
          "Noce Naturale",
          "Teka Ártico",
          "Tokai - FL DEZEMBRO/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320.69,
          "15mm": 456.78,
          "18mm": 548.08,
          "25mm": null
        }
      },
      {
        "id": "arauco-9",
        "name": "Madeiras > Poro",
        "colors": [
          "Bossa Nova",
          "Carvalho",
          "Castanho",
          "Ciliegio",
          "Tabaco"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320.69,
          "15mm": 456.78,
          "18mm": 548.08,
          "25mm": null
        }
      },
      {
        "id": "arauco-10",
        "name": "Madeiras > Trend",
        "colors": [
          "Acácia Carmel",
          "Atlântica",
          "Autentic",
          "Carvalho Americano",
          "Nogueira Pecan",
          "Nogueira Persa",
          "Nordic - FL DEZEMBRO/2026",
          "Ricori Nativo - FL DEZEMBRO/2026",
          "Samba",
          "Sertanejo"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 326,
          "15mm": 464.07,
          "18mm": 556.8,
          "25mm": null
        }
      },
      {
        "id": "arauco-11",
        "name": "Madeiras > Vert",
        "colors": [
          "Madeiral"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 386.07,
          "15mm": 539.63,
          "18mm": 616.75,
          "25mm": null
        }
      },
      {
        "id": "arauco-12",
        "name": "Madeiras Brasileiras > Poro",
        "colors": [
          "Louro Freijó",
          "Nova Imbuia"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 326,
          "15mm": 464.07,
          "18mm": 556.8,
          "25mm": null
        }
      },
      {
        "id": "arauco-13",
        "name": "Madeiras Brasileiras > Trend",
        "colors": [
          "Cumaru",
          "Ipê",
          "Jatobá Brasileiro",
          "Jequitibá",
          "Louro Freijó",
          "Pau-ferro",
          "Sucupira - FL DEZEMBRO/2026",
          "Tauari Clássico"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 326,
          "15mm": 464.07,
          "18mm": 556.8,
          "25mm": null
        }
      },
      {
        "id": "arauco-14",
        "name": "Metais > Vert",
        "colors": [
          "Orla",
          "Orvalho",
          "Silício"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 386.07,
          "15mm": 539.63,
          "18mm": 616.75,
          "25mm": null
        }
      },
      {
        "id": "arauco-15",
        "name": "Pedras > Liso",
        "colors": [
          "Atenna",
          "Reali"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320.69,
          "15mm": 456.78,
          "18mm": 548.08,
          "25mm": null
        }
      },
      {
        "id": "arauco-16",
        "name": "Pedras > Matt > Lisos",
        "colors": [
          "Concreto Decor"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 293.68,
          "15mm": 419.42,
          "18mm": 503.16,
          "25mm": null
        }
      },
      {
        "id": "arauco-17",
        "name": "Realce > Dueto > Lisos",
        "colors": [
          "Pimenta Rosa"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320.69,
          "15mm": 456.78,
          "18mm": 548.08,
          "25mm": null
        }
      },
      {
        "id": "arauco-18",
        "name": "Realce > Matt > Lisos",
        "colors": [
          "Anis",
          "Ginger",
          "Moscada",
          "Pimenta Rosa"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 293.68,
          "15mm": 419.42,
          "18mm": 503.16,
          "25mm": null
        }
      },
      {
        "id": "arauco-19",
        "name": "Realce > Trend",
        "colors": [
          "Cravo"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 326,
          "15mm": 464.07,
          "18mm": 556.8,
          "25mm": null
        }
      },
      {
        "id": "arauco-20",
        "name": "Tecidos > Chess > Lisos",
        "colors": [
          "Lino",
          "Lino Piombo"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 176,
          "15mm": 220,
          "18mm": 270,
          "25mm": null
        }
      },
      {
        "id": "arauco-21",
        "name": "Tecidos > Couro",
        "colors": [
          "Camelo",
          "Linho"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 369.12,
          "15mm": 515.12,
          "18mm": 578.2,
          "25mm": null
        }
      }
    ]
  },
  "Berneck": {
    "brandName": "Berneck",
    "type": "brand",
    "lines": [
      {
        "id": "berneck-1",
        "name": "Amadeirados Claros",
        "colors": [
          "Amantea Tatto",
          "Barrique Tatto",
          "Carvalho Japandi (Micro)",
          "Carvalho Treviso (Design)",
          "Cerejeira Clara (Grann)",
          "Cerejeira Natural (Grann)",
          "Chiaro (VEL)",
          "Faia (Grann)",
          "Galiano (Grann)",
          "Parquet (Grann)",
          "Provence Tatto"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 309.05,
          "15mm": 442.12,
          "18mm": 506.25,
          "25mm": null
        }
      },
      {
        "id": "berneck-2",
        "name": "Amadeirados Escuros",
        "colors": [
          "Cacau (Grann)",
          "Castaine (Tatto)",
          "Louro Preto (Grann)",
          "Nogal Artezzano (Grann)",
          "Nogal Málaga (Design)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 309.05,
          "15mm": 442.12,
          "18mm": 506.25,
          "25mm": null
        }
      },
      {
        "id": "berneck-3",
        "name": "Amadeirados Médios",
        "colors": [
          "Cinamomo (Grann)",
          "Frassino Almendra (Poro)",
          "Freijó",
          "Gengibre (Tatto)",
          "Griseo (Grann)",
          "Italian Noce (Poro)",
          "Jequitibá",
          "Louro Freijó",
          "Mogno Imperial (Grann)",
          "Nogal Sevilha (Poro)",
          "Peroba (Tatto)",
          "Roble Catedral (Grann)",
          "Roble Catedral (Grann)_Não excluir",
          "Solanum (Grann)",
          "Veneer (Grann)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      },
      {
        "id": "berneck-4",
        "name": "Combine Fácil > Fantasias",
        "colors": [
          "Argento (Rust)",
          "Basalto (Rust)",
          "Falésia (VEL)",
          "Nero (Rust)",
          "Terrazza (Micro)",
          "Volakas (Micro)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 309.05,
          "15mm": 442.12,
          "18mm": 506.25,
          "25mm": null
        }
      },
      {
        "id": "berneck-5",
        "name": "Combine Fácil > Tecidos",
        "colors": [
          "Lana (Vel)",
          "Linen Grígio (VEL)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      },
      {
        "id": "berneck-6",
        "name": "Combine Fácil > Unicolores",
        "colors": [
          "Azul (TX)",
          "Azul (VEL)",
          "Azul Galeno (Micro)",
          "Baru (Micro)",
          "Bege (TX)",
          "Branco (Design)",
          "Branco (LSF)",
          "Branco (Micro)",
          "Branco (TX)",
          "Branco (VEL)",
          "Branco Super White (Micro)",
          "Ceramik (Micro)",
          "Cinza Argila (TX)",
          "Cinza Cobalto (TX)",
          "Cinza Cobalto (VEL)",
          "Cinza Cristal (TX)",
          "Latte (Micro)",
          "Millennial (Micro)",
          "Mostrato (Micro)",
          "Nude (VEL)",
          "Ópera (Micro)",
          "Preto (TX)",
          "Sky (VEL)",
          "Tabasco (Micro)",
          "Tangará (Micro)",
          "Taupe (Micro)",
          "Verti (Micro)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      },
      {
        "id": "berneck-7",
        "name": "Metalizados",
        "colors": [
          "Chumbo (Micro)",
          "Dust (Alumi)",
          "Gold (Alumi)",
          "Metallic Suede (TX)",
          "Plomo (Alumi)",
          "Ruggine (TX)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      }
    ]
  },
  "Duratex": {
    "brandName": "Duratex",
    "type": "brand",
    "lines": [
      {
        "id": "duratex-1",
        "name": "Alto Brilho > Cristallo",
        "colors": [
          "Branco Diamante",
          "Cinza Fóssil FL 10/03/2026",
          "Cinza Sagrado",
          "Gianduia",
          "Opala",
          "Pau Ferro Natural",
          "Preto",
          "Titânio"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 568.23,
          "15mm": 762.56,
          "18mm": 865.4,
          "25mm": null
        }
      },
      {
        "id": "duratex-2",
        "name": "Cimentícios/Pedras > Conceito",
        "colors": [
          "Arenito"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-3",
        "name": "Cimentícios/Pedras > Sense",
        "colors": [
          "Downtown"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-4",
        "name": "Cimentícios/Pedras > Singular",
        "colors": [
          "Rocha Rara FL 10/03/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-5",
        "name": "Coleção Internos > Prisma",
        "colors": [
          "Carvalho Dian",
          "Carvalho Lir"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-6",
        "name": "Coleção Internos > Sense",
        "colors": [
          "Gianduia Puro",
          "Linho Belga",
          "Off White Suave"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-7",
        "name": "Coleção Internos > Trama",
        "colors": [
          "Aurora",
          "Gianduia",
          "Palha",
          "Titânio"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-8",
        "name": "Madeiras Claras > Cross",
        "colors": [
          "Riviera"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-9",
        "name": "Madeiras Claras > Essencial",
        "colors": [
          "Noce Califórnia FL 10/03/2026",
          "Noce Mare",
          "Rovere Sereno FL 10/03/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 385.82,
          "15mm": 550.14,
          "18mm": 620.91,
          "25mm": null
        }
      },
      {
        "id": "duratex-10",
        "name": "Madeiras Claras > Essencial Wood",
        "colors": [
          "Carvalho Batur",
          "Oásis"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 413.37,
          "15mm": 583.3,
          "18mm": 663.99,
          "25mm": null
        }
      },
      {
        "id": "duratex-11",
        "name": "Madeiras Escuras > Essencial Wood",
        "colors": [
          "Álamo FL 10/03/2026",
          "Nogueira Asti",
          "Pau Ferro Natural"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 413.37,
          "15mm": 583.3,
          "18mm": 663.99,
          "25mm": null
        }
      },
      {
        "id": "duratex-12",
        "name": "Madeiras Escuras > Prisma",
        "colors": [
          "Nogueira Cadiz"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-13",
        "name": "Madeiras Médias > Duna",
        "colors": [
          "Amêndola Rústica"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 338.15,
          "15mm": 482.21,
          "18mm": 544.19,
          "25mm": null
        }
      },
      {
        "id": "duratex-14",
        "name": "Madeiras Médias > Essencial",
        "colors": [
          "Noce Amêndoa"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 385.82,
          "15mm": 550.14,
          "18mm": 620.91,
          "25mm": null
        }
      },
      {
        "id": "duratex-15",
        "name": "Madeiras Médias > Essencial Wood",
        "colors": [
          "Cumaru Raiz",
          "Freijó",
          "Itapuã",
          "Jequitibá"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 413.37,
          "15mm": 583.3,
          "18mm": 663.99,
          "25mm": null
        }
      },
      {
        "id": "duratex-16",
        "name": "Madeiras Médias > Prisma",
        "colors": [
          "Larnaca"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-17",
        "name": "Madeiras Nobres > Design",
        "colors": [
          "Absoluto",
          "Carvalho Avelã",
          "Carvalho Berlim",
          "Carvalho Hanover",
          "Carvalho Malva",
          "Carvalho Munique",
          "Moss Absoluto",
          "Nogueira Caiena",
          "Nogueira Flórida",
          "Nogueira Thar",
          "Pérola Absoluto",
          "Trancoso FL 10/03/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 400.91,
          "15mm": 565.7,
          "18mm": 643.95,
          "25mm": null
        }
      },
      {
        "id": "duratex-18",
        "name": "Madeiras Nobres > Thera",
        "colors": [
          "Bétula",
          "Carvalho Brun",
          "Freijó",
          "Nogueira Bourbon",
          "Rovere Braga FL 10/03/2026",
          "Teka Soho",
          "Timborana Silvestre"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-19",
        "name": "Madeiras Ripadas > Design",
        "colors": [
          "Brise FL 10/03/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 400.91,
          "15mm": 565.7,
          "18mm": 643.95,
          "25mm": null
        }
      },
      {
        "id": "duratex-20",
        "name": "Madeiras Ripadas > Essencial Wood",
        "colors": [
          "Riga FL 10/03/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 413.37,
          "15mm": 583.3,
          "18mm": 663.99,
          "25mm": null
        }
      },
      {
        "id": "duratex-21",
        "name": "Metalizados > Essencial",
        "colors": [
          "Prata"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 385.82,
          "15mm": 550.14,
          "18mm": 620.91,
          "25mm": null
        }
      },
      {
        "id": "duratex-22",
        "name": "Metalizados > Sense",
        "colors": [
          "Fusion FL 10/03/2026",
          "Zinco"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-23",
        "name": "Metalizados > Velluto",
        "colors": [
          "Nazca"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-24",
        "name": "Super Matte > Acetinatta",
        "colors": [
          "Branco Diamante",
          "Grafite",
          "Preto",
          "Tartufo"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-25",
        "name": "Tecidos > Conceito",
        "colors": [
          "Bolero FL 10/03/2026",
          "Lana FL 10/03/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-26",
        "name": "Tecidos > Trama",
        "colors": [
          "Carbono FL 10/03/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-27",
        "name": "UltraPremium > Design",
        "colors": [
          "Carvalho Malva"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 583,
          "15mm": 780,
          "18mm": 850,
          "25mm": null
        }
      },
      {
        "id": "duratex-28",
        "name": "UltraPremium > Essencial",
        "colors": [
          "Branco Diamante",
          "Cinza Sagrado",
          "Portoro",
          "Thassos"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 583,
          "15mm": 780,
          "18mm": 850,
          "25mm": null
        }
      },
      {
        "id": "duratex-29",
        "name": "UltraPremium > Essencial Wood",
        "colors": [
          "Freijó",
          "Itapuã"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 583,
          "15mm": 780,
          "18mm": 850,
          "25mm": null
        }
      },
      {
        "id": "duratex-30",
        "name": "UltraPremium > Original",
        "colors": [
          "Branco Ártico",
          "Preto"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 583,
          "15mm": 780,
          "18mm": 850,
          "25mm": null
        }
      },
      {
        "id": "duratex-31",
        "name": "UltraPremium > Trama",
        "colors": [
          "Gianduia",
          "Titânio"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 583,
          "15mm": 780,
          "18mm": 850,
          "25mm": null
        }
      },
      {
        "id": "duratex-32",
        "name": "UltraPremium > Velluto",
        "colors": [
          "Quartzo Bienna"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 583,
          "15mm": 780,
          "18mm": 850,
          "25mm": null
        }
      },
      {
        "id": "duratex-33",
        "name": "Unicolores > Essencial",
        "colors": [
          "Azul Profundo",
          "Azul Secreto",
          "Bege Papiro",
          "Blush",
          "Branco Diamante",
          "Cinza Sagrado",
          "Hibisco",
          "Marrom Retrô",
          "Mint",
          "Moss",
          "Pérola Urbana",
          "Pinole",
          "Rosa Glamour FL 10/03/2026",
          "Rosa Infinito"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 385.82,
          "15mm": 550.14,
          "18mm": 620.91,
          "25mm": null
        }
      },
      {
        "id": "duratex-34",
        "name": "Unicolores > Original",
        "colors": [
          "Branco Ártico",
          "Cristal",
          "Ovo",
          "Preto"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 305.86,
          "15mm": 370.79,
          "18mm": 439.46,
          "25mm": null
        }
      },
      {
        "id": "duratex-35",
        "name": "Unicolores > Trama",
        "colors": [
          "Branco Ártico",
          "Branco Diamante",
          "Grafite",
          "Preto"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-36",
        "name": "Unicolores > Velluto",
        "colors": [
          "Azul Astral",
          "Cinza Fóssil",
          "Gianduia Natural",
          "Ocre Solar",
          "Verde Floresta"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 397.82,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      }
    ]
  },
  "Eucatex": {
    "brandName": "Eucatex",
    "type": "brand",
    "lines": [
      {
        "id": "eucatex-1",
        "name": "Chapas p/ Móveis MDF Eucafibra > Grafis",
        "colors": [
          "BP GRAFIS Arenas",
          "BP GRAFIS Cinnamon FL MAIO/2025",
          "BP GRAFIS Fumê Clássico",
          "BP GRAFIS Verde Amalfi"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 310,
          "15mm": 440,
          "18mm": 510,
          "25mm": null
        }
      },
      {
        "id": "eucatex-2",
        "name": "Chapas p/ Móveis MDF Eucafibra > Matt Plus",
        "colors": [
          "BP MATT PLUS Branco Max"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 180,
          "15mm": 230,
          "18mm": 280,
          "25mm": null
        }
      },
      {
        "id": "eucatex-3",
        "name": "Chapas p/ Móveis MDF Eucafibra > Matt Soft",
        "colors": [
          "BP MATT SOFT Areia Noronha",
          "BP MATT SOFT Blue Sky FL MAIO/2025",
          "BP MATT SOFT Cacau Natural",
          "BP MATT SOFT Castanho Bronze FL MAIO/2025",
          "BP MATT SOFT Cinza Supremo",
          "BP MATT SOFT Cristal Aqua",
          "BP MATT SOFT Dunas",
          "BP MATT SOFT Elmo Macciato FL MAIO/2025",
          "BP MATT SOFT Freijó",
          "BP MATT SOFT Italian Noce",
          "BP MATT SOFT Pétala Rosa",
          "BP MATT SOFT Quartzo Bege",
          "BP MATT SOFT Verde Mar",
          "Ébano"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 295,
          "15mm": 420,
          "18mm": 495,
          "25mm": null
        }
      },
      {
        "id": "eucatex-4",
        "name": "Chapas p/ Móveis MDF Eucafibra > Poro SuperMatt",
        "colors": [
          "BP PORO Suíçota",
          "BP PORO SUPERMATT Amêndoa Natural",
          "BP PORO SUPERMATT Carvalho Brasileiro",
          "BP PORO SUPERMATT Carvalho Tropical",
          "BP PORO SUPERMATT Cumaru Nativo",
          "BP PORO SUPERMATT Imbuia Caiapó",
          "BP PORO SUPERMATT Itaparica",
          "BP PORO SUPERMATT Louro Freijó",
          "BP PORO SUPERMATT Madero Cacau",
          "BP PORO SUPERMATT Madero Cinza",
          "BP PORO SUPERMATT Nevada",
          "BP PORO SUPERMATT Tauari Amazônia"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320,
          "15mm": 450,
          "18mm": 520,
          "25mm": null
        }
      },
      {
        "id": "eucatex-5",
        "name": "Chapas p/ Móveis MDF Eucafibra > Raízes",
        "colors": [
          "BP Raízes Carbono FL MAIO/2025",
          "BP Raízes Carvalho Canela",
          "BP Raízes Freijó",
          "BP Raízes Imbuia Terra",
          "BP Raízes Lâmina Dourada",
          "BP Raízes Lâmina Naturalle FL MAIO/2025",
          "BP Raízes Natural Oak",
          "BP Raízes Noce Oro",
          "BP Raízes Nórdico",
          "BP Raízes Peroba Rosa"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 325,
          "15mm": 460,
          "18mm": 530,
          "25mm": null
        }
      },
      {
        "id": "eucatex-6",
        "name": "Chapas p/ Móveis MDF Eucafibra > Tx Premium",
        "colors": [
          "BP TEXTURIZADO Bianco Ártico",
          "BP TEXTURIZADO Preto",
          "BP TEXTURIZADO Preto FL ABRIL/2024 NÃO UTILIZADO"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 290,
          "15mm": 410,
          "18mm": 480,
          "25mm": null
        }
      },
      {
        "id": "eucatex-7",
        "name": "Chapas p/ Móveis MDF Eucafibra Lacca > AD",
        "colors": [
          "Ébano",
          "LACCA AD Amarelo Gema",
          "LACCA AD Branco Neve",
          "LACCA AD Cacau Natural",
          "LACCA AD Cinza Itália",
          "LACCA AD Cinza Supremo",
          "LACCA AD Desert Rose",
          "LACCA AD Fumê",
          "LACCA AD Grafite Intenso",
          "LACCA AD Grey Sky FL MAIO/2025",
          "LACCA AD Nogal Leonardo",
          "LACCA AD Preto Ônix",
          "LACCA AD Sand Color",
          "LACCA AD Verde Bellagio",
          "LACCA AD Verde Mar"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 380,
          "15mm": 520,
          "18mm": 610,
          "25mm": null
        }
      },
      {
        "id": "eucatex-8",
        "name": "Chapas p/ Móveis MDF Eucafibra Lacca > Metallic",
        "colors": [
          "LACCA METALLIC Argento",
          "LACCA METALLIC Escovado",
          "LACCA METALLIC Galáxia",
          "LACCA METALLIC Oxid"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 380,
          "15mm": 520,
          "18mm": 610,
          "25mm": null
        }
      },
      {
        "id": "eucatex-9",
        "name": "Chapas p/ Móveis MDP Eucafibra > Tx Premium",
        "colors": [
          "BP TEXTURIZADO Argila",
          "BP TEXTURIZADO Azul Royal",
          "BP TEXTURIZADO Bege Light",
          "BP TEXTURIZADO Bege Light VERTICAL FL ABRIL/2024",
          "BP TEXTURIZADO Branco Light",
          "BP TEXTURIZADO Cinza Cobalto",
          "BP TEXTURIZADO Cinza Cristal Light",
          "BP TEXTURIZADO Cinza Cristal Light HORIZONTAL FL ABRIL/2024",
          "BP TEXTURIZADO Preto",
          "BP TEXTURIZADO Preto HORIZONTAL FL ABRIL/2024"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 290,
          "15mm": 410,
          "18mm": 480,
          "25mm": null
        }
      },
      {
        "id": "eucatex-10",
        "name": "Chapas p/ Móveis MDP Eucafibra Lacca > AD",
        "colors": [
          "LACCA AD Branco Neve",
          "LACCA AD Branco Neve HORIZONTAL FL ABRIL/2024"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 380,
          "15mm": 520,
          "18mm": 610,
          "25mm": null
        }
      },
      {
        "id": "eucatex-11",
        "name": "Pisos > Classic",
        "colors": [
          "Acácia Andorra",
          "Bétula",
          "Carvalho Milano",
          "Teca Brasil"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 120,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-12",
        "name": "Pisos > Elegance",
        "colors": [
          "Bétula",
          "Carvalho Chamonix",
          "Carvalho Córdoba",
          "Carvalho Madri",
          "Carvalho Sevilha",
          "Decapê Bianche",
          "Freijó",
          "Legno Claro",
          "Mont Blanc",
          "Nogueira Bilbao",
          "NogueiRústico",
          "Teca Brasil"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 120,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-13",
        "name": "Pisos > Prime",
        "colors": [
          "Carvalho",
          "Carvalho Maiorca",
          "Castor",
          "Haya",
          "Ipê",
          "Marfim",
          "Marfim Tropical",
          "Pátina Bege",
          "Tauari"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 120,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-14",
        "name": "Pisos > Residence",
        "colors": [
          "Acácia",
          "Bambu Tropical",
          "CaRústico",
          "Carvalho Firenze",
          "Carvalho Valência",
          "Decapê",
          "Freijó",
          "Haya Cristal",
          "Ipê",
          "Marfim Pérola"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 120,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-15",
        "name": "Pisos > Rustic",
        "colors": [
          "Carvalho Antigo",
          "Carvalho Córdoba",
          "Casablanca",
          "Decapê Blanche",
          "NogueiRústico"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 120,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      }
    ]
  },
  "Fórmica": {
    "brandName": "Fórmica",
    "type": "brand",
    "lines": [
      {
        "id": "formica-1",
        "name": "Crude Collection",
        "colors": [
          "F 01 - Oxid",
          "F 05 - Corten",
          "F 658 - Maranello",
          "F 696 - Concreto"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-2",
        "name": "Design",
        "colors": [
          "FX 01 - Ethnic H",
          "FX 01 - Ethnic V",
          "FX 02 - Talavera",
          "FX 03 - Forest",
          "FX 04 - Mesh",
          "FX 05 - Shapes",
          "FX 06 - Diamond",
          "FX 07 - Vintage"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-3",
        "name": "Facility",
        "colors": [
          "F 05 - Corten (SO)",
          "F 663 - Lino Naturales (TC)",
          "F 696 - Concreto (SO)",
          "L 013 - Grafito (BR)",
          "L 013 - Grafito (TM)",
          "L 101 - Vermelho Cardeal (BR)",
          "L 103 - Cerâmica (BR)",
          "L 108 - Ovo (BR)",
          "L 121 - Preto (BR)",
          "L 121 - Preto (RU)",
          "L 122 - Mediterranée (BR)",
          "L 144 - Goiaba (BS)",
          "L 147 - Café (BR)",
          "L 150 - Azul Mineral (BR)",
          "L 158 - Verde Pastel (BR)",
          "L 158 - Verde Pastel (BS)",
          "L 190 - Polar (BR)",
          "L 190 - Polar (RU)",
          "L 523 - Novo Cromo Real (BR)",
          "L 562 - Corda (BR)",
          "L 574 - Acqua (BR)",
          "L 575 - Cotton Candy (BR)",
          "L 577 - True Taupe (BR)",
          "LN 80 - Fendi (BR)",
          "LT 56 - Vibrant Green (BR)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-4",
        "name": "Joint Collection",
        "colors": [
          "M 880 - Butcher Wood",
          "M 888 - Teka Natural",
          "M 981 - Tagliare",
          "MD 07 - Patchwood"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-5",
        "name": "Metalic Collection",
        "colors": [
          "F 272 - Metalic H",
          "F 272 - Metalic V"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 260,
          "15mm": 360,
          "18mm": 440,
          "25mm": null
        }
      },
      {
        "id": "formica-6",
        "name": "Natural Wood",
        "colors": [
          "N 701 - Dakar Wood",
          "N 703 - Lancaster Wood",
          "N 704 - Castle Wood",
          "N 705 - Coconut",
          "N 706 - Eternit Walnut"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-7",
        "name": "Pedras",
        "colors": [
          "F 230 - Alicante",
          "F 246 - Mármore Cinza",
          "F 248 - Mármore Carrara",
          "F 271 - Mármore Branco",
          "F 281 - Granito Negro",
          "F 653 - Granito Ubatuba",
          "F 655 - Granito Labrador",
          "FF 37 - Granito Bertioga",
          "FT 86 - Slate Burgos"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 240,
          "15mm": 330,
          "18mm": 405,
          "25mm": null
        }
      },
      {
        "id": "formica-8",
        "name": "Person > Bone",
        "colors": [
          "L 108 - Ovo Bone",
          "L 120 - Branco Bone",
          "L 562 - Corda Bone"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-9",
        "name": "Person > Grego",
        "colors": [
          "L 018 - Azul Lago Grego",
          "L 158 - Verde Pastel Grego",
          "L 551 - Laranja Grego"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-10",
        "name": "Person > Halftones",
        "colors": [
          "L 515 - Branco Real Halfmax",
          "L 515 - Branco Real Halfmedio",
          "L 515 - Branco Real Halfmini"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-11",
        "name": "Real Color",
        "colors": [
          "L 101 - Vermelho Cardeal",
          "L 121 - Preto",
          "L 151 - Prattan",
          "L 515 - Branco Real",
          "L 523 - Cromo Real",
          "L 551 - Laranja",
          "L 562 - Corda",
          "LT 54 - Morado Castilla"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 210,
          "15mm": 295,
          "18mm": 360,
          "25mm": null
        }
      },
      {
        "id": "formica-12",
        "name": "Sparks",
        "colors": [
          "L 101 - Vermelho Cardeal",
          "L 121 - Preto",
          "L 515 - Branco Real"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-13",
        "name": "Unicolores > Cold",
        "colors": [
          "L 012 - Azul cobalto",
          "L 019 - Lapis Lázuli",
          "L 113 - Verde Oficial",
          "L 117 - Azul Real",
          "L 122 - Mediterranée",
          "L 131 - Verde Oliva",
          "L 150 - Azul Mineral",
          "L 158 - Verde Pastel",
          "LT 54 - Morado Castilla",
          "LT 56 - Vibrant Green"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 195,
          "15mm": 280,
          "18mm": 340,
          "25mm": null
        }
      },
      {
        "id": "formica-14",
        "name": "Unicolores > Fashion",
        "colors": [
          "L 013 - Grafito",
          "L 114 - Petroleo",
          "L 121 - Preto",
          "L 132 - Bege",
          "L 138 - Vinho",
          "L 144 - Goiaba",
          "L 147 - Café",
          "L 151 - Prattan",
          "L 178 - Azul Noturno",
          "L 515 - Branco Real",
          "L 560 - Verde Bambu",
          "L 562 - Corda",
          "L 573 - Nude",
          "L 576 - Avelã",
          "LN 80 - Fendi"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 195,
          "15mm": 280,
          "18mm": 340,
          "25mm": null
        }
      },
      {
        "id": "formica-15",
        "name": "Unicolores > Light",
        "colors": [
          "Íris",
          "L 004 - Azul Neon",
          "L 012 - Azul Cobalto",
          "L 018 - Azul Lago",
          "L 022 - Malibú",
          "L 105 - Amarelo Claro",
          "L 106 - Gelo",
          "L 108 - Ovo",
          "L 112 - Almond",
          "L 118 - Cobalto",
          "L 119 - Cinza Claro",
          "L 139 - Platina",
          "L 141 - Marfim Claro",
          "L 148 - Salmon",
          "L 155 - Foggy",
          "L 166 - Ártico",
          "L 190 - Polar",
          "L 564 - Grape",
          "L 575 - Cotton Candy",
          "L 577 - True Taupe"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 195,
          "15mm": 280,
          "18mm": 340,
          "25mm": null
        }
      },
      {
        "id": "formica-16",
        "name": "Unicolores > Retrô",
        "colors": [
          "L 011 - Verde Oasis",
          "L 101 - Vermelho Cardeal",
          "L 103 - Cerâmica",
          "L 110 - Verde Claro",
          "L 115 - Azul Francês",
          "L 120 - Branco",
          "L 523 - Cromo Real",
          "L 551 - Laranja",
          "L 553 - Mostarda",
          "L 555 - Pink",
          "L 574 - Acqua"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 195,
          "15mm": 280,
          "18mm": 340,
          "25mm": null
        }
      },
      {
        "id": "formica-17",
        "name": "Unlimited Design > Cloth",
        "colors": [
          "F 660 - Line Cross",
          "F 663 - Lino Naturales",
          "FB 02 - Soft",
          "Íris"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-18",
        "name": "Unlimited Design > Leather",
        "colors": [
          "F 665 Leader White",
          "F 667 Natural Leather"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 220,
          "15mm": 310,
          "18mm": 380,
          "25mm": null
        }
      },
      {
        "id": "formica-19",
        "name": "Wood Collection > Africanas",
        "colors": [
          "M 831 - Zebrano",
          "M 850 - Teka Italy",
          "M 882 - Olive Tree",
          "M 893 - Laricina",
          "M 955 - Bambu Tajimi",
          "M 956 - Verin",
          "M 959 Africa"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-20",
        "name": "Wood Collection > Carvalho",
        "colors": [
          "M 460 - Canadian Light",
          "M 817 - Carvalho Tasmania",
          "M 818 - Massal",
          "M 821 - Carvalho Linheiro",
          "M 844 - Carvalho Cinza",
          "M 848 - Moldau",
          "M 849 - Carvalho Real",
          "M 858 - Teka Brasil",
          "M 868 - Wallis Plum",
          "M 905 - Cherry",
          "MD 06 - Tauari Prata",
          "MD 22 - Chenê Linheiro"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-21",
        "name": "Wood Collection > Contemporâneas",
        "colors": [
          "M 906 - Salina",
          "M 908 - Walnut",
          "M 911 - Alpino Walnut",
          "M 978 - Carbonizzato",
          "M 980 - Boliana",
          "M 988 - Nogueira Nodo",
          "MD 01 - Turin",
          "MD 02 - Bork Maple",
          "MD 03 - Alder",
          "MD 04 - Larix Branco",
          "MD 23 - Compensado"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-22",
        "name": "Wood Collection > Demolição",
        "colors": [
          "M 820 - Ergonoce",
          "M 877 - Noce Solista",
          "M 896 - Old Pekan",
          "M 898 - Patina Old",
          "M 903 - Ameixa Negra",
          "M 907 - Venezia",
          "MD 27 - Woodland"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-23",
        "name": "Wood Collection > Joint",
        "colors": [
          "M 880 - Butcher Wood",
          "M 888 - Teka Natural",
          "M 981 - Tagliare",
          "MD 07 - Patchwood"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-24",
        "name": "Wood Collection > Pré-Composta",
        "colors": [
          "M 405 - Chocolate",
          "M 812 - Hazel Linheiro",
          "M 813 - Rose Linheiro",
          "M 814 - Mel Linheiro",
          "M 815 - Bege Linheiro",
          "MP 54 - Linheiro Cinza"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-25",
        "name": "Wood Collection > Retrô",
        "colors": [
          "M 881 - Canyon",
          "M 884 - Teka Provence",
          "M 894 - Maliana",
          "MD 24 - American"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-26",
        "name": "Wood Collection > Saw Cut",
        "colors": [
          "M 957 - Santana",
          "M 975 - Righello Bianco",
          "M 976 - Righello Beigel",
          "M 977 - Righello Marrone"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-27",
        "name": "Wood Collection > Tropicais",
        "colors": [
          "M 411 - Mogno",
          "M 412 - Marfim Natural",
          "M 413 - Pau Marfim",
          "M 418 - Marfim Montreal",
          "M 439 - Sumaúma",
          "M 450 - Nogal Escuro",
          "M 452 - Mogno Sevilha",
          "M 472 - Acacia",
          "M 497 - Nogal Pegaso",
          "M 807 - Freijó",
          "M 819 - Freijó",
          "M 852 - Imbuia",
          "MD 25 - Nogueira",
          "MD 26 - Castanheira"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      },
      {
        "id": "formica-28",
        "name": "Wood Collection > Wengué",
        "colors": [
          "M 448 - Wengué",
          "M 909 - Sweet line",
          "M 954 - Arusha",
          "M 979 - Wengué"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 225,
          "15mm": 315,
          "18mm": 385,
          "25mm": null
        }
      }
    ]
  },
  "Greenplac": {
    "brandName": "Greenplac",
    "type": "brand",
    "lines": [
      {
        "id": "greenplac-1",
        "name": "Colore",
        "colors": [
          "Arenza",
          "Ária",
          "Azuro",
          "Cromato",
          "Giardino",
          "Granile",
          "Greige",
          "Lago",
          "Moccato",
          "Petale",
          "Plié",
          "Verbenni",
          "Vitra"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 280.17,
          "15mm": 395.99,
          "18mm": 457.63,
          "25mm": null
        }
      },
      {
        "id": "greenplac-2",
        "name": "Decore",
        "colors": [
          "Nox",
          "Pietra Bronze",
          "Seline Frizzo",
          "Tóquio Frizzo"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 315.75,
          "15mm": 461.92,
          "18mm": 533.8,
          "25mm": null
        }
      },
      {
        "id": "greenplac-3",
        "name": "Decore > Lisas",
        "colors": [
          "Build - FL 06/02/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 315.75,
          "15mm": 461.92,
          "18mm": 533.8,
          "25mm": null
        }
      },
      {
        "id": "greenplac-4",
        "name": "Essenziale",
        "colors": [
          "Araton",
          "Avellano",
          "Caput - FL 06/02/2026",
          "Carmel",
          "Carvalho Avenna",
          "Freijó",
          "Garanza",
          "Nogueira Romani",
          "Pale",
          "Raven"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 289.54,
          "15mm": 423.79,
          "18mm": 457.63,
          "25mm": null
        }
      },
      {
        "id": "greenplac-5",
        "name": "Matiz",
        "colors": [
          "Cascais",
          "Londres",
          "Luanda",
          "Suíço",
          "Tóquio",
          "Verona - FL 06/02/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 304.09,
          "15mm": 445.07,
          "18mm": 514.07,
          "25mm": null
        }
      },
      {
        "id": "greenplac-6",
        "name": "Natural",
        "colors": [
          "Bali",
          "Bamboo Reserva",
          "Carvalho Catedral",
          "Freijó",
          "Ipê",
          "Jade",
          "Jequitibá",
          "Málaga",
          "Nilo",
          "Noronha",
          "Veredas",
          "Versalhes",
          "Villandry"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 304.09,
          "15mm": 445.07,
          "18mm": 514.07,
          "25mm": null
        }
      },
      {
        "id": "greenplac-7",
        "name": "Texture",
        "colors": [
          "Linare",
          "Nerali - FL 06/02/2026",
          "Nevari",
          "Nottie",
          "Rosato - FL 06/02/2026",
          "Seline",
          "Volato"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 289.54,
          "15mm": 423.79,
          "18mm": 489.63,
          "25mm": null
        }
      }
    ]
  },
  "Guararapes": {
    "brandName": "Guararapes",
    "type": "brand",
    "lines": [
      {
        "id": "guararapes-1",
        "name": "Colors",
        "colors": [
          "Alecrim",
          "Areia",
          "Azul Ardósia",
          "Azul Petróleo",
          "Brisa",
          "Capuccino",
          "Cinza Perfeito",
          "Cinza Urban",
          "Doce de Leite",
          "Erva Mate",
          "Grafite",
          "Lume",
          "Mangue",
          "Marrom Sépia",
          "Marsala",
          "Maxi Branco",
          "Nuvem",
          "Rosa Milkshake",
          "Tijolo",
          "Verde Oliva"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 422.96,
          "15mm": 589.4,
          "18mm": 686.08,
          "25mm": null
        }
      },
      {
        "id": "guararapes-2",
        "name": "Comfort",
        "colors": [
          "Aura - FL ABRIL/2026",
          "Bronze",
          "Gali - FL ABRIL/2026",
          "Jaspe - FL ABRIL/2026",
          "Tear",
          "Tela"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 404.9,
          "15mm": 561.33,
          "18mm": 653.37,
          "25mm": null
        }
      },
      {
        "id": "guararapes-3",
        "name": "Flex",
        "colors": [
          "Bilbao",
          "Branco Iceland",
          "Cipres",
          "Fendi",
          "Lisboa",
          "Nogal Sevilha",
          "Platina - FL ABRIL/2026",
          "Preto Silk",
          "Teka Bianco",
          "Terrino"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 404.9,
          "15mm": 561.33,
          "18mm": 653.37,
          "25mm": null
        }
      },
      {
        "id": "guararapes-4",
        "name": "Íris",
        "colors": [
          "Ametista",
          "Azul Marinho",
          "Neblina",
          "Noite"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 1164.33,
          "15mm": 1250,
          "18mm": 1322.43,
          "25mm": null
        }
      },
      {
        "id": "guararapes-5",
        "name": "Madeiras do Brasil",
        "colors": [
          "Ária",
          "Curupixá",
          "Freijó",
          "Imbuia",
          "Pau-Ferro",
          "Peroba",
          "Tauari"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 446.92,
          "15mm": 629.7,
          "18mm": 736.86,
          "25mm": null
        }
      },
      {
        "id": "guararapes-6",
        "name": "Madeiras do Mundo",
        "colors": [
          "Alabama",
          "Antiqua",
          "Antuérpia",
          "Baviera",
          "Caribe",
          "Carvalho Capri",
          "Carvalho Natural",
          "Carvalho Nórdico",
          "Fresno Açores",
          "Fresno Aveiro",
          "Fresno Coimbra",
          "Fresno Douro",
          "Fresno Madeira",
          "Nero",
          "Nogal Champagne",
          "Nogueira Âmbar",
          "Nogueira Rubi",
          "Salerno",
          "Savana",
          "Sonora"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 446.92,
          "15mm": 629.7,
          "18mm": 736.86,
          "25mm": null
        }
      },
      {
        "id": "guararapes-7",
        "name": "Madeiras Geométricas",
        "colors": [
          "Curupixá Ripado - FL ABRIL/2026",
          "Mageo Carvalho",
          "Mageo Imbuia",
          "Mageo Mel",
          "Tauari Ripado - FL ABRIL/2026"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 474.38,
          "15mm": 667.31,
          "18mm": 779.99,
          "25mm": null
        }
      },
      {
        "id": "guararapes-8",
        "name": "Magma",
        "colors": [
          "Cosmos",
          "Crômio",
          "Fontana",
          "Marmo",
          "Petra",
          "Quartzo",
          "Santorini"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 422.96,
          "15mm": 589.4,
          "18mm": 686.08,
          "25mm": null
        }
      },
      {
        "id": "guararapes-9",
        "name": "Metalic",
        "colors": [
          "Cobre",
          "Corten",
          "Metal Champagne",
          "Níquel",
          "Ônix",
          "Tecno"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 348.79,
          "15mm": 621.1,
          "18mm": 726.78,
          "25mm": null
        }
      },
      {
        "id": "guararapes-10",
        "name": "Perspectivas",
        "colors": [
          "Floresta",
          "São Paulo"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 522.43,
          "15mm": 690,
          "18mm": 842.51,
          "25mm": null
        }
      }
    ]
  },
  "Sudati": {
    "brandName": "Sudati",
    "type": "brand",
    "lines": [
      {
        "id": "sudati-1",
        "name": "Atma",
        "colors": [
          "Aurum",
          "Gramado",
          "Jeri",
          "Marajó",
          "Palmas"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 320,
          "15mm": 450,
          "18mm": 520,
          "25mm": null
        }
      },
      {
        "id": "sudati-2",
        "name": "Clássicos",
        "colors": [
          "Bege",
          "Branco",
          "Cinza Cristal",
          "Preto"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 176,
          "15mm": 220,
          "18mm": 270,
          "25mm": null
        }
      },
      {
        "id": "sudati-3",
        "name": "Eleva",
        "colors": [
          "Carvalho Milenar",
          "Carvalho Nobre",
          "Cumaru",
          "Imbirema",
          "Ipê",
          "Itaúba",
          "Jequitibá",
          "Nogueira Americana",
          "Nogueira Itália",
          "Palissandro Dourado",
          "Pau-Ferro",
          "Tauari"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 330,
          "15mm": 460,
          "18mm": 530,
          "25mm": null
        }
      },
      {
        "id": "sudati-4",
        "name": "Naturally",
        "colors": [
          "Bellini",
          "Bianco Ravena",
          "Cabernet",
          "Carvalho Castelli",
          "Carvalho Lino",
          "Carvalho Natural",
          "Corazzi",
          "Imbuia",
          "Leon",
          "Louro Freijó",
          "Moscato FL ABRIL/2024",
          "Tempranillo",
          "Trebbiano Blanc FL ABRIL/2024",
          "Versati"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 325,
          "15mm": 455,
          "18mm": 525,
          "25mm": null
        }
      },
      {
        "id": "sudati-5",
        "name": "Soul",
        "colors": [
          "Alessi",
          "Asti",
          "Basalto Português",
          "Jaspe",
          "Lina",
          "Pisano",
          "Rosselli FL ABRIL/2024",
          "Taipa"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 340,
          "15mm": 470,
          "18mm": 540,
          "25mm": null
        }
      },
      {
        "id": "sudati-6",
        "name": "TX",
        "colors": [
          "Glamour",
          "Mineral",
          "Vulcano"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 310,
          "15mm": 430,
          "18mm": 490,
          "25mm": null
        }
      },
      {
        "id": "sudati-7",
        "name": "Unicolores",
        "colors": [
          "Amazônia",
          "Argel",
          "Cambiasi",
          "Cancún",
          "Floripa",
          "Havana",
          "Manhattan",
          "Pipa",
          "Sampa",
          "Santiago"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 300,
          "15mm": 420,
          "18mm": 480,
          "25mm": null
        }
      }
    ]
  },
  "Bernek": {
    "brandName": "Bernek",
    "type": "brand",
    "lines": [
      {
        "id": "berneck-1",
        "name": "Amadeirados Claros",
        "colors": [
          "Amantea Tatto",
          "Barrique Tatto",
          "Carvalho Japandi (Micro)",
          "Carvalho Treviso (Design)",
          "Cerejeira Clara (Grann)",
          "Cerejeira Natural (Grann)",
          "Chiaro (VEL)",
          "Faia (Grann)",
          "Galiano (Grann)",
          "Parquet (Grann)",
          "Provence Tatto"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 309.05,
          "15mm": 442.12,
          "18mm": 506.25,
          "25mm": null
        }
      },
      {
        "id": "berneck-2",
        "name": "Amadeirados Escuros",
        "colors": [
          "Cacau (Grann)",
          "Castaine (Tatto)",
          "Louro Preto (Grann)",
          "Nogal Artezzano (Grann)",
          "Nogal Málaga (Design)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 309.05,
          "15mm": 442.12,
          "18mm": 506.25,
          "25mm": null
        }
      },
      {
        "id": "berneck-3",
        "name": "Amadeirados Médios",
        "colors": [
          "Cinamomo (Grann)",
          "Frassino Almendra (Poro)",
          "Freijó",
          "Gengibre (Tatto)",
          "Griseo (Grann)",
          "Italian Noce (Poro)",
          "Jequitibá",
          "Louro Freijó",
          "Mogno Imperial (Grann)",
          "Nogal Sevilha (Poro)",
          "Peroba (Tatto)",
          "Roble Catedral (Grann)",
          "Roble Catedral (Grann)_Não excluir",
          "Solanum (Grann)",
          "Veneer (Grann)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      },
      {
        "id": "berneck-4",
        "name": "Combine Fácil > Fantasias",
        "colors": [
          "Argento (Rust)",
          "Basalto (Rust)",
          "Falésia (VEL)",
          "Nero (Rust)",
          "Terrazza (Micro)",
          "Volakas (Micro)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 309.05,
          "15mm": 442.12,
          "18mm": 506.25,
          "25mm": null
        }
      },
      {
        "id": "berneck-5",
        "name": "Combine Fácil > Tecidos",
        "colors": [
          "Lana (Vel)",
          "Linen Grígio (VEL)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      },
      {
        "id": "berneck-6",
        "name": "Combine Fácil > Unicolores",
        "colors": [
          "Azul (TX)",
          "Azul (VEL)",
          "Azul Galeno (Micro)",
          "Baru (Micro)",
          "Bege (TX)",
          "Branco (Design)",
          "Branco (LSF)",
          "Branco (Micro)",
          "Branco (TX)",
          "Branco (VEL)",
          "Branco Super White (Micro)",
          "Ceramik (Micro)",
          "Cinza Argila (TX)",
          "Cinza Cobalto (TX)",
          "Cinza Cobalto (VEL)",
          "Cinza Cristal (TX)",
          "Latte (Micro)",
          "Millennial (Micro)",
          "Mostrato (Micro)",
          "Nude (VEL)",
          "Ópera (Micro)",
          "Preto (TX)",
          "Sky (VEL)",
          "Tabasco (Micro)",
          "Tangará (Micro)",
          "Taupe (Micro)",
          "Verti (Micro)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      },
      {
        "id": "berneck-7",
        "name": "Metalizados",
        "colors": [
          "Chumbo (Micro)",
          "Dust (Alumi)",
          "Gold (Alumi)",
          "Metallic Suede (TX)",
          "Plomo (Alumi)",
          "Ruggine (TX)"
        ],
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 324.36,
          "15mm": 461.49,
          "18mm": 521.43,
          "25mm": null
        }
      }
    ]
  },
  "Mão de Obra Fixa": {
    "brandName": "Mão de Obra Fixa",
    "type": "maodeobra",
    "items": [
      {
        "id": "mo-1",
        "name": "Porta Reta",
        "unit": "UN",
        "price": 70,
        "description": "Processo de fabricação de porta reta com fita de borda"
      },
      {
        "id": "mo-2",
        "name": "Porta Cava Horizontal",
        "unit": "UN",
        "price": 70,
        "description": "Usinagem e acabamento de cava horizontal linear"
      },
      {
        "id": "mo-3",
        "name": "Frente Cava Horizontal",
        "unit": "UN",
        "price": 70,
        "description": "Usinagem e acabamento de cava em frente de gaveta"
      },
      {
        "id": "mo-4",
        "name": "Porta Cava 45°",
        "unit": "UN",
        "price": 85,
        "description": "Corte e usinagem de chanfro a 45 graus para puxador"
      },
      {
        "id": "mo-5",
        "name": "Porta Alumínio com Vidro",
        "unit": "UN",
        "price": 130,
        "description": "Montagem de esquadria de alumínio e encaixe de vidro"
      },
      {
        "id": "mo-6",
        "name": "Usinagem Especial / Passa-cabos",
        "unit": "UN",
        "price": 35,
        "description": "Furação e acabamento para passagens e tomadas"
      },
      {
        "id": "mo-7",
        "name": "Montagem de Gaveta Completa",
        "unit": "UN",
        "price": 40,
        "description": "Montagem de caixa de gaveta e fixação de corrediça"
      },
      {
        "id": "mo-8",
        "name": "Instalação de Articulador / Pistão",
        "unit": "UN",
        "price": 30,
        "description": "Instalação e regulagem de ferragem basculante"
      },
      {
        "id": "mo-9",
        "name": "Montagem Estrutural de Módulo",
        "unit": "UN",
        "price": 60,
        "description": "Pré-montagem na marcenaria de módulo/caixaria"
      },
      {
        "id": "mo-10",
        "name": "Engrosso de Borda Dupla (M²)",
        "unit": "M2",
        "price": 45,
        "description": "Colagem e acabamento de engrosso 30mm/36mm"
      }
    ]
  }
};

/**
 * Sanitiza e mescla o catálogo salvo (do localStorage ou Supabase) com o catálogo oficial INITIAL_CHAPAS_CATALOG.
 * Garante que todas as 8 marcas oficiais e 'Mão de Obra Fixa' existam com suas linhas, cores e propriedades seguras,
 * preservando quaisquer preços customizados que o operador já tenha salvo.
 */
export function sanitizeAndMergeCatalog(savedCat: unknown): CatalogByBrand {
  if (!savedCat || typeof savedCat !== 'object') {
    return JSON.parse(JSON.stringify(INITIAL_CHAPAS_CATALOG));
  }

  const raw = savedCat as Record<string, any>;
  const result: CatalogByBrand = JSON.parse(JSON.stringify(INITIAL_CHAPAS_CATALOG));

  // Remove Acessórios e aliases legados
  delete (raw as any)['Acessórios'];
  delete (raw as any)['Bernek'];

  for (const brand of Object.keys(INITIAL_CHAPAS_CATALOG)) {
    if (brand === 'Acessórios' || brand === 'Bernek') continue;

    const initialBrand = INITIAL_CHAPAS_CATALOG[brand];
    const savedBrand = raw[brand];

    if (!savedBrand) {
      continue;
    }

    if (initialBrand.type === 'brand') {
      const initialLines = initialBrand.lines;
      const savedLines = Array.isArray(savedBrand.lines) ? savedBrand.lines : [];

      const mergedLines: ChapaLineItem[] = initialLines.map(initLine => {
        const matchSaved = savedLines.find((sl: any) =>
          sl && (sl.id === initLine.id || (typeof sl.name === 'string' && sl.name.toLowerCase() === initLine.name.toLowerCase()))
        );

        const prices = {
          '6mm': (matchSaved?.prices && typeof matchSaved.prices['6mm'] === 'number')
            ? matchSaved.prices['6mm']
            : initLine.prices['6mm'],
          '15mm': (matchSaved?.prices && typeof matchSaved.prices['15mm'] === 'number')
            ? matchSaved.prices['15mm']
            : initLine.prices['15mm'],
          '18mm': (matchSaved?.prices && typeof matchSaved.prices['18mm'] === 'number')
            ? matchSaved.prices['18mm']
            : initLine.prices['18mm'],
          '25mm': (matchSaved?.prices && typeof matchSaved.prices['25mm'] === 'number')
            ? matchSaved.prices['25mm']
            : initLine.prices['25mm'],
        };

        const savedColors = Array.isArray(matchSaved?.colors)
          ? matchSaved.colors.filter((c: any) => typeof c === 'string' && c.trim())
          : [];
        const colorSet = new Set<string>([...initLine.colors, ...savedColors]);

        return {
          ...initLine,
          colors: Array.from(colorSet),
          prices,
          width: typeof matchSaved?.width === 'number' ? matchSaved.width : initLine.width,
          height: typeof matchSaved?.height === 'number' ? matchSaved.height : initLine.height,
          area: typeof matchSaved?.area === 'number' ? matchSaved.area : initLine.area,
        };
      });

      // Preserva linhas adicionais customizadas pelo usuário
      for (const sl of savedLines) {
        if (
          sl &&
          sl.id &&
          typeof sl.name === 'string' &&
          !mergedLines.some(ml => ml.id === sl.id || ml.name.toLowerCase() === sl.name.toLowerCase())
        ) {
          mergedLines.push({
            id: sl.id,
            name: sl.name,
            colors: Array.isArray(sl.colors) ? sl.colors.filter((c: any) => typeof c === 'string') : [],
            width: typeof sl.width === 'number' ? sl.width : 2.75,
            height: typeof sl.height === 'number' ? sl.height : 1.85,
            area: typeof sl.area === 'number' ? sl.area : 5.09,
            prices: {
              '6mm': sl.prices && typeof sl.prices['6mm'] === 'number' ? sl.prices['6mm'] : null,
              '15mm': sl.prices && typeof sl.prices['15mm'] === 'number' ? sl.prices['15mm'] : null,
              '18mm': sl.prices && typeof sl.prices['18mm'] === 'number' ? sl.prices['18mm'] : null,
              '25mm': sl.prices && typeof sl.prices['25mm'] === 'number' ? sl.prices['25mm'] : null,
            },
          });
        }
      }

      result[brand] = {
        brandName: brand,
        type: 'brand',
        lines: mergedLines,
      };
    } else if (initialBrand.type === 'maodeobra') {
      const initialItems = initialBrand.items;
      const savedItems = Array.isArray(savedBrand.items) ? savedBrand.items : [];

      const mergedItems: MaoDeObraItem[] = initialItems.map(initItem => {
        const matchSaved = savedItems.find((si: any) =>
          si && (si.id === initItem.id || (typeof si.name === 'string' && si.name.toLowerCase() === initItem.name.toLowerCase()))
        );
        return {
          ...initItem,
          price: (matchSaved && typeof matchSaved.price === 'number') ? matchSaved.price : initItem.price,
          unit: (matchSaved && typeof matchSaved.unit === 'string') ? matchSaved.unit : initItem.unit,
          description: (matchSaved && typeof matchSaved.description === 'string') ? matchSaved.description : initItem.description,
        };
      });

      for (const si of savedItems) {
        if (si && si.id && typeof si.name === 'string' && !mergedItems.some(mi => mi.id === si.id)) {
          mergedItems.push({
            id: si.id,
            name: si.name,
            unit: typeof si.unit === 'string' ? si.unit : 'UN',
            price: typeof si.price === 'number' ? si.price : 0,
            description: typeof si.description === 'string' ? si.description : undefined,
          });
        }
      }

      result[brand] = {
        brandName: 'Mão de Obra Fixa',
        type: 'maodeobra',
        items: mergedItems,
      };
    }
  }

  delete result['Acessórios'];
  delete (result as any)['Bernek'];

  return result;
}
