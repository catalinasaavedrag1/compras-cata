// ============================================================================
//  Cliente tipado del purchase-bff-service (API real de recomendaciones).
//  - Base URL: import.meta.env.VITE_PURCHASE_BFF_URL (vacío = no configurado).
//  - Token: sesión de `compras:auth` si trae `token`; si no, el token de
//    desarrollo VITE_PURCHASE_BFF_TOKEN.
//  - Envoltorios según docs/contratos-api/00-convenciones.md §2 (éxito) y §4
//    (errores). Fallo de red ⇒ error tipado { code: "NETWORK", retryable: true }.
// ============================================================================

const BASE_URL = (import.meta.env.VITE_PURCHASE_BFF_URL ?? "").replace(/\/$/, "");
const API_PREFIX = "/api/purchase-bff/v1";
const AUTH_STORAGE_KEY = "compras:auth";

/** ¿Está configurada la URL del purchase-bff-service? */
export function isPurchaseBffConfigured(): boolean {
  return BASE_URL.length > 0;
}

// ----------------------------------------------------------------------------
//  Tipos del contrato
// ----------------------------------------------------------------------------

export type BffPriority = "stockout_imminent" | "low_stock" | "opportunity";

export type BffRecommendationStatus = "pending" | "in_cart" | "ordered" | "ignored" | "snoozed";

export interface BffWarning {
  code: string;
  scope: string;
  message: string;
  retryable: boolean;
}

export interface ReplenishmentMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  partial?: boolean;
  warnings?: BffWarning[];
}

export interface ReplenishmentRow {
  recommendationId: string;
  sku: string;
  name: string;
  brand: string | null;
  category: { id: string | null; name: string | null };
  supplier: { id: string | null; name: string | null; sapCardCode: string | null };
  stock: {
    available: number | null;
    inTransit: number | null;
    security: number | null;
    asOf: string | null;
  } | null;
  stockOnHand: number | null;
  stockReserved: number | null;
  sales: { dailyVelocity: number | null; source: "analytics" | "materialized"; stale: boolean };
  salesLast30d: number | null;
  salesLast90d: number | null;
  rotation: number | null;
  marginPct: number | null;
  coverageDays: number | null;
  reorderPoint: number | null;
  minStock: number | null;
  maxStock: number | null;
  leadTimeDays: number | null;
  priority: BffPriority;
  /** Cantidad sugerida con override ya aplicado por el motor. */
  suggestedQty: number;
  suggestedQtyOriginal: number;
  overrideQty: number | null;
  suggestedAmountClp: number | null;
  packMultiple: number | null;
  moq: number | null;
  cost: { unitCost: number; currency: "CLP"; priceListId: string; asOf: string } | null;
  reason: string | null;
  risk: string | null;
  flags: string[];
  status: BffRecommendationStatus;
  version: number;
}

export interface ReplenishmentSearchFilters {
  q?: string;
  categoryIds?: string[];
  supplierIds?: string[];
  priority?: BffPriority[];
  status?: string[];
}

export interface ReplenishmentSearchBody {
  filters: ReplenishmentSearchFilters;
  scope: "mine" | "all";
  page: number;
  pageSize: number;
  sort: { field: string; order: "asc" | "desc" }[];
}

export interface ReplenishmentSearchData {
  items: ReplenishmentRow[];
  meta: ReplenishmentMeta;
}

/** Cuerpo del PATCH de recomendación. `reason` es obligatorio (auditable). */
export type RecommendationPatchBody =
  | { action: "override"; qty: number; reason: string }
  | { action: "ignore"; reason: string }
  | { action: "snooze"; snoozeUntil: string; reason: string };

/**
 * Respuesta del PATCH: recomendación cruda actualizada. Se tipa de forma
 * defensiva (solo los campos que el front necesita para refrescar la fila).
 */
export interface PatchedRecommendation {
  id: string;
  status?: BffRecommendationStatus;
  overrideQty?: number | null;
  suggestedQty?: number;
  version?: number;
}

