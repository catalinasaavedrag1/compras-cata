import { useEffect, useMemo, useRef, useState } from "react";
import type { BadgeTone } from "../ui/Badge";
import type { NavBadgeKey } from "./navItems";
import { isPurchaseBffConfigured, listAlerts } from "../../services/purchaseBff";
import { usePendingApprovalsCount } from "../../hooks/useApprovals";
import { useSignals } from "../../context/SignalsContext";
import { useNotifications } from "../../context/NotificationContext";

export interface NavBadge {
  count: number;
  tone: BadgeTone;
}

const TEAM_ALERTS_PAGE_SIZE = 100;
const TEAM_ALERTS_REFRESH_MS = 5 * 60 * 1000;

/**
 * Alertas críticas vivas del equipo (vista líder, sin filtro de comprador).
 * Degrada en silencio a 0: el badge nunca rompe la navegación.
 */
function useTeamCriticalAlertsCount(): number {
  const configured = isPurchaseBffConfigured();
  const [count, setCount] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!configured) return;
    const load = async () => {
      const seq = ++requestSeq.current;
      try {
        const page = await listAlerts({
          status: "active",
          severity: "critical",
          page: 1,
          pageSize: TEAM_ALERTS_PAGE_SIZE,
        });
        if (seq !== requestSeq.current) return;
        // meta.total = total real (page.items está topado por pageSize).
        setCount(page.meta?.total ?? page.items.length);
      } catch {
        if (seq === requestSeq.current) setCount(0);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), TEAM_ALERTS_REFRESH_MS);
    return () => {
      requestSeq.current += 1;
      window.clearInterval(timer);
    };
  }, [configured]);

  return count;
}

// ============================================================================
//  Conteos dinámicos para los badges del menú lateral.
//  Centraliza qué vistas tienen pendientes/alertas para que el usuario priorice
//  desde la navegación, sin entrar a cada módulo. Todas las fuentes son reales
//  y degradan en silencio a 0.
// ============================================================================
export function useNavBadges(): Record<NavBadgeKey, NavBadge> {
  // Conteo real de aprobaciones pendientes (degrada en silencio a 0).
  const pendingApprovalsCount = usePendingApprovalsCount();
  const { signals } = useSignals();
  // Alertas críticas vivas reales (campanita, flujo 7): 0 sin BFF configurado.
  const { criticalCount } = useNotifications();
  const equipoAlertasCriticas = useTeamCriticalAlertsCount();

  return useMemo(() => {
    const senalesNuevas = signals.filter((s) => s.status === "new").length;
    return {
      alertas: { count: criticalCount, tone: "red" },
      aprobaciones: { count: pendingApprovalsCount, tone: "amber" },
      senales: { count: senalesNuevas, tone: "blue" },
      equipoAlertas: { count: equipoAlertasCriticas, tone: "red" },
    };
  }, [pendingApprovalsCount, signals, criticalCount, equipoAlertasCriticas]);
}
