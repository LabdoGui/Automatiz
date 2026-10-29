/**
 * Catálogo de produtos de referência para converter o plano em lista de compras.
 *
 * Contém APENAS tamanhos de embalagem usuais (editáveis pelo usuário) — nenhum
 * preço. Preços são sempre informados pelo usuário, importados por arquivo ou,
 * no futuro, vindos de uma integração autorizada.
 * Hortifrúti e carnes de açougue são tratados como venda a granel (preço por kg).
 */

export interface SeedProduct {
  key: string;
  food: string;
  name: string;
  category: string;
  packageSize: number;
  packageUnit: "G" | "ML" | "UNIT";
  soldByWeight?: boolean;
  densityGPerMl?: number;
  unitWeightG?: number;
}

const bulk = (key: string, food: string, name: string, category: string): SeedProduct => ({
  key,
  food,
  name,
  category,
  packageSize: 1000,
  packageUnit: "G",
  soldByWeight: true,
});

export const PRODUCTS: SeedProduct[] = [
  // Mercearia
  { key: "arroz-branco-5kg", food: "arroz-branco-cru", name: "Arroz branco tipo 1 — pacote 5 kg", category: "Mercearia", packageSize: 5000, packageUnit: "G" },
  { key: "arroz-integral-1kg", food: "arroz-integral-cru", name: "Arroz integral — pacote 1 kg", category: "Mercearia", packageSize: 1000, packageUnit: "G" },
  { key: "feijao-carioca-1kg", food: "feijao-carioca-cru", name: "Feijão-carioca — pacote 1 kg", category: "Mercearia", packageSize: 1000, packageUnit: "G" },
  { key: "feijao-preto-1kg", food: "feijao-preto-cru", name: "Feijão-preto — pacote 1 kg", category: "Mercearia", packageSize: 1000, packageUnit: "G" },
  { key: "lentilha-500g", food: "lentilha-crua", name: "Lentilha — pacote 500 g", category: "Mercearia", packageSize: 500, packageUnit: "G" },
  { key: "aveia-500g", food: "aveia", name: "Aveia em flocos — 500 g", category: "Mercearia", packageSize: 500, packageUnit: "G" },
  { key: "macarrao-500g", food: "macarrao-cru", name: "Macarrão — pacote 500 g", category: "Mercearia", packageSize: 500, packageUnit: "G" },
  { key: "flocos-milho-500g", food: "flocos-milho", name: "Flocos de milho para cuscuz — 500 g", category: "Mercearia", packageSize: 500, packageUnit: "G" },
  { key: "molho-tomate-340g", food: "molho-tomate", name: "Molho de tomate — sachê 340 g", category: "Mercearia", packageSize: 340, packageUnit: "G" },
  { key: "sardinha-lata", food: "sardinha-lata", name: "Sardinha em óleo — lata 125 g", category: "Mercearia", packageSize: 125, packageUnit: "G" },
  { key: "atum-lata", food: "atum-lata", name: "Atum em óleo — lata 170 g", category: "Mercearia", packageSize: 170, packageUnit: "G" },
  { key: "azeite-500ml", food: "azeite", name: "Azeite de oliva extravirgem — 500 ml", category: "Mercearia", packageSize: 500, packageUnit: "ML", densityGPerMl: 0.91 },
  { key: "oleo-soja-900ml", food: "oleo-soja", name: "Óleo de soja — 900 ml", category: "Mercearia", packageSize: 900, packageUnit: "ML", densityGPerMl: 0.92 },
  { key: "cafe-500g", food: "cafe-po", name: "Café torrado e moído — 500 g", category: "Mercearia", packageSize: 500, packageUnit: "G" },
  { key: "mel-300g", food: "mel", name: "Mel — 300 g", category: "Mercearia", packageSize: 300, packageUnit: "G" },
  { key: "amendoim-500g", food: "amendoim", name: "Amendoim torrado — 500 g", category: "Mercearia", packageSize: 500, packageUnit: "G" },
  { key: "castanha-para-200g", food: "castanha-para", name: "Castanha-do-brasil — 200 g", category: "Mercearia", packageSize: 200, packageUnit: "G" },
  { key: "castanha-caju-200g", food: "castanha-caju", name: "Castanha-de-caju — 200 g", category: "Mercearia", packageSize: 200, packageUnit: "G" },
  { key: "linhaca-250g", food: "linhaca", name: "Linhaça — 250 g", category: "Mercearia", packageSize: 250, packageUnit: "G" },

  // Padaria
  { key: "pao-frances-granel", food: "pao-frances", name: "Pão francês (a granel)", category: "Padaria", packageSize: 1000, packageUnit: "G", soldByWeight: true, unitWeightG: 50 },
  { key: "pao-forma-integral", food: "pao-forma-integral", name: "Pão de forma integral — 500 g", category: "Padaria", packageSize: 500, packageUnit: "G" },

  // Ovos e laticínios
  { key: "ovos-12", food: "ovo-cru", name: "Ovos — bandeja com 12", category: "Ovos e laticínios", packageSize: 12, packageUnit: "UNIT", unitWeightG: 50 },
  { key: "iogurte-170g", food: "iogurte-natural", name: "Iogurte natural — pote 170 g", category: "Ovos e laticínios", packageSize: 170, packageUnit: "G" },
  { key: "queijo-minas-granel", food: "queijo-minas", name: "Queijo minas frescal (por kg)", category: "Ovos e laticínios", packageSize: 1000, packageUnit: "G", soldByWeight: true },
  { key: "mussarela-granel", food: "mussarela", name: "Queijo muçarela (por kg)", category: "Ovos e laticínios", packageSize: 1000, packageUnit: "G", soldByWeight: true },
  { key: "requeijao-200g", food: "requeijao", name: "Requeijão cremoso — copo 200 g", category: "Ovos e laticínios", packageSize: 200, packageUnit: "G" },
  { key: "ricota-granel", food: "ricota", name: "Ricota (por kg)", category: "Ovos e laticínios", packageSize: 1000, packageUnit: "G", soldByWeight: true },
  { key: "manteiga-200g", food: "manteiga", name: "Manteiga com sal — 200 g", category: "Ovos e laticínios", packageSize: 200, packageUnit: "G" },
  { key: "tofu-400g", food: "tofu", name: "Tofu — 400 g", category: "Ovos e laticínios", packageSize: 400, packageUnit: "G" },

  // Açougue e peixaria (granel)
  bulk("frango-peito-kg", "frango-peito-cru", "Peito de frango sem pele (por kg)", "Açougue e peixaria"),
  bulk("frango-coxa-kg", "frango-coxa-crua", "Coxa de frango (por kg)", "Açougue e peixaria"),
  bulk("patinho-kg", "patinho-cru", "Patinho (por kg)", "Açougue e peixaria"),
  bulk("acem-moido-kg", "carne-moida-crua", "Acém moído (por kg)", "Açougue e peixaria"),
  bulk("musculo-kg", "musculo-cru", "Músculo (por kg)", "Açougue e peixaria"),
  bulk("lombo-kg", "lombo-cru", "Lombo suíno (por kg)", "Açougue e peixaria"),
  bulk("merluza-kg", "merluza-crua", "Filé de merluza (por kg)", "Açougue e peixaria"),
  bulk("salmao-kg", "salmao-cru", "Salmão sem pele (por kg)", "Açougue e peixaria"),

  // Hortifrúti (granel)
  bulk("alface-kg", "alface", "Alface crespa (por kg)", "Hortifrúti"),
  bulk("tomate-kg", "tomate", "Tomate (por kg)", "Hortifrúti"),
  bulk("pepino-kg", "pepino", "Pepino (por kg)", "Hortifrúti"),
  bulk("rucula-kg", "rucula", "Rúcula (por kg)", "Hortifrúti"),
  bulk("repolho-kg", "repolho", "Repolho (por kg)", "Hortifrúti"),
  bulk("couve-kg", "couve-crua", "Couve-manteiga (por kg)", "Hortifrúti"),
  bulk("cenoura-kg", "cenoura-crua", "Cenoura (por kg)", "Hortifrúti"),
  bulk("brocolis-kg", "brocolis-cru", "Brócolis (por kg)", "Hortifrúti"),
  bulk("abobrinha-kg", "abobrinha-crua", "Abobrinha (por kg)", "Hortifrúti"),
  bulk("chuchu-kg", "chuchu-cru", "Chuchu (por kg)", "Hortifrúti"),
  bulk("beterraba-kg", "beterraba-crua", "Beterraba (por kg)", "Hortifrúti"),
  bulk("abobora-kg", "abobora-crua", "Abóbora cabotiá (por kg)", "Hortifrúti"),
  bulk("couve-flor-kg", "couve-flor-crua", "Couve-flor (por kg)", "Hortifrúti"),
  bulk("cebola-kg", "cebola", "Cebola (por kg)", "Hortifrúti"),
  bulk("alho-kg", "alho", "Alho (por kg)", "Hortifrúti"),
  bulk("batata-kg", "batata-crua", "Batata inglesa (por kg)", "Hortifrúti"),
  bulk("batata-doce-kg", "batata-doce-crua", "Batata-doce (por kg)", "Hortifrúti"),
  bulk("mandioca-kg", "mandioca-crua", "Mandioca (por kg)", "Hortifrúti"),
  bulk("banana-kg", "banana-prata", "Banana-prata (por kg)", "Hortifrúti"),
  bulk("maca-kg", "maca-fuji", "Maçã Fuji (por kg)", "Hortifrúti"),
  bulk("mamao-kg", "mamao-papaia", "Mamão papaia (por kg)", "Hortifrúti"),
  bulk("laranja-kg", "laranja-pera", "Laranja-pera (por kg)", "Hortifrúti"),
  bulk("melancia-kg", "melancia", "Melancia (por kg)", "Hortifrúti"),
  bulk("abacaxi-kg", "abacaxi", "Abacaxi (por kg)", "Hortifrúti"),
  bulk("manga-kg", "manga-palmer", "Manga Palmer (por kg)", "Hortifrúti"),
  bulk("morango-kg", "morango", "Morango (por kg)", "Hortifrúti"),
  bulk("uva-kg", "uva-italia", "Uva Itália (por kg)", "Hortifrúti"),
  bulk("goiaba-kg", "goiaba", "Goiaba (por kg)", "Hortifrúti"),
  bulk("kiwi-kg", "kiwi", "Kiwi (por kg)", "Hortifrúti"),
  bulk("pera-kg", "pera", "Pera (por kg)", "Hortifrúti"),
  bulk("tangerina-kg", "tangerina", "Tangerina poncã (por kg)", "Hortifrúti"),
  bulk("melao-kg", "melao", "Melão (por kg)", "Hortifrúti"),
  bulk("abacate-kg", "abacate", "Abacate (por kg)", "Hortifrúti"),
  bulk("limao-kg", "limao", "Limão tahiti (por kg)", "Hortifrúti"),
];
