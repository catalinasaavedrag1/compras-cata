// ============================================================================
//  Tipos del equipo de compras (vista del Líder de Compras y "Mi desempeño")
// ============================================================================

export type Workload = "muy_baja" | "baja" | "normal" | "alta" | "critica";

export type GoalStatus = "done" | "on_track" | "risk";

export interface BuyerGoal {
  name: string;
  indicator: string;
  target: string;
  current: string;
  pct: number; // 0-100 avance
  weight: number; // peso % en la evaluación
  status: GoalStatus;
  from: string; // ISO
  to: string; // ISO
}

export interface ScoreFactor {
  label: string;
  value: number; // 0-100
  weight: number; // %
}

export interface Buyer {
  id: string;
  name: string;
  initials: string;
  /** tono del avatar */
  tone: "green" | "blue" | "violet" | "amber" | "red" | "slate";
  score: number; // 0-100
  trend: number; // variación de pts vs semana anterior
  workload: Workload;
  workloadPct: number;
  categories: string[];
  brands: number;
  suppliers: number;
  products: number;
  stockouts: number;
  critical: number;
  overstock: number;
  pending: number;
  openPO: number;
  respDays: number;
  replenDays: number;
  fillRate: number;
  sla: number;
  sales: number;
  margin: number;
  rotation: number;
  growth: number;
  savings: number;
  goalComp: number; // % cumplimiento de metas
  alerts: number;
  scoreHist: number[]; // 6 semanas
  breakdown: ScoreFactor[];
  goals: BuyerGoal[];
}

export type LeaderAlertType =
  | "perf_drop"
  | "overload"
  | "underload"
  | "stockouts"
  | "no_owner"
  | "goal_risk"
  | "no_supplier";

export interface LeaderAlert {
  id: string;
  type: LeaderAlertType;
  severity: "high" | "medium" | "low";
  buyer: string | null;
  title: string;
  detail: string;
  action: string;
}
