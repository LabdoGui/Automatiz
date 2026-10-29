import { cn } from "../ui/cn";

export type MascotStageKey = "semente" | "broto" | "muda" | "planta" | "arvore";

/**
 * Broto — mascote do VIVA. Cresce com o nível do usuário (nunca com peso
 * ou desempenho físico). Ilustração vetorial original.
 */
export function Mascot({
  stage,
  size = 140,
  className,
  animated = true,
}: {
  stage: MascotStageKey;
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  const order: MascotStageKey[] = ["semente", "broto", "muda", "planta", "arvore"];
  const level = order.indexOf(stage);
  const sway = animated ? "animate-sway" : "";
  const leaf = "var(--lime)";
  const leafDark = "color-mix(in oklab, var(--lime) 70%, #2b4a00)";
  const stem = "color-mix(in oklab, var(--lime) 55%, #2b4a00)";
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Mascote Broto no estágio ${stage}`}
    >
      {/* sombra */}
      <ellipse cx="60" cy="114" rx="30" ry="4" fill="var(--ink)" opacity="0.12" />

      {/* planta */}
      <g style={{ transformOrigin: "60px 78px", transformBox: "view-box" }} className={sway}>
        {level === 0 && (
          <g>
            <ellipse cx="60" cy="72" rx="7" ry="5" fill="#b8864b" transform="rotate(-20 60 72)" />
            <path d="M60 68c1-4 4-6 7-6-1 3-3 6-7 6z" fill={leaf} />
          </g>
        )}
        {level >= 1 && <path d={`M60 78V${[0, 58, 46, 32, 30][level]}`} stroke={level >= 4 ? "#8a6236" : stem} strokeWidth={level >= 4 ? 7 : 3.2} strokeLinecap="round" />}
        {level >= 1 && level < 4 && (
          <g>
            <path d="M60 62c-10 0-16-6-17-14 9 0 16 5 17 14z" fill={leaf} />
            <path d="M60 60c9-1 15-8 15-16-9 1-15 7-15 16z" fill={leafDark} />
          </g>
        )}
        {level >= 2 && level < 4 && (
          <g>
            <path d="M60 50c-8-1-12-7-12-13 7 1 12 6 12 13z" fill={leafDark} />
            <path d="M60 48c7-1 11-6 11-12-7 1-11 6-11 12z" fill={leaf} />
          </g>
        )}
        {level === 3 && (
          <g>
            <path d="M60 38c-6-1-9-5-9-10 6 1 9 5 9 10z" fill={leaf} />
            <path d="M60 36c6-1 8-5 8-9-5 0-8 4-8 9z" fill={leafDark} />
            <circle cx="60" cy="29" r="4.5" fill="var(--coral)" />
            <circle cx="60" cy="29" r="1.8" fill="var(--amber)" />
          </g>
        )}
        {level === 4 && (
          <g>
            <circle cx="60" cy="30" r="24" fill={leafDark} />
            <circle cx="46" cy="38" r="15" fill={leaf} />
            <circle cx="74" cy="36" r="16" fill={leaf} />
            <circle cx="60" cy="20" r="15" fill={leaf} />
            <circle cx="50" cy="30" r="3" fill="var(--coral)" />
            <circle cx="70" cy="22" r="3" fill="var(--coral)" />
            <circle cx="72" cy="42" r="3" fill="var(--coral)" />
          </g>
        )}
      </g>

      {/* vaso */}
      <path d="M33 84h54l-6 26a4 4 0 0 1-4 3H43a4 4 0 0 1-4-3z" fill="var(--coral)" />
      <rect x="28" y="74" width="64" height="12" rx="5" fill="var(--coral)" />
      <rect x="28" y="74" width="64" height="5" rx="2.5" fill="#fff" opacity="0.18" />
      <ellipse cx="60" cy="77" rx="26" ry="2.6" fill="#3a2414" opacity="0.55" />

      {/* rosto */}
      <circle cx="51" cy="95" r="2.6" fill="var(--coral-ink)" />
      <circle cx="69" cy="95" r="2.6" fill="var(--coral-ink)" />
      <path d="M55 101q5 4 10 0" stroke="var(--coral-ink)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="46" cy="100" r="2.6" fill="#fff" opacity="0.22" />
      <circle cx="74" cy="100" r="2.6" fill="#fff" opacity="0.22" />
    </svg>
  );
}
