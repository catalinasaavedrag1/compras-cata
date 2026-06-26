// ============================================================================
//  Temporada mensual + retos/duelos de la semana (capa de competencia).
// ============================================================================

export interface Season {
  name: string;
  from: string;
  to: string;
}

export const SEASON: Season = {
  name: "Temporada Junio 2026",
  from: "2026-06-01",
  to: "2026-06-30",
};

export const PREV_SEASON_NAME = "Mayo 2026";

export type ChallengeKind = "team" | "duel" | "streak";

interface ChallengeBase {
  id: string;
  kind: ChallengeKind;
  title: string;
  ends: string;
}

export interface TeamChallenge extends ChallengeBase {
  kind: "team";
  description: string;
  progress: number; // 0-100
  targetText: string;
}

export interface DuelChallenge extends ChallengeBase {
  kind: "duel";
  metric: string;
  aId: string;
  bId: string;
  aText: string;
  bText: string;
  leaderId: string;
}

export interface StreakChallenge extends ChallengeBase {
  kind: "streak";
  buyerId: string;
  weeks: number;
  goalWeeks: number;
  reward: string;
}

export type Challenge = TeamChallenge | DuelChallenge | StreakChallenge;

export const challenges: Challenge[] = [
  {
    id: "RET-1",
    kind: "team",
    title: "Reto del equipo: bajar sobrestock 10%",
    description: "Liberar capital inmovilizado entre todos antes del fin de semana.",
    progress: 62,
    targetText: "−$8,5M de $14M objetivo",
    ends: "2026-06-29",
  },
  {
    id: "RET-2",
    kind: "duel",
    title: "Duelo: mayor rotación saludable",
    metric: "Rotación",
    aId: "catalina",
    bId: "felipe",
    aText: "13,5x",
    bText: "6,5x",
    leaderId: "catalina",
    ends: "2026-06-29",
  },
  {
    id: "RET-3",
    kind: "duel",
    title: "Duelo: mejor Fill Rate",
    metric: "Fill Rate",
    aId: "andrea",
    bId: "maria",
    aText: "97%",
    bText: "93%",
    leaderId: "andrea",
    ends: "2026-06-29",
  },
  {
    id: "RET-4",
    kind: "streak",
    title: "Racha sin quiebres críticos",
    buyerId: "andrea",
    weeks: 3,
    goalWeeks: 4,
    reward: "Insignia «Disponibilidad impecable»",
    ends: "2026-06-30",
  },
  {
    id: "RET-5",
    kind: "streak",
    title: "Racha de cumplimiento de OC",
    buyerId: "catalina",
    weeks: 2,
    goalWeeks: 4,
    reward: "Insignia «Ejecutora confiable»",
    ends: "2026-06-30",
  },
];
