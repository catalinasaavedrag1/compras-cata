import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  ALERT_REF_ENTITY_LABEL,
  alertRefLink,
  alertTypeUi,
} from "../components/business/alertBff";
import {
  getNotifications,
  isPurchaseBffConfigured,
  markNotificationsRead,
  toPurchaseBffError,
  type NotificationView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Centro de notificaciones (flujo 7) conectado al purchase-bff-service:
//  GET /notifications compone las alertas vivas (active + acknowledged) con el
//  estado de lectura por usuario del dominio (notification-state). Aquí ya no
//  hay notificaciones derivadas de mocks ni lectura en localStorage
//  ("compras:notif-read" desapareció): leer = PATCH /notifications/read.
//  - Polling suave: refresco cada 60 s con cleanup + refresh() al abrir el
//    panel (patrón usePurchaseOrders, flujo 3).
//  - Provider global: sin BFF configurado o sin sesión la campanita queda
//    vacía en silencio (no redirige por su cuenta, igual que ClaimsProvider).
//  - Si notification-state degradó, el BFF avisa con meta.partial: todo llega
//    como no-leído y el panel lo indica sin caerse.
// ============================================================================

const POLL_INTERVAL_MS = 60_000;

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
  /** Alertas vivas de severidad crítica (badge del menú "Alertas"). */
  criticalCount: number;
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  error: PurchaseBffError | null;
  /** true cuando el estado de lectura degradó (todo se muestra no-leído). */
  partial: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Refresca la campanita (se invoca al abrir el panel). */
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/** Severidad de la alerta → tono visual del panel existente. */
function toneOf(severity: string | null): NotifTone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

/** Ítem de la campanita del BFF → notificación del panel (navegación incluida). */
function toAppNotification(item: NotificationView): AppNotification {
  const refLabel =
    item.refEntity !== null ? (ALERT_REF_ENTITY_LABEL[item.refEntity] ?? item.refEntity) : null;
  return {
    id: item.id,
    title: item.title ?? alertTypeUi(item.type).label,
    message: refLabel !== null ? `${refLabel} · ${item.refId ?? "—"}` : alertTypeUi(item.type).label,
    tone: toneOf(item.severity),
    date: item.dateCreated?.slice(0, 10) ?? "",
    moduleKey: "alertas",
    route: alertRefLink(item.refEntity, item.refId)?.to ?? "/alertas",
    read: item.read,
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const configured = isPurchaseBffConfigured();
  const { authenticated } = useAuth();

  const [items, setItems] = useState<NotificationView[]>([]);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const [partial, setPartial] = useState(false);
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    if (!configured || !authenticated) return;
    const seq = ++loadSeqRef.current;
    try {
      const page = await getNotifications();
      if (seq !== loadSeqRef.current) return;
      setItems(page.items);
      setPartial(page.meta.partial === true);
      setError(null);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const info = toPurchaseBffError(err);
      // Sin sesión válida: campanita vacía (provider global, no redirige).
      if (info.code === "UNAUTHENTICATED") setItems([]);
      else setError(info);
    }
  }, [configured, authenticated]);

  // Carga inicial + polling suave cada 60 s (con cleanup del intervalo).
  useEffect(() => {
    if (!configured || !authenticated) return;
    void load();
    const timer = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load, configured, authenticated]);

  /**
   * Marca ids como leídos: optimista en la vista + PATCH idempotente al BFF.
   * Un fallo se ignora en silencio (el próximo poll trae la verdad).
   */
  const persistRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    void markNotificationsRead(ids).catch(() => undefined);
  }, []);

  // Identidad estable: el panel la usa como dependencia de su efecto de apertura.
  const refresh = useCallback(() => {
    void load();
  }, [load]);

  const value = useMemo<NotificationContextValue>(() => {
    const notifications = items.map(toAppNotification);
    return {
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      criticalCount: items.filter((n) => n.severity === "critical").length,
      configured,
      error,
      partial,
      markRead: (id) => persistRead([id]),
      markAllRead: () =>
        persistRead(items.filter((n) => !n.read).map((n) => n.id)),
      refresh,
    };
  }, [items, configured, error, partial, persistRead, refresh]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de NotificationProvider");
  return ctx;
}
