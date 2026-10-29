/**
 * Alimentos da TACO revisados manualmente para uso no planejador.
 *
 * Para cada alimento revisamos: tags de alergênicos (RDC ANVISA 26/2015) e de
 * dieta, família (para gostos/aversões), grupo de substituição e o alimento
 * comprado correspondente (ex.: arroz cozido → arroz cru).
 *
 * Os valores nutricionais NÃO são definidos aqui: vêm da TACO (taco.json).
 * `notApplicable` lista campos que a TACO marca como "NA"/ausentes por não se
 * aplicarem ao alimento (ex.: fibra em carnes; proteína em óleos com 100 g de
 * lipídeos) — esses campos são tratados como zero e sinalizados na interface.
 */

export interface CuratedFood {
  key: string;
  tacoId: number;
  shortName: string;
  tags: string[];
  family: string | null;
  group: string | null;
  /** Chave do alimento comprado (cru/seco). Ausente quando é comprado como consumido. */
  purchase?: string;
  /** Fator explícito (gramas compradas por grama consumida) quando a umidade não se aplica */
  purchaseFactor?: { value: number; method: string };
  notApplicable?: ("proteinG" | "carbsG" | "fiberG")[];
  householdMeasure?: string;
  unitWeightG?: number;
}

const ANIMAL = ["origem-animal"];
const DAIRY = ["leite", "lactose", "laticinio", ...ANIMAL];
const POULTRY = ["carne", "aves", ...ANIMAL];
const BEEF = ["carne", "carne-vermelha", ...ANIMAL];
const PORK = ["carne", "carne-suina", ...ANIMAL];
const FISH = ["peixe", "carne", ...ANIMAL];
const FIBER_NA: CuratedFood["notApplicable"] = ["fiberG"];
const OIL_NA: CuratedFood["notApplicable"] = ["proteinG", "carbsG", "fiberG"];

