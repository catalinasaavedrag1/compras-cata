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
  isPurchaseBffConfigured,
  listSignals,
  toPurchaseBffError,
  type PurchaseBffError,
  type SignalBffPriority,
  type SignalView,
} from "../services/purchaseBff";
import {
  useSignalCommands,
  type CreateSignalInput,
  type SignalCommandResult,
  type SignalCommentResult,
  type SignalTargetStatus,
} from "../hooks/useSignals";

// ============================================================================
//  Estado central de las Señales de Ventas, conectado al purchase-bff (F13).
//  Fuente única para la bandeja, los badges del menú y "Mi panel": carga la
//  lista completa (una página grande, como reclamos) y expone los comandos de
//  la máquina real new → in_review → actioned | dismissed.
//  - UNAUTHENTICATED en la carga inicial degrada en silencio (provider global);
//    en comandos cierra sesión (vía useSignalCommands).
//  - VERSION_CONFLICT / CONFLICT recargan la lista para reflejar la realidad.
// ============================================================================

const PAGE_SIZE = 100;

interface SignalsContextValue {
  signals: SignalView[];
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  loading: boolean;
  error: PurchaseBffError | null;
  refetch: () => void;
  /** POST /signals — reportar una señal desde el terreno. */
  report: (input: CreateSignalInput) => Promise<SignalCommandResult>;
  /** PATCH /signals/:id — transición de estado (dismissed exige reason). */
  transition: (
    id: string,
    version: number,
    status: SignalTargetStatus,
    reason?: string
  ) => Promise<SignalCommandResult>;
  /** PATCH /signals/:id — cambio de prioridad. */
  setPriority: (
    id: string,
    version: number,
    priority: SignalBffPriority
  ) => Promise<SignalCommandResult>;
  /** POST /signals/:id/comments — comentario del hilo. */
  comment: (id: string, body: string) => Promise<SignalCommentResult>;
}

const SignalsContext = createContext<SignalsContextValue | null>(null);

export function SignalsProvider({ children }: { children: ReactNode }) {
  const configured = isPurchaseBffConfigured();
  const { authenticated } = useAuth();

  const [signals, setSignals] = useState<SignalView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    if (!configured || !authenticated) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listSignals({ page: 1, pageSize: PAGE_SIZE });
      if (seq !== loadSeqRef.current) return;
      setSignals(page.items);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const info = toPurchaseBffError(err);
      // Sin sesión válida: lista vacía (sin redirigir desde un provider global).
      if (info.code === "UNAUTHENTICATED") setSignals([]);
      else setError(info);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [configured, authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Refleja en la lista el estado fresco que devuelve un comando. */
  const applyView = useCallback((view: SignalView) => {
    setSignals((prev) =>
      prev.some((s) => s.id === view.id)
        ? prev.map((s) => (s.id === view.id ? { ...s, ...view } : s))
        : [view, ...prev]
    );
  }, []);

  const commands = useSignalCommands({ onConflict: () => void load() });

  const report = useCallback(
    async (input: CreateSignalInput) => {
      const result = await commands.report(input);
      if (result.ok) applyView(result.signal);
      return result;
    },
    [commands, applyView]
  );

  const transition = useCallback(
    async (id: string, version: number, status: SignalTargetStatus, reason?: string) => {
      const result = await commands.transition(id, version, status, reason);
      if (result.ok) applyView(result.signal);
      return result;
    },
    [commands, applyView]
  );

  const setPriority = useCallback(
    async (id: string, version: number, priority: SignalBffPriority) => {
      const result = await commands.setPriority(id, version, priority);
      if (result.ok) applyView(result.signal);
      return result;
    },
    [commands, applyView]
  );

  const comment = useCallback(
    async (id: string, body: string) => {
      const result = await commands.comment(id, body);
      // El comando no devuelve la señal: solo se ajusta el contador del hilo.
      if (result.ok) {
        setSignals((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, messageCount: (s.messageCount ?? 0) + 1 } : s
          )
        );
      }
      return result;
    },
    [commands]
  );

  const value = useMemo<SignalsContextValue>(
    () => ({
      signals,
      configured,
      loading,
      error,
      refetch: () => void load(),
      report,
      transition,
      setPriority,
      comment,
    }),
    [signals, configured, loading, error, load, report, transition, setPriority, comment]
  );

  return <SignalsContext.Provider value={value}>{children}</SignalsContext.Provider>;
}

export function useSignals(): SignalsContextValue {
  const ctx = useContext(SignalsContext);
  if (!ctx) throw new Error("useSignals debe usarse dentro de SignalsProvider");
  return ctx;
}
