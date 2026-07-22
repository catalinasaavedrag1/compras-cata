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
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  createClaim,
  getClaim,
  isPurchaseBffConfigured,
  listClaims,
  patchClaim,
  toPurchaseBffError,
  type ClaimDetailView,
  type ClaimPatchBody,
  type ClaimStatusBff,
  type ClaimSummaryView,
  type CreateClaimBody,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Reclamos al proveedor conectados al purchase-bff-service (flujo 5).
//  - La lista viaja en una página grande (igual que recepciones/OC) y los
//    filtros de pantalla siguen siendo client-side.
//  - Comandos C22 (POST 🔑 / PATCH If-Match); VERSION_CONFLICT / CONFLICT
//    recargan la lista para reflejar la realidad. UNAUTHENTICATED en comandos
//    cierra la sesión; en la carga inicial degrada en silencio (provider
//    global, no redirige por su cuenta).
//  - Mapeo de estados reales a las vistas "abiertos"/"resueltos" del front:
//      abiertos  = open | in_review
//      resueltos = resolved | rejected (terminales de la máquina C22)
// ============================================================================

const PAGE_SIZE = 100;

export type ClaimActionResult =
  | { ok: true; claim: ClaimDetailView }
  | { ok: false; error: PurchaseBffError };

interface ClaimsContextValue {
  claims: ClaimSummaryView[];
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  loading: boolean;
  error: PurchaseBffError | null;
  refetch: () => void;
  /** Reclamos abiertos (open | in_review). */
  openClaims: ClaimSummaryView[];
  /** Reclamos de un proveedor (por supplierRef persistido en el reclamo). */
  forSupplier: (supplierRef: string) => ClaimSummaryView[];
  /** GET /claims/:id — detalle con reason y bloques OC/recepción. */
  fetchDetail: (id: string) => Promise<ClaimActionResult>;
  /** POST /claims — abre un reclamo contra una OC (y recepción opcional). */
  create: (body: CreateClaimBody) => Promise<ClaimActionResult>;
  /** PATCH /claims/:id — start_review / resolve / reject (If-Match). */
  applyAction: (id: string, version: number, body: ClaimPatchBody) => Promise<ClaimActionResult>;
}

/** ¿El reclamo sigue abierto? (open | in_review; resolved/rejected cierran). */
export function isOpenClaim(status: ClaimStatusBff): boolean {
  return status === "open" || status === "in_review";
}

const ClaimsContext = createContext<ClaimsContextValue | null>(null);

export function ClaimsProvider({ children }: { children: ReactNode }) {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { authenticated, logout } = useAuth();

  const [claims, setClaims] = useState<ClaimSummaryView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const loadSeqRef = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !authenticated) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listClaims({ page: 1, pageSize: PAGE_SIZE });
      if (seq !== loadSeqRef.current) return;
      setClaims(page.items);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const info = toPurchaseBffError(err);
      // Sin sesión válida: lista vacía (sin redirigir desde un provider global).
      if (info.code === "UNAUTHENTICATED") setClaims([]);
      else setError(info);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [configured, authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Refleja en la lista el estado fresco que devuelve un comando o detalle. */
  const applyDetail = useCallback((detail: ClaimDetailView) => {
    setClaims((prev) =>
      prev.some((c) => c.id === detail.id)
        ? prev.map((c) => (c.id === detail.id ? detail : c))
        : [detail, ...prev]
    );
  }, []);

  const runCommand = useCallback(
    async (command: () => Promise<ClaimDetailView>): Promise<ClaimActionResult> => {
      try {
        const claim = await command();
        applyDetail(claim);
        return { ok: true, claim };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Versión o estado obsoletos: recargar para reflejar la realidad.
        if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [applyDetail, handleUnauthenticated, load]
  );

  const fetchDetail = useCallback(
    (id: string) => runCommand(() => getClaim(id)),
    [runCommand]
  );

  const create = useCallback(
    (body: CreateClaimBody) => runCommand(() => createClaim(body)),
    [runCommand]
  );

  const applyAction = useCallback(
    (id: string, version: number, body: ClaimPatchBody) =>
      runCommand(() => patchClaim(id, version, body)),
    [runCommand]
  );

  const value = useMemo<ClaimsContextValue>(
    () => ({
      claims,
      configured,
      loading,
      error,
      refetch: () => void load(),
      openClaims: claims.filter((c) => isOpenClaim(c.status)),
      forSupplier: (supplierRef) => claims.filter((c) => c.supplierRef === supplierRef),
      fetchDetail,
      create,
      applyAction,
    }),
    [claims, configured, loading, error, load, fetchDetail, create, applyAction]
  );

  return <ClaimsContext.Provider value={value}>{children}</ClaimsContext.Provider>;
}

export function useClaims(): ClaimsContextValue {
  const ctx = useContext(ClaimsContext);
  if (!ctx) throw new Error("useClaims debe usarse dentro de ClaimsProvider");
  return ctx;
}
