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

// ----------------------------------------------------------------------------
//  Tipos del contrato — Propuestas de compra (F3) y aprobaciones
// ----------------------------------------------------------------------------

/** Meta de paginación estándar del BFF (buildPageMeta). */
export interface BffPageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type ProposalStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "cancelled"
  | "converted";

export type ApprovalState = "pending" | "approved" | "rejected" | "observed";

/** Criterio de gobernanza roto (high_amount / excessive_coverage). */
export interface ProposalCriterion {
  code: string;
  threshold: unknown;
  actual: unknown;
  sku: string | null;
}

export interface ProposalLine {
  lineId: string;
  sku: string;
  skuName: string | null;
  supplierId: string;
  categoryId: string | null;
  qty: number;
  packMultiple: number | null;
  moq: number | null;
  unitCostClp: number | null;
  landedUnitCostClp: number | null;
  subtotalClp: number | null;
  recommendationId: string | null;
  version: number;
}

export interface ProposalSupplierGroup {
  supplierId: string;
  supplierName: string | null;
  sapCardCode: string | null;
  netTotalClp: number;
  lines: ProposalLine[];
}

export interface ProposalTotals {
  netClp: number | null;
  landedClp: number | null;
  lineCount: number | null;
  supplierCount: number | null;
}

export interface ProposalApprovalInfo {
  id: string;
  state: ApprovalState;
  version: number;
  criteria?: ProposalCriterion[];
}

/** Vista de propuesta que entrega el BFF (proposals.mapper → F3). */
export interface ProposalView {
  id: string;
  status: ProposalStatus;
  version: number;
  buyerId: string | null;
  title: string | null;
  note: string | null;
  netTotalClp: number | null;
  landedTotalClp: number | null;
  lineCount: number | null;
  supplierCount: number | null;
  /** Solo presente en el detalle (la lista viene sin líneas). */
  supplierGroups?: ProposalSupplierGroup[];
  totals?: ProposalTotals;
  approvalId?: string | null;
  approval?: ProposalApprovalInfo | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  cancelReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProposalListData {
  items: ProposalView[];
  meta: BffPageMeta;
}

/** Nueva línea: desde una recomendación o manual (con snapshot de proveedor). */
export type NewProposalLineBody =
  | { sku: string; qty: number; recommendationId: string }
  | { sku: string; qty: number; supplierId: string; categoryId: string; skuName?: string };

/** Ítem de la bandeja de aprobaciones (approval.mapper de purchase-service). */
export interface ApprovalItem {
  id: string;
  proposalId: string;
  state: ApprovalState;
  version: number;
  requestedByUserId: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  note: string | null;
  reason: string | null;
  criteria?: ProposalCriterion[];
  proposal?: {
    id: string;
    status: ProposalStatus;
    buyerId: string | null;
    title: string | null;
    netTotalClp: number;
    version: number;
  };
  createdAt: string;
}

export interface ApprovalListData {
  items: ApprovalItem[];
  meta: BffPageMeta;
}

export type ApprovalAction = "approve" | "reject" | "request-changes";

/** GET /context: sesión, permisos purchase:* y cartera asignada. */
export interface PurchaseContextData {
  userId: string;
  name: string | null;
  buyerId: string | null;
  role: string | null;
  permissions: string[];
  assignedCategories: string[];
  warnings?: BffWarning[];
}

/** Etiquetas en español de los códigos de criterio de gobernanza. */
export const CRITERION_LABEL_ES: Record<string, string> = {
  high_amount: "Monto alto",
  excessive_coverage: "Cobertura excesiva",
};

export function criterionLabelEs(code: string): string {
  return CRITERION_LABEL_ES[code] ?? code;
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
//  Mensajes legibles para errores de negocio (422/409 del catálogo del BFF)
// ----------------------------------------------------------------------------

function detailsRecord(details: unknown): Record<string, unknown> {
  return isRecord(details) ? details : {};
}

function detailString(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

/**
 * Traduce un PurchaseBffError a un mensaje accionable en español, incluyendo
 * el detalle de negocio (SKUs bajo MOQ, líneas sin costo, presupuesto, etc.).
 */
export function describePurchaseBffError(info: PurchaseBffError): string {
  const d = detailsRecord(info.details);
  switch (info.code) {
    case "MOQ_NOT_MET": {
      if (Array.isArray(d.lines)) {
        const skus = d.lines
          .map((l) => {
            const line = detailsRecord(l);
            const sku = detailString(line.sku);
            const qty = detailString(line.qty);
            const moq = detailString(line.moq);
            return sku ? `${sku} (${qty} u. / mín. ${moq})` : "";
          })
          .filter((s) => s.length > 0);
        if (skus.length > 0) {
          return `Hay líneas bajo el mínimo de compra del proveedor: ${skus.join(", ")}.`;
        }
      }
      const suggested = detailString(d.suggestedQty);
      if (suggested) {
        return `La cantidad no respeta el múltiplo de compra; prueba con ${suggested} u.`;
      }
      return "Hay líneas bajo el mínimo de compra del proveedor.";
    }
    case "COST_MISSING": {
      const skus = Array.isArray(d.skus) ? d.skus.map(detailString).filter(Boolean) : [];
      return skus.length > 0
        ? `Hay líneas sin costo vigente: ${skus.join(", ")}.`
        : "Hay líneas sin costo vigente; no se puede enviar a revisión.";
    }
    case "OTB_EXCEEDED": {
      const category = detailString(d.categoryId);
      return category
        ? `La compra excede el presupuesto abierto (OTB) de la categoría ${category}.`
        : "La compra excede el presupuesto abierto (OTB).";
    }
    case "SUPPLIER_INACTIVE": {
      const supplier = detailString(d.supplierId);
      return supplier
        ? `El proveedor ${supplier} está inactivo o bloqueado.`
        : "Hay un proveedor inactivo o bloqueado en la propuesta.";
    }
    case "PURCHASE_PROPOSAL_INVALID_STATE":
      return "La propuesta cambió de estado y esta acción ya no aplica.";
    case "VERSION_CONFLICT":
      return "El registro cambió en otra sesión; se recargaron los datos.";
    case "FORBIDDEN":
      return info.message || "No tienes permiso para realizar esta acción.";
    default:
      return info.message || "Error del servicio de compras.";
  }
}

/** Clave de idempotencia para comandos POST (🔑 según contrato). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

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

// ----------------------------------------------------------------------------
//  API pública — Propuestas de compra (F3)
// ----------------------------------------------------------------------------

function ifMatch(version: number): Record<string, string> {
  return { "If-Match": `"${version}"` };
}

function idempotency(): Record<string, string> {
  return { "idempotency-key": newIdempotencyKey() };
}

/** POST /proposals — crea una propuesta (🔑 idempotente). */
export function createProposal(body: {
  title?: string;
  note?: string;
  lines?: NewProposalLineBody[];
}): Promise<ProposalView> {
  return request<ProposalView>("/proposals", {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency() },
    body: JSON.stringify(body),
  });
}

/** GET /proposals?status=&page=&pageSize= — lista (sin líneas). */
export function listProposals(params: {
  status?: ProposalStatus;
  page?: number;
  pageSize?: number;
}): Promise<ProposalListData> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<ProposalListData>(`/proposals?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /proposals/:id — detalle con supplierGroups y totals. */
export function getProposal(id: string): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** POST /proposals/:id/lines — agrega una línea (🔑 + If-Match propuesta). */
export function addProposalLine(
  id: string,
  proposalVersion: number,
  body: NewProposalLineBody
): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}/lines`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(proposalVersion) },
    body: JSON.stringify(body),
  });
}

