import type { LeaderAlert } from "../types/team";

// ============================================================================
//  Alertas para el Líder de Compras: lo que requiere su intervención.
// ============================================================================

export const leaderAlerts: LeaderAlert[] = [
  { id: "LA-1", type: "perf_drop", severity: "high", buyer: "Felipe Rojas", title: "Desempeño en caída sostenida", detail: "Felipe Rojas bajó 12 puntos de score en 6 semanas (70 → 58). Tiempo de reposición y tareas en rojo.", action: "Ver ficha y agendar 1:1" },
  { id: "LA-2", type: "overload", severity: "high", buyer: "Catalina Saavedra", title: "Compradora sobrecargada", detail: "Catalina Saavedra está en carga crítica (94%) con 5 quiebres críticos y 12 compras pendientes.", action: "Reasignar carga" },
  { id: "LA-3", type: "stockouts", severity: "high", buyer: "Juan Pérez", title: "Exceso de quiebres", detail: "Juan Pérez acumula 9 quiebres (4 críticos) en Ferretería y Gasfitería. Fill Rate 85%.", action: "Revisar reposición" },
  { id: "LA-4", type: "no_owner", severity: "medium", buyer: null, title: "Categoría sin responsable", detail: 'La categoría "Decohogar" quedó sin comprador asignado tras la última reorganización.', action: "Asignar comprador" },
  { id: "LA-5", type: "goal_risk", severity: "medium", buyer: "María González", title: "Meta en riesgo", detail: '"Reducir sobrestock Jardín" va en 48% a 3 semanas del cierre. Capital inmovilizado creciendo.', action: "Revisar meta" },
  { id: "LA-6", type: "underload", severity: "low", buyer: "Felipe Rojas", title: "Comprador con baja carga", detail: "Felipe Rojas tiene carga baja (38%). Podría asumir categorías de compradores sobrecargados.", action: "Balancear equipo" },
];
