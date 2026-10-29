export type FieldErrors = Record<string, string[] | undefined>;

export interface Celebration {
  kind: "achievement" | "level" | "challenge";
  title: string;
  description: string;
  icon: string;
  xp?: number;
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T; celebrations?: Celebration[] }
  | { ok: false; error: string; fieldErrors?: FieldErrors; needsConfirmation?: boolean };

export const INITIAL_ACTION_STATE = null;
export type ActionState<T = undefined> = ActionResult<T> | null;