/** PATCH /proposals/:id/lines/:lineId — cantidad (If-Match con versión de LÍNEA). */
export function updateProposalLine(
  id: string,
  lineId: string,
  lineVersion: number,
  qty: number
): Promise<ProposalView> {
  return request<ProposalView>(
    `/proposals/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}`,
    {
      method: "PATCH",
      headers: { ...baseHeaders(), ...ifMatch(lineVersion) },
      body: JSON.stringify({ qty }),
    }
  );
}

/** DELETE /proposals/:id/lines/:lineId — elimina la línea (If-Match de línea). */
export function deleteProposalLine(
  id: string,
  lineId: string,
  lineVersion: number
): Promise<ProposalView> {
  return request<ProposalView>(
    `/proposals/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}`,
    {
      method: "DELETE",
      headers: { ...baseHeaders(), ...ifMatch(lineVersion) },
    }
  );
}

/** POST /proposals/:id/submit — envía a revisión (🔑 + If-Match). */
export function submitProposal(id: string, version: number): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({}),
  });
}

/** POST /proposals/:id/cancel — cancela con motivo (🔑 + If-Match). */
export function cancelProposal(id: string, version: number, reason: string): Promise<ProposalView> {
  return request<ProposalView>(`/proposals/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify({ reason }),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Aprobaciones
// ----------------------------------------------------------------------------

/** GET /approvals?state=&page=&pageSize= — bandeja de aprobaciones. */
export function listApprovals(params: {
  state?: ApprovalState;
  page?: number;
  pageSize?: number;
}): Promise<ApprovalListData> {
  const query = new URLSearchParams();
  query.set("state", params.state ?? "pending");
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  return request<ApprovalListData>(`/approvals?${query.toString()}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/** GET /approvals/:id — detalle de una aprobación. */
export function getApproval(id: string): Promise<ApprovalItem> {
  return request<ApprovalItem>(`/approvals/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: baseHeaders(),
  });
}

/**
 * POST /approvals/:id/approve|reject|request-changes — decide (🔑 + If-Match).
 * `reason` es obligatorio en reject/request-changes (lo valida el dominio).
 */
export function decideApproval(
  id: string,
  action: ApprovalAction,
  version: number,
  body: { reason?: string; note?: string }
): Promise<ApprovalItem> {
  return request<ApprovalItem>(`/approvals/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { ...baseHeaders(), ...idempotency(), ...ifMatch(version) },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------------------
//  API pública — Contexto de sesión
// ----------------------------------------------------------------------------

/** GET /context — sesión, permisos purchase:* y cartera asignada. */
export function getContext(): Promise<PurchaseContextData> {
  return request<PurchaseContextData>("/context", {
    method: "GET",
    headers: baseHeaders(),
  });
}
