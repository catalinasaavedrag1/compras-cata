import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";
import { alertService, purchaseOrderService, signalService } from "../services";
import { ALERT_TYPE_LABELS } from "../components/business/alertLabels";
import { SIGNAL_TYPE } from "../components/business/signalLabels";

// ============================================================================
//  Centro de notificaciones. Cada notificación apunta a un registro/módulo
//  para permitir navegación contextual (clic -> abrir lo relacionado).
//  Se derivan de alertas activas y órdenes de compra atrasadas.
// ============================================================================

export type NotifTone = "info" | "warning" | "danger";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  tone: NotifTone;
  date: string;
  moduleKey: string;
  route: string;
  read: boolean;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function buildNotifications(readIds: string[]): AppNotification[] {
  const read = new Set(readIds);
  const out: AppNotification[] = [];

  for (const a of alertService.list()) {
    if (a.status === "resolved" || a.status === "ignored") continue;
    out.push({
      id: `alr-${a.id}`,
      title: ALERT_TYPE_LABELS[a.type] ?? "Alerta comercial",
      message: a.description,
      tone: a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "info",
      date: a.date,
      moduleKey: "alertas",
      route: a.relatedSku ? `/productos/${a.relatedSku}` : "/alertas",
      read: read.has(`alr-${a.id}`),
    });
  }

  for (const s of signalService.list()) {
    if (s.status === "resolved" || s.status === "rejected") continue;
    out.push({
      id: `sig-${s.id}`,
      title: `Señal de ventas · ${SIGNAL_TYPE[s.type].short}`,
      message: `${s.productName} — ${s.store} · ${s.reportedBy}`,
      tone: s.priority === "high" ? "danger" : s.priority === "medium" ? "warning" : "info",
      date: s.date.slice(0, 10),
      moduleKey: "senales",
      route: "/senales-ventas",
      read: read.has(`sig-${s.id}`),
    });
  }

  for (const o of purchaseOrderService.list()) {
    if (o.status !== "delayed") continue;
    out.push({
      id: `po-${o.id}`,
      title: "Orden de compra atrasada",
      message: `${o.number} · ${o.supplierName} · ${o.delayedDays} días de atraso`,
      tone: "danger",
      date: o.expectedDate,
      moduleKey: "ordenes",
      route: "/ordenes-compra",
      read: read.has(`po-${o.id}`),
    });
  }

  // Más recientes primero
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [readIds, setReadIds] = useLocalStorage<string[]>("compras:notif-read", []);

  const value = useMemo<NotificationContextValue>(() => {
    const notifications = buildNotifications(readIds);
    return {
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markRead: (id) => setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
      markAllRead: () => setReadIds(notifications.map((n) => n.id)),
    };
  }, [readIds, setReadIds]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de NotificationProvider");
  return ctx;
}
