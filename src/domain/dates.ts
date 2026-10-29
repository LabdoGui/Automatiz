/**
 * Datas de calendário no VIVA são representadas como strings ISO "AAAA-MM-DD"
 * (dia local do usuário). No banco, colunas @db.Date guardam esse mesmo dia
 * como meia-noite UTC. Semanas começam na segunda-feira.
 */

export type ISODate = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
  if (!ISO_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Dia local (AAAA-MM-DD) de um instante em um fuso horário IANA. */
export function localDate(instant: Date, timeZone: string): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hora local "HH:MM" de um instante em um fuso. */
export function localTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

export function toDbDate(iso: ISODate): Date {
  if (!isISODate(iso)) throw new RangeError(`Data inválida: ${iso}`);
  return new Date(`${iso}T00:00:00Z`);
}

export function fromDbDate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** 0 = segunda … 6 = domingo */
export function weekdayIndex(iso: ISODate): number {
  const day = toDbDate(iso).getUTCDay(); // 0 = domingo
  return (day + 6) % 7;
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekdayIndex(iso));
}

export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDbDate(a).getTime() - toDbDate(b).getTime()) / 86_400_000);
}

export function rangeDates(from: ISODate, to: ISODate): ISODate[] {
  const n = diffDays(to, from);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
export const WEEKDAY_LONG = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
] as const;

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
