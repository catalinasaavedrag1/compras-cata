// ============================================================================
//  Premios de la temporada, configurables por el líder de compras.
// ============================================================================

export type RewardCriterion = "general" | "mejora" | "quiebres" | "margen" | "rotacion";

export interface Reward {
  id: string;
  criterion: RewardCriterion;
  title: string;
  reward: string;
}

export const REWARD_CRITERIA: { value: RewardCriterion; label: string }[] = [
  { value: "general", label: "Campeón general (mayor score)" },
  { value: "mejora", label: "Mayor recuperación del mes" },
  { value: "quiebres", label: "Menor tasa de quiebres" },
  { value: "margen", label: "Mejor margen bruto" },
  { value: "rotacion", label: "Mayor rotación saludable" },
];

export const defaultRewards: Reward[] = [
  {
    id: "r1",
    criterion: "general",
    title: "Campeón de la temporada",
    reward: "Bono $150.000 + día libre",
  },
  {
    id: "r2",
    criterion: "mejora",
    title: "Mayor recuperación",
    reward: "Reconocimiento en reunión + $50.000",
  },
  {
    id: "r3",
    criterion: "quiebres",
    title: "Disponibilidad impecable",
    reward: "Gift card $40.000",
  },
];
