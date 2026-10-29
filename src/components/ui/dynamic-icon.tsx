import {
  Award,
  CalendarCheck,
  ChefHat,
  Droplets,
  Dumbbell,
  Flame,
  LayoutList,
  Leaf,
  Medal,
  PackageCheck,
  PiggyBank,
  Receipt,
  Repeat,
  ShoppingBasket,
  Sparkles,
  Sprout,
  Star,
  Trees,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/** Ícones referenciados por nome no banco (conquistas, desafios, hábitos). */
const ICONS: Record<string, LucideIcon> = {
  award: Award,
  "calendar-check": CalendarCheck,
  "chef-hat": ChefHat,
  droplets: Droplets,
  dumbbell: Dumbbell,
  flame: Flame,
  "layout-list": LayoutList,
  leaf: Leaf,
  medal: Medal,
  "package-check": PackageCheck,
  "piggy-bank": PiggyBank,
  receipt: Receipt,
  repeat: Repeat,
  "shopping-basket": ShoppingBasket,
  sparkles: Sparkles,
  sprout: Sprout,
  star: Star,
  trees: Trees,
  trophy: Trophy,
  utensils: Utensils,
};

export const HABIT_ICONS = ["sparkles", "droplets", "leaf", "flame", "star", "repeat", "sprout", "utensils"] as const;

export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
