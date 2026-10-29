import type { MuscleGroup } from "@/domain/training/training";
import { MUSCLE_GROUP_LABEL } from "@/domain/training/training";

/**
 * Mapa muscular esquemático (ilustração própria, frente e costas).
 * Destaca o grupo principal; não pretende ser anatomicamente detalhado.
 */
const REGIONS: Record<Exclude<MuscleGroup, "FULL_BODY">, { view: "front" | "back"; shapes: string[] }> = {
  CHEST: { view: "front", shapes: ["M22 26h7.5v8.5c-4 1-7.5-.5-7.5-3.5z", "M38 26h-7.5v8.5c4 1 7.5-.5 7.5-3.5z"] },
  SHOULDERS: { view: "front", shapes: ["M15 24c1.5-3 5-4 7-3.5v6.5h-7z", "M45 24c-1.5-3-5-4-7-3.5v6.5h7z"] },
  BICEPS: { view: "front", shapes: ["M14.5 28h6v9h-6z", "M39.5 28h6v9h-6z"] },
  ABS: { view: "front", shapes: ["M25 36h10v15h-10z"] },
  LEGS: { view: "front", shapes: ["M22 56h7.5v19h-7z", "M38 56h-7.5v19h7z"] },
  BACK: { view: "back", shapes: ["M22 24h16v14c-3 3-13 3-16 0z"] },
  TRICEPS: { view: "back", shapes: ["M14.5 28h6v9h-6z", "M39.5 28h6v9h-6z"] },
  GLUTES: { view: "back", shapes: ["M22.5 48h7v7.5c-3.5 1-7-.5-7-3z", "M37.5 48h-7v7.5c3.5 1 7-.5 7-3z"] },
};

function Figure({ highlight, view }: { highlight: string[]; view: "front" | "back" }) {
  return (
    <svg viewBox="0 0 60 100" className="h-full w-auto" aria-hidden>
      {/* silhueta */}
      <g fill="var(--surface-3)">
        <circle cx="30" cy="12" r="6.5" />
        <path d="M21 20h18l7 4v14l-2 10h-4l-1-12v12l2 30h-7l-3.5-24-3.5 24h-7l2-30V36l-1 12h-4l-2-10V24z" />
      </g>
      {highlight.map((d, i) => (
        <path key={i} d={d} fill="var(--lime)" />
      ))}
      <text x="30" y="98" textAnchor="middle" fontSize="6" fill="var(--ink-3)">
        {view === "front" ? "frente" : "costas"}
      </text>
    </svg>
  );
}

export function BodyMap({ group, className }: { group: MuscleGroup; className?: string }) {
  const label = `Grupo muscular principal: ${MUSCLE_GROUP_LABEL[group]}`;
  if (group === "FULL_BODY") {
    const all = Object.values(REGIONS);
    return (
      <div className={className} role="img" aria-label={label}>
        <div className="flex h-full gap-2">
          <Figure view="front" highlight={all.filter((r) => r.view === "front").flatMap((r) => r.shapes)} />
          <Figure view="back" highlight={all.filter((r) => r.view === "back").flatMap((r) => r.shapes)} />
        </div>
      </div>
    );
  }
  const region = REGIONS[group];
  return (
    <div className={className} role="img" aria-label={label}>
      <div className="flex h-full gap-2">
        <Figure view="front" highlight={region.view === "front" ? region.shapes : []} />
        <Figure view="back" highlight={region.view === "back" ? region.shapes : []} />
      </div>
    </div>
  );
}