export const CURATED_FOODS: CuratedFood[] = [
  // Cereais, pães e massas
  { key: "arroz-branco-cozido", tacoId: 3, shortName: "Arroz branco cozido", tags: [], family: "arroz", group: "carboidrato-base", purchase: "arroz-branco-cru" },
  { key: "arroz-branco-cru", tacoId: 4, shortName: "Arroz branco (cru)", tags: [], family: "arroz", group: null },
  { key: "arroz-integral-cozido", tacoId: 1, shortName: "Arroz integral cozido", tags: [], family: "arroz", group: "carboidrato-base", purchase: "arroz-integral-cru" },
  { key: "arroz-integral-cru", tacoId: 2, shortName: "Arroz integral (cru)", tags: [], family: "arroz", group: null },
  { key: "aveia", tacoId: 7, shortName: "Aveia em flocos", tags: ["gluten"], family: "aveia", group: "cereal-cafe" },
  { key: "pao-frances", tacoId: 53, shortName: "Pão francês", tags: ["trigo", "gluten"], family: "pao", group: "pao", householdMeasure: "1 unidade ≈ 50 g (aproximado)", unitWeightG: 50 },
  { key: "pao-forma-integral", tacoId: 52, shortName: "Pão de forma integral", tags: ["trigo", "gluten", "traco:leite", "traco:soja"], family: "pao", group: "pao" },
  { key: "macarrao-cru", tacoId: 40, shortName: "Macarrão (peso cru)", tags: ["trigo", "gluten"], family: "macarrao", group: "carboidrato-base" },
  { key: "cuscuz-milho", tacoId: 533, shortName: "Cuscuz de milho cozido", tags: [], family: "cuscuz", group: "pao", purchase: "flocos-milho" },
  { key: "flocos-milho", tacoId: 22, shortName: "Flocos de milho (sem sal)", tags: [], family: "cuscuz", group: null },

  // Verduras, legumes e tubérculos
  { key: "alface", tacoId: 78, shortName: "Alface crespa", tags: [], family: "alface", group: "folhas" },
  { key: "tomate", tacoId: 157, shortName: "Tomate", tags: [], family: "tomate", group: "folhas" },
  { key: "pepino", tacoId: 142, shortName: "Pepino", tags: [], family: "pepino", group: "folhas" },
  { key: "rucula", tacoId: 152, shortName: "Rúcula", tags: [], family: "rucula", group: "folhas" },
  { key: "repolho", tacoId: 149, shortName: "Repolho branco", tags: [], family: "repolho", group: "folhas" },
  { key: "couve-crua", tacoId: 115, shortName: "Couve-manteiga", tags: [], family: "couve", group: "folhas" },
  { key: "cenoura-crua", tacoId: 110, shortName: "Cenoura (crua)", tags: [], family: "cenoura", group: "legumes" },
  { key: "cenoura-cozida", tacoId: 109, shortName: "Cenoura cozida", tags: [], family: "cenoura", group: "legumes", purchase: "cenoura-crua" },
  { key: "brocolis-cru", tacoId: 101, shortName: "Brócolis (cru)", tags: [], family: "brocolis", group: "legumes" },
  { key: "brocolis-cozido", tacoId: 100, shortName: "Brócolis cozido", tags: [], family: "brocolis", group: "legumes", purchase: "brocolis-cru" },
  { key: "abobrinha-crua", tacoId: 71, shortName: "Abobrinha (crua)", tags: [], family: "abobrinha", group: "legumes" },
  { key: "abobrinha-cozida", tacoId: 70, shortName: "Abobrinha cozida", tags: [], family: "abobrinha", group: "legumes", purchase: "abobrinha-crua" },
  { key: "chuchu-cru", tacoId: 113, shortName: "Chuchu (cru)", tags: [], family: "chuchu", group: "legumes" },
  { key: "chuchu-cozido", tacoId: 112, shortName: "Chuchu cozido", tags: [], family: "chuchu", group: "legumes", purchase: "chuchu-cru" },
  { key: "beterraba-crua", tacoId: 98, shortName: "Beterraba (crua)", tags: [], family: "beterraba", group: "legumes" },
  { key: "beterraba-cozida", tacoId: 97, shortName: "Beterraba cozida", tags: [], family: "beterraba", group: "legumes", purchase: "beterraba-crua" },
  { key: "abobora-crua", tacoId: 65, shortName: "Abóbora cabotiá (crua)", tags: [], family: "abobora", group: "legumes" },
  { key: "abobora-cozida", tacoId: 64, shortName: "Abóbora cabotiá cozida", tags: [], family: "abobora", group: "legumes", purchase: "abobora-crua" },
  { key: "couve-flor-crua", tacoId: 117, shortName: "Couve-flor (crua)", tags: [], family: "couve-flor", group: "legumes" },
  { key: "couve-flor-cozida", tacoId: 118, shortName: "Couve-flor cozida", tags: [], family: "couve-flor", group: "legumes", purchase: "couve-flor-crua" },
  { key: "cebola", tacoId: 107, shortName: "Cebola", tags: [], family: "cebola", group: null },
  { key: "alho", tacoId: 82, shortName: "Alho", tags: [], family: "alho", group: null },
  { key: "batata-crua", tacoId: 92, shortName: "Batata inglesa (crua)", tags: [], family: "batata", group: null },
  { key: "batata-cozida", tacoId: 91, shortName: "Batata inglesa cozida", tags: [], family: "batata", group: "carboidrato-base", purchase: "batata-crua" },
  { key: "batata-doce-crua", tacoId: 89, shortName: "Batata-doce (crua)", tags: [], family: "batata-doce", group: null },
  { key: "batata-doce-cozida", tacoId: 88, shortName: "Batata-doce cozida", tags: [], family: "batata-doce", group: "carboidrato-base", purchase: "batata-doce-crua" },
  { key: "mandioca-crua", tacoId: 130, shortName: "Mandioca (crua)", tags: [], family: "mandioca", group: null },
  { key: "mandioca-cozida", tacoId: 129, shortName: "Mandioca cozida", tags: [], family: "mandioca", group: "carboidrato-base", purchase: "mandioca-crua" },
  { key: "molho-tomate", tacoId: 159, shortName: "Molho de tomate pronto", tags: [], family: "tomate", group: null },

  // Frutas
  { key: "banana-prata", tacoId: 182, shortName: "Banana-prata", tags: [], family: "banana", group: "fruta" },
  { key: "maca-fuji", tacoId: 222, shortName: "Maçã Fuji", tags: [], family: "maca", group: "fruta" },
  { key: "mamao-papaia", tacoId: 226, shortName: "Mamão papaia", tags: [], family: "mamao", group: "fruta" },
  { key: "laranja-pera", tacoId: 214, shortName: "Laranja-pera", tags: [], family: "laranja", group: "fruta" },
  { key: "melancia", tacoId: 235, shortName: "Melancia", tags: [], family: "melancia", group: "fruta" },
  { key: "abacaxi", tacoId: 164, shortName: "Abacaxi", tags: [], family: "abacaxi", group: "fruta" },
  { key: "manga-palmer", tacoId: 229, shortName: "Manga Palmer", tags: [], family: "manga", group: "fruta" },
  { key: "morango", tacoId: 239, shortName: "Morango", tags: [], family: "morango", group: "fruta" },
  { key: "uva-italia", tacoId: 256, shortName: "Uva Itália", tags: [], family: "uva", group: "fruta" },
  { key: "goiaba", tacoId: 200, shortName: "Goiaba vermelha", tags: [], family: "goiaba", group: "fruta" },
  { key: "kiwi", tacoId: 207, shortName: "Kiwi", tags: [], family: "kiwi", group: "fruta" },
  { key: "pera", tacoId: 243, shortName: "Pera Williams", tags: [], family: "pera", group: "fruta" },
  { key: "tangerina", tacoId: 251, shortName: "Tangerina poncã", tags: [], family: "tangerina", group: "fruta" },
  { key: "melao", tacoId: 236, shortName: "Melão", tags: [], family: "melao", group: "fruta" },
  { key: "abacate", tacoId: 163, shortName: "Abacate", tags: [], family: "abacate", group: "fruta" },
  { key: "limao", tacoId: 220, shortName: "Limão tahiti", tags: [], family: "limao", group: null },

  // Gorduras
  { key: "azeite", tacoId: 260, shortName: "Azeite de oliva", tags: [], family: "azeite", group: "gordura", notApplicable: OIL_NA },
  { key: "oleo-soja", tacoId: 272, shortName: "Óleo de soja", tags: ["traco:soja"], family: "oleo", group: "gordura", notApplicable: OIL_NA },
  { key: "manteiga", tacoId: 261, shortName: "Manteiga com sal", tags: DAIRY, family: "manteiga", group: "gordura", notApplicable: FIBER_NA },

  // Laticínios
  { key: "iogurte-natural", tacoId: 448, shortName: "Iogurte natural", tags: DAIRY, family: "iogurte", group: "laticinio", notApplicable: FIBER_NA },
  { key: "queijo-minas", tacoId: 461, shortName: "Queijo minas frescal", tags: DAIRY, family: "queijo", group: "laticinio", notApplicable: FIBER_NA },
  { key: "mussarela", tacoId: 463, shortName: "Queijo muçarela", tags: DAIRY, family: "queijo", group: "laticinio", notApplicable: FIBER_NA },
  { key: "requeijao", tacoId: 468, shortName: "Requeijão cremoso", tags: DAIRY, family: "queijo", group: "laticinio", notApplicable: FIBER_NA },
  { key: "ricota", tacoId: 469, shortName: "Ricota", tags: DAIRY, family: "queijo", group: "laticinio", notApplicable: FIBER_NA },

  // Proteínas animais
  { key: "frango-peito-cru", tacoId: 409, shortName: "Peito de frango (cru)", tags: POULTRY, family: "frango", group: null, notApplicable: FIBER_NA },
  { key: "frango-peito-grelhado", tacoId: 410, shortName: "Peito de frango grelhado", tags: POULTRY, family: "frango", group: "proteina", purchase: "frango-peito-cru", notApplicable: FIBER_NA },
  { key: "frango-peito-cozido", tacoId: 408, shortName: "Peito de frango cozido", tags: POULTRY, family: "frango", group: "proteina", purchase: "frango-peito-cru", notApplicable: FIBER_NA },
  { key: "frango-coxa-crua", tacoId: 399, shortName: "Coxa de frango sem pele (crua)", tags: POULTRY, family: "frango", group: null, notApplicable: FIBER_NA },
  { key: "frango-coxa-cozida", tacoId: 398, shortName: "Coxa de frango cozida", tags: POULTRY, family: "frango", group: "proteina", purchase: "frango-coxa-crua", notApplicable: FIBER_NA },
  { key: "patinho-cru", tacoId: 376, shortName: "Patinho (cru)", tags: BEEF, family: "carne-bovina", group: null, notApplicable: FIBER_NA },
  { key: "patinho-grelhado", tacoId: 377, shortName: "Patinho grelhado", tags: BEEF, family: "carne-bovina", group: "proteina", purchase: "patinho-cru", notApplicable: FIBER_NA },
  { key: "carne-moida-crua", tacoId: 327, shortName: "Acém moído (cru)", tags: BEEF, family: "carne-bovina", group: null, notApplicable: FIBER_NA },
  { key: "carne-moida-cozida", tacoId: 326, shortName: "Acém moído cozido", tags: BEEF, family: "carne-bovina", group: "proteina", purchase: "carne-moida-crua", notApplicable: FIBER_NA },
  { key: "musculo-cru", tacoId: 372, shortName: "Músculo (cru)", tags: BEEF, family: "carne-bovina", group: null, notApplicable: FIBER_NA },
  { key: "musculo-cozido", tacoId: 371, shortName: "Músculo cozido", tags: BEEF, family: "carne-bovina", group: "proteina", purchase: "musculo-cru", notApplicable: FIBER_NA },
  { key: "lombo-cru", tacoId: 433, shortName: "Lombo suíno (cru)", tags: PORK, family: "porco", group: null, notApplicable: FIBER_NA },
  { key: "lombo-assado", tacoId: 432, shortName: "Lombo suíno assado", tags: PORK, family: "porco", group: "proteina", purchase: "lombo-cru", notApplicable: FIBER_NA },
  { key: "merluza-crua", tacoId: 302, shortName: "Filé de merluza (cru)", tags: FISH, family: "peixe", group: null, notApplicable: FIBER_NA },
  { key: "merluza-assada", tacoId: 301, shortName: "Filé de merluza assado", tags: FISH, family: "peixe", group: "proteina", purchase: "merluza-crua", notApplicable: FIBER_NA },
  { key: "salmao-cru", tacoId: 316, shortName: "Salmão sem pele (cru)", tags: FISH, family: "peixe", group: null, notApplicable: FIBER_NA },
  { key: "salmao-grelhado", tacoId: 317, shortName: "Salmão grelhado", tags: FISH, family: "peixe", group: "proteina", purchase: "salmao-cru", notApplicable: FIBER_NA },
  { key: "sardinha-lata", tacoId: 319, shortName: "Sardinha em conserva (óleo)", tags: [...FISH, "traco:soja"], family: "peixe", group: "proteina", notApplicable: FIBER_NA },
  { key: "atum-lata", tacoId: 277, shortName: "Atum em conserva (óleo)", tags: [...FISH, "traco:soja"], family: "peixe", group: "proteina", notApplicable: FIBER_NA },
  { key: "ovo-cru", tacoId: 489, shortName: "Ovo de galinha", tags: ["ovo", ...ANIMAL], family: "ovo", group: "proteina", householdMeasure: "1 unidade ≈ 50 g (aproximado)", unitWeightG: 50, notApplicable: FIBER_NA },
  { key: "ovo-cozido", tacoId: 488, shortName: "Ovo cozido", tags: ["ovo", ...ANIMAL], family: "ovo", group: "proteina", purchase: "ovo-cru", householdMeasure: "1 unidade ≈ 50 g (aproximado)", unitWeightG: 50, notApplicable: FIBER_NA },

  // Proteínas vegetais e leguminosas
  { key: "tofu", tacoId: 584, shortName: "Tofu", tags: ["soja"], family: "tofu", group: "proteina" },
  { key: "feijao-carioca-cru", tacoId: 562, shortName: "Feijão-carioca (cru)", tags: [], family: "feijao", group: null },
  { key: "feijao-carioca-cozido", tacoId: 561, shortName: "Feijão-carioca cozido", tags: [], family: "feijao", group: "leguminosa", purchase: "feijao-carioca-cru" },
  { key: "feijao-preto-cru", tacoId: 568, shortName: "Feijão-preto (cru)", tags: [], family: "feijao", group: null },
  { key: "feijao-preto-cozido", tacoId: 567, shortName: "Feijão-preto cozido", tags: [], family: "feijao", group: "leguminosa", purchase: "feijao-preto-cru" },
  { key: "lentilha-crua", tacoId: 578, shortName: "Lentilha (crua)", tags: [], family: "lentilha", group: null },
  { key: "lentilha-cozida", tacoId: 577, shortName: "Lentilha cozida", tags: [], family: "lentilha", group: "leguminosa", purchase: "lentilha-crua" },

  // Oleaginosas e sementes
  { key: "amendoim", tacoId: 558, shortName: "Amendoim torrado", tags: ["amendoim"], family: "amendoim", group: "oleaginosa" },
  { key: "castanha-para", tacoId: 589, shortName: "Castanha-do-brasil", tags: ["castanhas"], family: "castanha", group: "oleaginosa" },
  { key: "castanha-caju", tacoId: 588, shortName: "Castanha-de-caju", tags: ["castanhas"], family: "castanha", group: "oleaginosa" },
  { key: "linhaca", tacoId: 594, shortName: "Linhaça", tags: [], family: "linhaca", group: null },

  // Outros
  { key: "mel", tacoId: 507, shortName: "Mel", tags: ["mel", ...ANIMAL], family: "mel", group: null, notApplicable: FIBER_NA },
  { key: "cafe-po", tacoId: 511, shortName: "Café em pó", tags: [], family: "cafe", group: null },
  {
    key: "cafe-coado",
    tacoId: 471,
    shortName: "Café coado",
    tags: [],
    family: "cafe",
    group: null,
    purchase: "cafe-po",
    purchaseFactor: { value: 0.1, method: "TACO: infusão a 10% (10 g de pó por 100 ml)" },
  },
];