export interface PurchaseBffError {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
  correlationId?: string;
  details?: unknown;
}

/** Error tipado del cliente: siempre transporta un PurchaseBffError. */
export class PurchaseBffApiError extends Error {
  readonly info: PurchaseBffError;

  constructor(info: PurchaseBffError) {
    super(info.message);
    this.name = "PurchaseBffApiError";
    this.info = info;
  }
}

/** Normaliza cualquier excepción del cliente a un PurchaseBffError. */
export function toPurchaseBffError(err: unknown): PurchaseBffError {
  if (err instanceof PurchaseBffApiError) return err.info;
  return NETWORK_ERROR;
}

const NETWORK_ERROR: PurchaseBffError = {
  code: "NETWORK",
  message: "No se pudo conectar con el servicio de compras.",
  statusCode: 0,
  retryable: true,
};

// ----------------------------------------------------------------------------
//  Resolución de token
// ----------------------------------------------------------------------------

function resolveToken(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object" && "token" in parsed) {
        const token = (parsed as { token: unknown }).token;
        if (typeof token === "string" && token.length > 0) return token;
      }
    }
  } catch {
    // Sesión ilegible: cae al token de desarrollo.
  }
  return import.meta.env.VITE_PURCHASE_BFF_TOKEN ?? "";
}

// ----------------------------------------------------------------------------
//  Envoltorios y request base
// ----------------------------------------------------------------------------

interface SuccessEnvelope {
  success: true;
  data: unknown;
  correlationId?: string;
}

interface ErrorEnvelope {
  success: false;
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  retryable: boolean;
  correlationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessEnvelope(payload: unknown): payload is SuccessEnvelope {
  return isRecord(payload) && payload.success === true && "data" in payload;
}

function isErrorEnvelope(payload: unknown): payload is ErrorEnvelope {
  return isRecord(payload) && payload.success === false && typeof payload.code === "string";
}

function parseErrorPayload(payload: unknown, httpStatus: number): PurchaseBffError {
  if (isErrorEnvelope(payload)) {
    return {
      code: payload.code,
      message: payload.message,
      statusCode: typeof payload.statusCode === "number" ? payload.statusCode : httpStatus,
      retryable: payload.retryable === true,
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : undefined,
      details: payload.details,
    };
  }
  return {
    code: httpStatus === 401 ? "UNAUTHENTICATED" : httpStatus >= 500 ? "INTERNAL_ERROR" : "UNKNOWN",
    message: `Error ${httpStatus} del servicio de compras.`,
    statusCode: httpStatus,
    retryable: httpStatus >= 500,
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, init);
  } catch {
    throw new PurchaseBffApiError(NETWORK_ERROR);
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || isErrorEnvelope(payload)) {
    throw new PurchaseBffApiError(parseErrorPayload(payload, res.status));
  }
  // Envoltorio de éxito del BFF (§2); si viniera crudo, se usa tal cual.
  if (isSuccessEnvelope(payload)) return payload.data as T;
  return payload as T;
}

function baseHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${resolveToken()}`,
    "Content-Type": "application/json",
  };
}

// ----------------------------------------------------------------------------
//  API pública
// ----------------------------------------------------------------------------

/** POST /replenishment/search — página de recomendaciones compuesta. */
export function searchReplenishment(body: ReplenishmentSearchBody): Promise<ReplenishmentSearchData> {
  return request<ReplenishmentSearchData>("/replenishment/search", {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
}

/** PATCH /replenishment/recommendations/:id — override / ignore / snooze. */
export function patchRecommendation(
  id: string,
  version: number,
  body: RecommendationPatchBody
): Promise<PatchedRecommendation> {
  return request<PatchedRecommendation>(`/replenishment/recommendations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...baseHeaders(), "If-Match": `"${version}"` },
    body: JSON.stringify(body),
  });
}
