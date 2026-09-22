// Catálogo de Chapas e Linhas por Marca - DF Móveis (base revisada em 2026)

export interface ChapaLineItem {
  id: string;
  name: string;
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

export type CatalogByBrand = Record<string, BrandCatalog | AcessoriosCatalog>;

export const INITIAL_CHAPAS_CATALOG: CatalogByBrand = {
  "Duratex": {
    "brandName": "Duratex",
    "type": "brand",
    "lines": [
      {
        "id": "duratex-1",
        "name": "ULTRA",
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
        "id": "duratex-2",
        "name": "Alto Brilho",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 630.67,
          "15mm": 843.26,
          "18mm": 949.14,
          "25mm": null
        }
      },
      {
        "id": "duratex-3",
        "name": "Cristalo-Liso",
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
        "id": "duratex-4",
        "name": "Conceito",
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
        "name": "Cross",
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
        "id": "duratex-6",
        "name": "Design",
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
        "id": "duratex-7",
        "name": "Duna",
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
        "id": "duratex-8",
        "name": "Essencial Wood",
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
        "id": "duratex-9",
        "name": "Essencial",
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
        "name": "Original",
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
        "id": "duratex-11",
        "name": "Prisma",
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
        "id": "duratex-12",
        "name": "Internos -Trama/Sense/Prisma",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 271.99,
          "15mm": 388.62,
          "18mm": 466.37,
          "25mm": null
        }
      },
      {
        "id": "duratex-13",
        "name": "Unicores -Trama",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 429,
          "15mm": 567.24,
          "18mm": 640.22,
          "25mm": null
        }
      },
      {
        "id": "duratex-14",
        "name": "Unicores -Velluto",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 414.3,
          "15mm": 561,
          "18mm": 675,
          "25mm": null
        }
      },
      {
        "id": "duratex-15",
        "name": "Unicores - essencial",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 379.18,
          "15mm": 506.6,
          "18mm": 569.86,
          "25mm": null
        }
      },
      {
        "id": "duratex-16",
        "name": "Super matt",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 794.41,
          "15mm": 1023.93,
          "18mm": 1146.79,
          "25mm": null
        }
      },
      {
        "id": "duratex-17",
        "name": "Absoluto",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 412.02,
          "15mm": 550.6,
          "18mm": 619.17,
          "25mm": null
        }
      },
      {
        "id": "duratex-18",
        "name": "Fantasia - Sense",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 394.48,
          "15mm": 527.21,
          "18mm": 592.85,
          "25mm": null
        }
      },
      {
        "id": "duratex-19",
        "name": "Fantasia - Conceito",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 379.18,
          "15mm": 506.72,
          "18mm": 569.86,
          "25mm": null
        }
      },
      {
        "id": "duratex-20",
        "name": "Fantasia - Velluto",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 414.15,
          "15mm": 553.63,
          "18mm": 622.6,
          "25mm": null
        }
      },
      {
        "id": "duratex-21",
        "name": "Madeiras Classicas",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 322.35,
          "15mm": 430.6,
          "18mm": 484.83,
          "25mm": null
        }
      },
      {
        "id": "duratex-22",
        "name": "Madeiras Contepôraneas",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 394.48,
          "15mm": 527.21,
          "18mm": 592.85,
          "25mm": null
        }
      },
      {
        "id": "duratex-23",
        "name": "Madeiras Nobres",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 394.48,
          "15mm": 527.21,
          "18mm": 592.85,
          "25mm": null
        }
      },
      {
        "id": "duratex-24",
        "name": "Madeiras Nobres- desing",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 412.06,
          "15mm": 550.64,
          "18mm": 619.22,
          "25mm": null
        }
      }
    ]
  },
  "Arauco": {
    "brandName": "Arauco",
    "type": "brand",
    "lines": [
      {
        "id": "arauco-1",
        "name": "Horizontal\\BRANCO",
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
        "name": "Horizontal\\BRANCO ULTRA",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 323,
          "15mm": 425,
          "18mm": 485,
          "25mm": null
        }
      },
      {
        "id": "arauco-3",
        "name": "ULTRA COR",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 242.06,
          "15mm": 351.23,
          "18mm": 395.13,
          "25mm": null
        }
      },
      {
        "id": "arauco-4",
        "name": "Coleção Sinestesia",
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
        "id": "arauco-5",
        "name": "Coleção Sinestesia-Vert",
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
        "id": "arauco-6",
        "name": "Cores e Tecidos - Chess",
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
        "name": "Cores e Tecidos - Couro",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 369.12,
          "15mm": 515.12,
          "18mm": 578.2,
          "25mm": null
        }
      },
      {
        "id": "arauco-8",
        "name": "Cores e Tecidos - matt/Sethos",
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
        "id": "arauco-9",
        "name": "Madeira Brasileira -trend",
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
        "id": "arauco-10",
        "name": "Madeira Brasileira -Poro",
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
        "id": "arauco-11",
        "name": "Madeiras-trend",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 385.78,
          "15mm": 529.73,
          "18mm": 635.59,
          "25mm": null
        }
      },
      {
        "id": "arauco-12",
        "name": "Madeiras-Nature / Poro/Chess",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 308.33,
          "15mm": 439.71,
          "18mm": 527.52,
          "25mm": null
        }
      },
      {
        "id": "arauco-13",
        "name": "Madeiras- Matt/Bold",
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
        "name": "Pedras e Metais- Vert",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 339.15,
          "15mm": 482.3,
          "18mm": 578.65,
          "25mm": null
        }
      },
      {
        "id": "arauco-15",
        "name": "Pedras e Metais - Liso",
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
        "id": "arauco-16",
        "name": "Coleção Ritmos",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 339.15,
          "15mm": 482.3,
          "18mm": 578.65,
          "25mm": null
        }
      },
      {
        "id": "arauco-17",
        "name": "Dueto",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
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
        "name": "Toccare Colore",
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
        "name": "Toccare Texture",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 289.54,
          "15mm": 423.79,
          "18mm": 489.63,
          "25mm": null
        }
      },
      {
        "id": "greenplac-3",
        "name": "Essenziale",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 289.54,
          "15mm": 423.79,
          "18mm": 489.63,
          "25mm": null
        }
      },
      {
        "id": "greenplac-4",
        "name": "Natural",
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
        "id": "greenplac-5",
        "name": "Moderno",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 360.15,
          "15mm": 492.84,
          "18mm": 557.66,
          "25mm": null
        }
      },
      {
        "id": "greenplac-6",
        "name": "Decore",
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
        "id": "greenplac-7",
        "name": "Matiz",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 304.09,
          "15mm": 445.07,
          "18mm": 514.07,
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
        "id": "bernek-1",
        "name": "Contemporânea",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-2",
        "name": "Design",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-3",
        "name": "Fantasias -  Micro",
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
        "id": "bernek-4",
        "name": "Grann",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-5",
        "name": "Poro",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-6",
        "name": "Play",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-7",
        "name": "Tatto",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-8",
        "name": "Trend Colors",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-9",
        "name": "Unicolores - Micro",
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
        "id": "bernek-10",
        "name": "Sentido",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-11",
        "name": "Tecidos",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "bernek-12",
        "name": "Smart",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 283.81,
          "15mm": 400.98,
          "18mm": 459.6,
          "25mm": null
        }
      },
      {
        "id": "bernek-13",
        "name": "Metalizados",
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
        "id": "bernek-14",
        "name": "Madeiras Claras - Desing",
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
        "id": "bernek-15",
        "name": "Madeiras médias - Grann",
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
        "id": "bernek-16",
        "name": "Madeiras Escuras - Desing",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 309.05,
          "15mm": 442.12,
          "18mm": 506.25,
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
        "name": "Syncro",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 451.78,
          "15mm": 636.55,
          "18mm": 744.87,
          "25mm": null
        }
      },
      {
        "id": "guararapes-2",
        "name": "Touch",
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
        "name": "Colors",
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
        "id": "guararapes-4",
        "name": "Confort",
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
        "id": "guararapes-5",
        "name": "Madeiras do Brasil",
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
        "name": "Magma",
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
        "id": "guararapes-7",
        "name": "Metalic",
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
        "id": "guararapes-8",
        "name": "Mageo",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 474.38,
          "15mm": 667.31,
          "18mm": 779.999,
          "25mm": null
        }
      },
      {
        "id": "guararapes-9",
        "name": "Naturale",
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
        "id": "guararapes-10",
        "name": "Perspectivas",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 522.43,
          "15mm": null,
          "18mm": 842.51,
          "25mm": null
        }
      },
      {
        "id": "guararapes-11",
        "name": "Áris",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 1164.33,
          "15mm": null,
          "18mm": 1322.43,
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
        "name": "Comoditá\\Horizontal\\Carvalho Novara",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": 145,
          "15mm": 200,
          "18mm": 230,
          "25mm": null
        }
      },
      {
        "id": "sudati-2",
        "name": "Comoditá\\Horizontal\\Linho Italiano",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-3",
        "name": "Comoditá\\Horizontal\\Maple Siena",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-4",
        "name": "Comoditá\\Horizontal\\Palermo",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-5",
        "name": "Comoditá\\Horizontal\\Rustic Bari",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-6",
        "name": "Comoditá\\Horizontal\\Versati",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-7",
        "name": "Comoditá\\Horizontal\\Wengue Belluno",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-8",
        "name": "Comoditá\\Horizontal\\Zamora",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-9",
        "name": "Rinascere\\Horizontal\\Alighieri",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-10",
        "name": "Rinascere\\Horizontal\\Botticelli",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-11",
        "name": "Rinascere\\Horizontal\\Bracciolini",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-12",
        "name": "Rinascere\\Horizontal\\Cambiasi",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-13",
        "name": "Rinascere\\Horizontal\\Forli",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-14",
        "name": "Rinascere\\Horizontal\\Melzi",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-15",
        "name": "Rinascere\\Horizontal\\Moroni",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-16",
        "name": "Rinascere\\Horizontal\\Pisano",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-17",
        "name": "Rinascere\\Horizontal\\Rosselli",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-18",
        "name": "Rinascere\\Horizontal\\Vasari",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-19",
        "name": "Rinascere\\Horizontal\\Zenale",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-20",
        "name": "Unicolor\\Branco",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-21",
        "name": "Unicolor\\Bege",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-22",
        "name": "Unicolor\\Cinza Cristal",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-23",
        "name": "Personalitá\\Horizontal\\Cabernet",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-24",
        "name": "Personalitá\\Horizontal\\Carmenere",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-25",
        "name": "Personalitá\\Horizontal\\Merlot",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-26",
        "name": "Personalitá\\Horizontal\\Molinara",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-27",
        "name": "Personalitá\\Horizontal\\Monastrell",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-28",
        "name": "Personalitá\\Horizontal\\Moscato",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-29",
        "name": "Personalitá\\Horizontal\\Nebbiolo",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-30",
        "name": "Personalitá\\Horizontal\\Palomino",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-31",
        "name": "Personalitá\\Horizontal\\Pinot Gris",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-32",
        "name": "Personalitá\\Horizontal\\Tempranillo",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "sudati-33",
        "name": "Personalitá\\Horizontal\\Trebbiano Blanc",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      }
    ]
  },
  "Acessórios": {
    "brandName": "Acessórios",
    "type": "acessorios",
    "items": [
      {
        "id": "acess-1",
        "name": "Dobradiça reta canto L com amortecedor",
        "size": "",
        "price": 22.52
      },
      {
        "id": "acess-2",
        "name": "Dobradiça curva canto L com amortecedor",
        "size": "",
        "price": 22.52
      },
      {
        "id": "acess-3",
        "name": "Dobradiça curva com amortecedor",
        "size": "",
        "price": 8.5
      },
      {
        "id": "acess-4",
        "name": "Dobradiça reta com amortecedor",
        "size": "",
        "price": 8.5
      },
      {
        "id": "acess-5",
        "name": "Corrediça telescópica",
        "size": "300mm",
        "price": 24.5
      },
      {
        "id": "acess-6",
        "name": "Corrediça telescópica",
        "size": "350mm",
        "price": 24.5
      },
      {
        "id": "acess-7",
        "name": "Corrediça telescópica",
        "size": "400mm",
        "price": 24.5
      },
      {
        "id": "acess-8",
        "name": "Corrediça telescópica",
        "size": "450mm",
        "price": 24.5
      },
      {
        "id": "acess-9",
        "name": "Corrediça telescópica",
        "size": "500mm",
        "price": 24.5
      },
      {
        "id": "acess-10",
        "name": "Corrediça invisivel com freio",
        "size": "350mm",
        "price": 65
      },
      {
        "id": "acess-11",
        "name": "Corrediça invisivel com freio",
        "size": "400mm",
        "price": 65
      },
      {
        "id": "acess-12",
        "name": "Corrediça invisivel com freio",
        "size": "450mm",
        "price": 65
      },
      {
        "id": "acess-13",
        "name": "Corrediça invisivel com freio",
        "size": "500mm",
        "price": 100
      },
      {
        "id": "acess-14",
        "name": "Puxador gola",
        "size": "3m",
        "price": 130
      },
      {
        "id": "acess-15",
        "name": "Ponteira gola",
        "size": "",
        "price": 8
      },
      {
        "id": "acess-16",
        "name": "Puxador Continuo",
        "size": "3m",
        "price": 85
      },
      {
        "id": "acess-17",
        "name": "Ponteira Continuo",
        "size": "",
        "price": 18.5
      },
      {
        "id": "acess-18",
        "name": "Pistão a gás",
        "size": "",
        "price": 13.5
      },
      {
        "id": "acess-19",
        "name": "Pistão a gás invertido",
        "size": "",
        "price": 13.5
      },
      {
        "id": "acess-20",
        "name": "Cabideiro Curvo",
        "size": "1mx1m",
        "price": 44
      },
      {
        "id": "acess-21",
        "name": "Cabideiro Reto",
        "size": "3m Barra",
        "price": 38
      },
      {
        "id": "acess-22",
        "name": "Cabideiro extensivo",
        "size": "",
        "price": 410
      },
      {
        "id": "acess-23",
        "name": "Suporte de cabideiro",
        "size": "Par",
        "price": 0
      },
      {
        "id": "acess-24",
        "name": "Sistema de correr com freio",
        "size": "",
        "price": 350
      },
      {
        "id": "acess-25",
        "name": "Tabua de passar embutida",
        "size": "",
        "price": 440
      },
      {
        "id": "acess-26",
        "name": "Ganchos para vassoura",
        "size": "",
        "price": 0
      },
      {
        "id": "acess-27",
        "name": "Suporte Mão Francesa",
        "size": "",
        "price": 35
      },
      {
        "id": "acess-28",
        "name": "Rodízio maior com freio",
        "size": "",
        "price": 12
      },
      {
        "id": "acess-29",
        "name": "Rodízio maior sem freio",
        "size": "",
        "price": 12
      },
      {
        "id": "acess-30",
        "name": "Lixeira embutida",
        "size": "",
        "price": 350
      },
      {
        "id": "acess-31",
        "name": "Toalheiro",
        "size": "",
        "price": 0
      },
      {
        "id": "acess-32",
        "name": "Divisor de gaveta ecoplast",
        "size": "300mm",
        "price": 0
      },
      {
        "id": "acess-33",
        "name": "Divisor de gaveta ecoplast",
        "size": "400mm",
        "price": 0
      },
      {
        "id": "acess-34",
        "name": "Divisor de gaveta ecoplast",
        "size": "500mm",
        "price": 0
      },
      {
        "id": "acess-35",
        "name": "Divisor de gaveta ecoplast",
        "size": "600mm",
        "price": 0
      },
      {
        "id": "acess-36",
        "name": "Porta gravata acrilico",
        "size": "",
        "price": 0
      },
      {
        "id": "acess-37",
        "name": "Divisor de acrilico",
        "size": "",
        "price": 0
      }
    ]
  },
  "Eucatex": {
    "brandName": "Eucatex",
    "type": "brand",
    "lines": [
      {
        "id": "eucatex-1",
        "name": "Ecowood\\Horizontal\\Montana",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-2",
        "name": "Ecowood\\Horizontal\\Savana",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-3",
        "name": "Ecowood\\Horizontal\\Tropical",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-4",
        "name": "BP\\Horizontal\\Alicante",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-5",
        "name": "BP\\Horizontal\\Antique Wood",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-6",
        "name": "BP\\Horizontal\\Argila",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-7",
        "name": "BP\\Horizontal\\Azul Royal",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-8",
        "name": "BP\\Horizontal\\Bege",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-9",
        "name": "BP\\Horizontal\\Bianco Ártico",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-10",
        "name": "BP\\Horizontal\\Branco",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-11",
        "name": "BP\\Horizontal\\Carvalho Coimbra",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-12",
        "name": "BP\\Horizontal\\Carvalho Maiorca",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-13",
        "name": "BP\\Horizontal\\Chocolate Fineline",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-14",
        "name": "BP\\Horizontal\\Ciliegio Cinza",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-15",
        "name": "BP\\Horizontal\\Ciliegio Claro",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-16",
        "name": "BP\\Horizontal\\Cinza",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-17",
        "name": "BP\\Horizontal\\Cinza Cobalto",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-18",
        "name": "BP\\Horizontal\\Cinza Cristal",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-19",
        "name": "BP\\Horizontal\\Europine",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-20",
        "name": "BP\\Horizontal\\Imbuia Brasil",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-21",
        "name": "BP\\Horizontal\\Imbuia Nero",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-22",
        "name": "BP\\Horizontal\\Italian Noce",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-23",
        "name": "BP\\Horizontal\\Kalahari",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-24",
        "name": "BP\\Horizontal\\Linheiro Java",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-25",
        "name": "BP\\Horizontal\\Legno Rustic",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-26",
        "name": "BP\\Horizontal\\Linheiro Mel",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-27",
        "name": "BP\\Horizontal\\Linho",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-28",
        "name": "BP\\Horizontal\\Maple Pérola",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-29",
        "name": "BP\\Horizontal\\Marfim Natural",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-30",
        "name": "BP\\Horizontal\\Noce",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-31",
        "name": "BP\\Horizontal\\Nogal Ébano",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-32",
        "name": "BP\\Horizontal\\Nogal Gris",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-33",
        "name": "BP\\Horizontal\\Nogueira Natural",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-34",
        "name": "BP\\Horizontal\\Preto",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-35",
        "name": "BP\\Horizontal\\Rovere Cinza",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-36",
        "name": "BP\\Horizontal\\Teka Firenze",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-37",
        "name": "BP\\Horizontal\\Rustico",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-38",
        "name": "BP\\Horizontal\\Verde",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-39",
        "name": "Eucaprint Lacca AD\\Horizontal\\Bordô",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-40",
        "name": "Eucaprint Lacca AD\\Horizontal\\Branco Neve",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-41",
        "name": "Eucaprint Lacca AD\\Horizontal\\Ciliegio Branco",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-42",
        "name": "Eucaprint Lacca AD\\Horizontal\\Ciliegio Cinza",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-43",
        "name": "Eucaprint Lacca AD\\Horizontal\\Ébano Exotic",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-44",
        "name": "Eucaprint Lacca AD\\Horizontal\\Nogal Saara",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-45",
        "name": "Eucaprint Lacca AD\\Horizontal\\Cinza Itália",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-46",
        "name": "Eucaprint Lacca AD\\Horizontal\\Palissandro",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-47",
        "name": "Eucaprint Lacca AD\\Horizontal\\Preto Malaga",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-48",
        "name": "Eucaprint Lacca AD\\Horizontal\\Rovere Cinza",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-49",
        "name": "Eucaprint Lacca AD\\Horizontal\\Teka Rivoli",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "eucatex-50",
        "name": "MDF Eucafibra Lacca AD\\Tecido Corda",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
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
        "id": "fórmica-1",
        "name": "Fantasia",
        "width": 2.75,
        "height": 2.75,
        "area": 7.56,
        "prices": {
          "6mm": 1.85,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "fórmica-2",
        "name": "Lousas",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "fórmica-3",
        "name": "Madeirados",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "fórmica-4",
        "name": "Pedras",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "fórmica-5",
        "name": "Unicolores",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "fórmica-6",
        "name": "Cimbalo",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      },
      {
        "id": "fórmica-7",
        "name": "Unlimited Design",
        "width": 2.75,
        "height": 1.85,
        "area": 5.09,
        "prices": {
          "6mm": null,
          "15mm": null,
          "18mm": null,
          "25mm": null
        }
      }
    ]
  }
};
