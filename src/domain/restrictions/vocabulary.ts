/**
 * Vocabulário controlado de alergênicos, restrições e famílias alimentares.
 *
 * Alergênicos seguem os grupos da RDC ANVISA nº 26/2015 (rotulagem de
 * alimentos alergênicos), mais gergelim. Tags "traco:<x>" indicam que o
 * produto industrializado pode conter o alergênico (varia por marca) e são
 * tratadas como críticas para quem registrou alergia.
 */

export interface VocabularyItem {
  tag: string;
  label: string;
  hint?: string;
}

export const ALLERGENS: readonly VocabularyItem[] = [
  { tag: "leite", label: "Leite (proteína do leite)" },
  { tag: "ovo", label: "Ovo" },
  { tag: "trigo", label: "Trigo" },
  { tag: "gluten", label: "Glúten (trigo, centeio, cevada, aveia)" },
  { tag: "soja", label: "Soja" },
  { tag: "amendoim", label: "Amendoim" },
  { tag: "castanhas", label: "Castanhas e nozes" },
  { tag: "peixe", label: "Peixes" },
  { tag: "crustaceo", label: "Crustáceos e frutos do mar" },
  { tag: "gergelim", label: "Gergelim" },
];

export const INTOLERANCES: readonly VocabularyItem[] = [
  { tag: "lactose", label: "Lactose" },
  { tag: "gluten", label: "Glúten (doença celíaca ou sensibilidade)" },
];

export interface DietRestriction extends VocabularyItem {
  excludes: readonly string[];
}

export const DIET_RESTRICTIONS: readonly DietRestriction[] = [
  { tag: "vegetariano", label: "Vegetariana", hint: "Sem carnes, aves e peixes", excludes: ["carne"] },
  {
    tag: "vegano",
    label: "Vegana",
    hint: "Sem qualquer ingrediente de origem animal",
    excludes: ["carne", "origem-animal"],
  },
  {
    tag: "pescetariano",
    label: "Pescetariana",
    hint: "Peixes sim; carnes e aves não",
    excludes: ["carne-vermelha", "carne-suina", "aves"],
  },
  { tag: "sem-carne-vermelha", label: "Sem carne vermelha", excludes: ["carne-vermelha"] },
  { tag: "sem-carne-suina", label: "Sem carne suína", excludes: ["carne-suina"] },
];

/** Famílias usadas para gostos e aversões (chips do onboarding). */
export const FOOD_FAMILIES = {
  frutas: [
    ["banana", "Banana"],
    ["maca", "Maçã"],
    ["mamao", "Mamão"],
    ["laranja", "Laranja"],
    ["tangerina", "Tangerina"],
    ["melancia", "Melancia"],
    ["melao", "Melão"],
    ["abacaxi", "Abacaxi"],
    ["manga", "Manga"],
    ["morango", "Morango"],
    ["uva", "Uva"],
    ["goiaba", "Goiaba"],
    ["kiwi", "Kiwi"],
    ["pera", "Pera"],
    ["abacate", "Abacate"],
  ],
  vegetais: [
    ["brocolis", "Brócolis"],
    ["cenoura", "Cenoura"],
    ["abobrinha", "Abobrinha"],
    ["chuchu", "Chuchu"],
    ["couve", "Couve"],
    ["couve-flor", "Couve-flor"],
    ["tomate", "Tomate"],
    ["alface", "Alface"],
    ["pepino", "Pepino"],
    ["beterraba", "Beterraba"],
    ["abobora", "Abóbora"],
    ["cebola", "Cebola"],
    ["espinafre", "Espinafre"],
    ["repolho", "Repolho"],
  ],
  proteinas: [
    ["frango", "Frango"],
    ["carne-bovina", "Carne bovina"],
    ["porco", "Carne suína"],
    ["peixe", "Peixe"],
    ["ovo", "Ovo"],
    ["feijao", "Feijão"],
    ["lentilha", "Lentilha"],
    ["tofu", "Tofu"],
  ],
  basicos: [
    ["arroz", "Arroz"],
    ["batata", "Batata"],
    ["batata-doce", "Batata-doce"],
    ["mandioca", "Mandioca"],
    ["macarrao", "Macarrão"],
    ["pao", "Pão"],
    ["aveia", "Aveia"],
    ["cuscuz", "Cuscuz"],
    ["iogurte", "Iogurte"],
    ["queijo", "Queijo"],
  ],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export const FAMILY_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(FOOD_FAMILIES).flatMap((list) => list.map(([tag, label]) => [tag, label])),
);

export const KITCHEN_EQUIPMENT: readonly VocabularyItem[] = [
  { tag: "fogao", label: "Fogão" },
  { tag: "forno", label: "Forno" },
  { tag: "micro-ondas", label: "Micro-ondas" },
  { tag: "airfryer", label: "Air fryer" },
  { tag: "panela-pressao", label: "Panela de pressão" },
  { tag: "liquidificador", label: "Liquidificador" },
];

export const TRAINING_EQUIPMENT: readonly VocabularyItem[] = [
  { tag: "peso-corporal", label: "Peso do corpo" },
  { tag: "halteres", label: "Halteres" },
  { tag: "barra", label: "Barra e anilhas" },
  { tag: "maquinas", label: "Máquinas" },
  { tag: "polia", label: "Polia / cabo" },
  { tag: "banco", label: "Banco" },
  { tag: "elastico", label: "Elástico" },
  { tag: "kettlebell", label: "Kettlebell" },
  { tag: "barra-fixa", label: "Barra fixa" },
];

export function labelForTag(tag: string): string {
  return (
    ALLERGENS.find((a) => a.tag === tag)?.label ??
    INTOLERANCES.find((a) => a.tag === tag)?.label ??
    DIET_RESTRICTIONS.find((a) => a.tag === tag)?.label ??
    FAMILY_LABEL[tag] ??
    tag
  );
}
