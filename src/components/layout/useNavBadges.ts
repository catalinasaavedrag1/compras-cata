import { useMemo } from "react";
import type { BadgeTone } from "../ui/Badge";
import type { NavBadgeKey } from "./navItems";
import { leaderAlerts } from "../../data/mockLeaderAlerts";
import { usePendingApprovalsCount } from "../../hooks/useApprovals";
import { useSignals } from "../../context/SignalsContext";
import { useNotifications } from "../../context/NotificationContext";

export interface NavBadge {
  count: number;
  tone: BadgeTone;
}

// ============================================================================
//  Conteos dinámicos para los badges del menú lateral.
//  Centraliza qué vistas tienen pendientes/alertas para que el usuario priorice
//  desde la navegación, sin entrar a cada módulo.
// ============================================================================
export function useNavBadges(): Record<NavBadgeKey, NavBadge> {
  // Conteo real de aprobaciones pendientes (degrada en silencio a 0).
  const pendingApprovalsCount = usePendingApprovalsCount();
  const { signals } = useSignals();
  // Alertas críticas vivas reales (campanita, flujo 7): 0 sin BFF configurado.
  const { criticalCount } = useNotifications();

  return useMemo(() => {
    const senalesNuevas = signals.filter((s) => s.status === "new").length;
    const equipoAlertasAltas = leaderAlerts.filter((a) => a.severity === "high").length;
    return {
      alertas: { count: criticalCount, tone: "red" },
      aprobaciones: { count: pendingApprovalsCount, tone: "amber" },
      senales: { count: senalesNuevas, tone: "blue" },
      equipoAlertas: { count: equipoAlertasAltas, tone: "red" },
    };
  }, [pendingApprovalsCount, signals, criticalCount]);
}
