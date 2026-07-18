import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Drawer } from "../components/ui/Drawer";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import {
  IconPlus,
  IconClose,
  IconChat,
  IconCheck,
  IconClock,
  IconCart,
  IconSearch,
  IconLock,
} from "../components/ui/icons";
import { formatCurrency, formatDate, formatDays, formatNumber } from "../utils/formatters";
import { useToast } from "../context/ToastContext";
import { TODAY_ISO } from "../utils/constants";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import {
  useRfqs,
  useRfqPickerData,
  type RfqSkuOption,
  type RfqSupplierOption,
} from "../hooks/useRfqs";
import {
  AWARDABLE_RFQ_STATUSES,
  CANCELLABLE_RFQ_STATUSES,
  RESPONDABLE_RFQ_STATUSES,
  RFQ_AWARD_PERMISSION,
  describeRfqError,
  isRfqOverdue,
  isValidSupplierRef,
  responseSupplierLabel,
  responseTotalClp,
  rfqStatusUi,
} from "./rfq/helpers";
import type {
  CreateRfqBody,
  CreateRfqResponseBody,
  PurchaseBffError,
  RfqDetailView,
  RfqLineView,
  RfqResponseLineView,
  RfqResponseView,
  RfqSummaryView,
} from "../services/purchaseBff";

// ============================================================================
//  Cotizaciones (flujo 8) conectadas al purchase-bff-service. La máquina real
//  (draft → sent → partially_responded | responded → awarded | cancelled) se
//  mapea a las pestañas existentes en ./rfq/helpers.ts; "vencida" se deriva de
//  dueDate < hoy en sent | partially_responded (v1 no auto-expira).
//  Adjudicar (C20) crea la propuesta draft en el dominio y exige el permiso
//  purchase:rfq:award: el botón se gatea con el contexto de sesión, con el
//  aviso de candado de Aprobaciones/Reclamos.
// ============================================================================

// Tabs por estado real. "En negociación" del mock no existe en la máquina:
// se reemplaza por "Vencidas / canceladas" (cerradas sin adjudicar).
type TabKey = "borrador" | "enviadas" | "respondidas" | "adjudicadas" | "cerradas";

const TABS: { value: "todas" | TabKey; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "borrador", label: "Borrador" },
  { value: "enviadas", label: "Enviadas" },
  { value: "respondidas", label: "Respondidas" },
  { value: "adjudicadas", label: "Adjudicadas" },
  { value: "cerradas", label: "Vencidas / canceladas" },
];

/** Pestaña de una RFQ: estado real + vencida derivada de dueDate. */
function tabOf(rfq: RfqSummaryView): TabKey {
  if (isRfqOverdue(rfq, TODAY_ISO)) return "cerradas";
  switch (rfq.status) {
    case "draft":
      return "borrador";
    case "sent":
      return "enviadas";
    case "partially_responded":
    case "responded":
      return "respondidas";
    case "awarded":
      return "adjudicadas";
    default:
      // cancelled | expired
      return "cerradas";
  }
}

const fmtIso = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Días desde "hoy" (demo) hasta una fecha ISO; null si no hay fecha. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date(`${TODAY_ISO}T00:00:00`);
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function RfqPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = usePurchaseContext();
  const canAward = hasPermission(RFQ_AWARD_PERMISSION);

  const { rfqs, loading, error, configured, refetch, fetchDetail, create, applyPatch, addResponse, award } =
    useRfqs();
  const picker = useRfqPickerData();

  const [tab, setTab] = useState<string>("todas");
  const [createOpen, setCreateOpen] = useState(false);

  // Detalle de comparación bajo demanda (fila → drawer).
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RfqDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<PurchaseBffError | null>(null);
  const detailIdRef = useRef<string | null>(null);
  detailIdRef.current = detailId;

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      const result = await fetchDetail(id);
      if (detailIdRef.current !== id) return;
      if (result.ok) setDetail(result.rfq);
      else setDetailError(result.error);
      setDetailLoading(false);
    },
    [fetchDetail]
  );

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetail(null);
    void loadDetail(id);
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setDetailError(null);
  };

  // KPIs sobre la máquina real (vencidas derivadas quedan fuera de "por responder").
  const kpis = useMemo(() => {
    const porResponder = rfqs.filter(
      (r) =>
        (r.status === "sent" || r.status === "partially_responded") && !isRfqOverdue(r, TODAY_ISO)
    ).length;
    const respondidas = rfqs.filter((r) => r.status === "responded").length;
    const porVencer = rfqs.filter((r) => {
      if (!["sent", "partially_responded", "responded"].includes(r.status)) return false;
      const d = daysUntil(r.dueDate);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    const adjudicadas = rfqs.filter((r) => r.status === "awarded").length;
    return { porResponder, respondidas, porVencer, adjudicadas };
  }, [rfqs]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: rfqs.length };
    for (const t of TABS) if (t.value !== "todas") c[t.value] = 0;
    for (const r of rfqs) c[tabOf(r)] += 1;
    return c;
  }, [rfqs]);

  const filtered = useMemo(
    () => (tab === "todas" ? rfqs : rfqs.filter((r) => tabOf(r) === tab)),
    [rfqs, tab]
  );

  // --------------------------------------------------------------------------
  //  Acciones sobre el detalle abierto (toasts + manejo estándar de errores).
  // --------------------------------------------------------------------------

  const [busy, setBusy] = useState(false);

  const handleActionError = useCallback(
    (info: PurchaseBffError, rfqId: string) => {
      if (info.code === "UNAUTHENTICATED") return;
      if (info.code === "VERSION_CONFLICT") {
        toast.warning("La cotización cambió en otra sesión; se recargaron los datos");
      } else {
        toast.error(describeRfqError(info));
      }
      // Estado o versión obsoletos: refrescar el detalle abierto.
      if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
        if (detailIdRef.current === rfqId) void loadDetail(rfqId);
      }
    },
    [toast, loadDetail]
  );

  const handleSend = async (rfq: RfqDetailView) => {
    setBusy(true);
    const result = await applyPatch(rfq.id, rfq.version, { action: "send" });
    setBusy(false);
    if (result.ok) {
      setDetail(result.rfq);
      toast.success(
        `${rfq.number} enviada a ${rfq.suppliers.length} proveedor${rfq.suppliers.length === 1 ? "" : "es"}`
      );
    } else {
      handleActionError(result.error, rfq.id);
    }
  };

  const handleCancel = async (rfq: RfqDetailView, reason: string): Promise<boolean> => {
    setBusy(true);
    const result = await applyPatch(rfq.id, rfq.version, { action: "cancel", reason });
    setBusy(false);
    if (result.ok) {
      setDetail(result.rfq);
      toast.success(`${rfq.number} cancelada`);
      return true;
    }
    handleActionError(result.error, rfq.id);
    return false;
  };

  const handleRespond = async (
    rfq: RfqDetailView,
    body: CreateRfqResponseBody
  ): Promise<boolean> => {
    setBusy(true);
    const result = await addResponse(rfq.id, rfq.version, body);
    setBusy(false);
    if (result.ok) {
      setDetail(result.rfq);
      const supplier = rfq.suppliers.find((s) => s.supplierRef === body.supplierRef);
      toast.success(
        `Respuesta de ${supplier?.supplierName ?? body.supplierRef} registrada (${result.rfq.respondedCount}/${result.rfq.supplierCount})`
      );
      return true;
    }
    handleActionError(result.error, rfq.id);
    return false;
  };

  const handleAward = async (rfq: RfqDetailView, responseId: string): Promise<boolean> => {
    setBusy(true);
    const result = await award(rfq.id, rfq.version, responseId);
    setBusy(false);
    if (result.ok) {
      setDetail(result.rfq);
      toast.success(`Cotización adjudicada — propuesta ${result.proposalId} creada`, {
        label: "Ver borradores",
        onClick: () => navigate("/comprar/borradores"),
      });
      return true;
    }
    handleActionError(result.error, rfq.id);
    return false;
  };

  const handleCreate = async (body: CreateRfqBody): Promise<boolean> => {
    const result = await create(body);
    if (result.ok) {
      setCreateOpen(false);
      setTab("borrador");
      toast.success(
        `Cotización ${result.rfq.number} creada con ${body.lines.length} producto${body.lines.length === 1 ? "" : "s"} y ${body.supplierRefs.length} proveedor${body.supplierRefs.length === 1 ? "" : "es"}`
      );
      return true;
    }
    if (result.error.code !== "UNAUTHENTICATED") toast.error(describeRfqError(result.error));
    return false;
  };

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------

  const pageTitle = "Cotizaciones";
  const pageDescription =
    "Solicita cotizaciones (RFQ) a tus proveedores, compara precio, plazo y mínimo de compra lado a lado, y adjudica la mejor oferta como propuesta de compra.";

  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver las cotizaciones reales y gestionarlas contra el servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && rfqs.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando cotizaciones">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && rfqs.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las cotizaciones
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const columns: Column<RfqSummaryView>[] = [
    {
      key: "numero",
      header: "N° cotización",
      render: (r) => (
        <div className="min-w-[140px]">
          <p className="font-medium text-slate-800">{r.number}</p>
          <p className="text-xs text-slate-400 truncate max-w-[220px]">{r.title}</p>
        </div>
      ),
    },
    {
      key: "fechas",
      header: "Fecha / Vencimiento",
      hideOnMobile: true,
      render: (r) => {
        const d = daysUntil(r.dueDate);
        const open = ["sent", "partially_responded", "responded"].includes(r.status);
        const soon = open && d !== null && d >= 0 && d <= 7;
        const overdue = isRfqOverdue(r, TODAY_ISO);
        return (
          <div className="text-sm">
            <p className="text-slate-700">{fmtIso(r.dateCreated)}</p>
            <p
              className={`text-xs ${overdue ? "text-rose-600 font-medium" : soon ? "text-amber-600 font-medium" : "text-slate-400"}`}
            >
              {r.dueDate ? `vence ${fmtIso(r.dueDate)}` : "sin vencimiento"}
              {soon && d !== null && ` · en ${formatDays(d)}`}
            </p>
          </div>
        );
      },
    },
    {
      key: "productos",
      header: "Productos",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatNumber(r.lineCount),
    },
    {
      key: "proveedores",
      header: "Proveedores",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatNumber(r.supplierCount)}</p>
          <p className="text-xs text-slate-400">{r.respondedCount} respondió</p>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (r) => {
        const ui = rfqStatusUi(r, TODAY_ISO);
        return (
          <Badge tone={ui.tone} dot>
            {ui.label}
          </Badge>
        );
      },
    },
    {
      key: "accion",
      header: "",
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openDetail(r.id);
          }}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {r.respondedCount > 0 ? "Comparar" : "Ver detalle"}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <Button onClick={() => setCreateOpen(true)} icon={<IconPlus className="w-4 h-4" />}>
            Nueva cotización
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Por responder"
          value={formatNumber(kpis.porResponder)}
          tone="info"
          icon={<IconChat className="w-4 h-4" />}
          description="Enviadas o parciales"
          active={tab === "enviadas"}
          onClick={() => setTab("enviadas")}
        />
        <KpiCard
          title="Respondidas completas"
          value={formatNumber(kpis.respondidas)}
          tone={kpis.respondidas > 0 ? "warn" : "neutral"}
          icon={<IconCheck className="w-4 h-4" />}
          description="Listas para adjudicar"
          active={tab === "respondidas"}
          onClick={() => setTab("respondidas")}
        />
        <KpiCard
          title="Por vencer (≤ 7 días)"
          value={formatNumber(kpis.porVencer)}
          tone={kpis.porVencer > 0 ? "bad" : "neutral"}
          icon={<IconClock className="w-4 h-4" />}
          description="Cierra el proceso"
        />
        <KpiCard
          title="Adjudicadas"
          value={formatNumber(kpis.adjudicadas)}
          tone="good"
          icon={<IconCart className="w-4 h-4" />}
          description="Propuesta creada"
          active={tab === "adjudicadas"}
          onClick={() => setTab("adjudicadas")}
        />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))}
      />

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => openDetail(r.id)}
          emptyMessage="No hay cotizaciones en esta vista. Crea una nueva con el botón de arriba."
          mobileCard={(r) => {
            const ui = rfqStatusUi(r, TODAY_ISO);
            return (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{r.number}</p>
                    <p className="text-xs text-slate-400">
                      {r.lineCount} prod. · {r.supplierCount} prov. ·{" "}
                      {r.dueDate ? `vence ${fmtIso(r.dueDate)}` : "sin vencimiento"}
                    </p>
                  </div>
                  <Badge tone={ui.tone} dot>
                    {ui.label}
                  </Badge>
                </div>
              </div>
            );
          }}
        />
      </Card>

      <CreateRfqModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        skuOptions={picker.skuOptions}
        supplierOptions={picker.supplierOptions}
        pickerLoading={picker.loading}
        pickerDegraded={picker.degraded}
        ensurePicker={picker.ensure}
      />

      <ComparisonDrawer
        open={detailId !== null}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        busy={busy}
        canAward={canAward}
        onRetry={() => detailId && void loadDetail(detailId)}
        onClose={closeDetail}
        onSend={handleSend}
        onCancel={handleCancel}
        onRespond={handleRespond}
        onAward={handleAward}
      />
    </div>
  );
}

// ============================================================================
//  Drawer de comparación: líneas con mejor precio real (bestUnitCostClp del
//  dominio), invitados, ofertas recibidas y acciones de la máquina.
// ============================================================================

function ComparisonDrawer({
  open,
  detail,
  loading,
  error,
  busy,
  canAward,
  onRetry,
  onClose,
  onSend,
  onCancel,
  onRespond,
  onAward,
}: {
  open: boolean;
  detail: RfqDetailView | null;
  loading: boolean;
  error: PurchaseBffError | null;
  busy: boolean;
  canAward: boolean;
  onRetry: () => void;
  onClose: () => void;
  onSend: (rfq: RfqDetailView) => void;
  onCancel: (rfq: RfqDetailView, reason: string) => Promise<boolean>;
  onRespond: (rfq: RfqDetailView, body: CreateRfqResponseBody) => Promise<boolean>;
  onAward: (rfq: RfqDetailView, responseId: string) => Promise<boolean>;
}) {
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [respondOpen, setRespondOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmAward, setConfirmAward] = useState(false);

  // Reinicia la selección al cambiar de cotización.
  const detailKey = detail?.id ?? null;
  useEffect(() => {
    setSelectedResponseId(null);
    setRespondOpen(false);
    setCancelOpen(false);
    setConfirmAward(false);
  }, [detailKey]);

  const hasResponses = !!detail && detail.responses.length > 0;
  const awardable =
    !!detail && AWARDABLE_RFQ_STATUSES.includes(detail.status) && hasResponses;
  const respondable =
    !!detail &&
    RESPONDABLE_RFQ_STATUSES.includes(detail.status) &&
    detail.suppliers.some((s) => s.respondedAt === null);
  const cancellable = !!detail && CANCELLABLE_RFQ_STATUSES.includes(detail.status);

  const selectedResponse =
    detail?.responses.find((r) => r.id === selectedResponseId) ?? null;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={detail ? `Comparación · ${detail.number}` : "Comparación"}
        description={
          detail
            ? `${detail.lineCount} producto${detail.lineCount === 1 ? "" : "s"} · ${detail.supplierCount} proveedor${detail.supplierCount === 1 ? "" : "es"} · ${detail.dueDate ? `vence ${fmtIso(detail.dueDate)}` : "sin vencimiento"}`
            : undefined
        }
        footer={
          detail ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
              {cancellable && (
                <Button variant="secondary" disabled={busy} onClick={() => setCancelOpen(true)}>
                  Cancelar cotización
                </Button>
              )}
              {respondable && (
                <Button variant="secondary" disabled={busy} onClick={() => setRespondOpen(true)}>
                  Registrar respuesta
                </Button>
              )}
              {detail.status === "draft" && (
                <Button disabled={busy} onClick={() => onSend(detail)}>
                  {busy ? "Enviando…" : "Enviar a proveedores"}
                </Button>
              )}
              {awardable && canAward && (
                <Button
                  icon={<IconCart className="w-4 h-4" />}
                  disabled={busy || !selectedResponseId}
                  onClick={() => setConfirmAward(true)}
                >
                  Adjudicar
                </Button>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          )
        }
      >
        {loading && (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando comparación">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-4 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar la comparación
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const ui = rfqStatusUi(detail, TODAY_ISO);
                return (
                  <Badge tone={ui.tone} dot>
                    {ui.label}
                  </Badge>
                );
              })()}
              <span className="text-xs text-slate-400">
                {detail.title} · solicitada {fmtIso(detail.dateCreated)}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Proveedores invitados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.suppliers.map((s) => (
                  <Badge key={s.id} tone={s.respondedAt ? "green" : "neutral"} dot>
                    {s.supplierName ?? s.supplierRef}
                    {s.respondedAt ? "" : " · sin respuesta"}
                  </Badge>
                ))}
              </div>
            </div>

            {!hasResponses ? (
              <EmptyState
                icon={<IconChat className="w-6 h-6" />}
                title={detail.status === "draft" ? "Borrador sin enviar" : "Aún sin respuestas"}
                description={
                  detail.status === "draft"
                    ? "Envía la cotización para invitar formalmente a los proveedores y empezar a recibir ofertas."
                    : "Esta cotización todavía no recibe ofertas de los proveedores invitados. Registra las respuestas cuando lleguen para comparar."
                }
              />
            ) : (
              <div className="space-y-4">
                {detail.lines.map((line) => (
                  <LineComparison key={line.id} detail={detail} line={line} />
                ))}
              </div>
            )}

            {hasResponses && (
              <ResponsesSection
                detail={detail}
                selectable={awardable && canAward}
                selectedResponseId={selectedResponseId}
                onSelect={setSelectedResponseId}
              />
            )}

            {awardable && !canAward && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <IconLock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                <span>
                  Adjudicar requiere el permiso{" "}
                  <b className="text-slate-700">purchase:rfq:award</b> en tu sesión.
                </span>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {detail && respondOpen && (
        <RegisterResponseModal
          detail={detail}
          busy={busy}
          onClose={() => setRespondOpen(false)}
          onSubmit={async (body) => {
            const ok = await onRespond(detail, body);
            if (ok) setRespondOpen(false);
            return ok;
          }}
        />
      )}

      {detail && cancelOpen && (
        <CancelRfqModal
          rfq={detail}
          busy={busy}
          onClose={() => setCancelOpen(false)}
          onConfirm={async (reason) => {
            const ok = await onCancel(detail, reason);
            if (ok) setCancelOpen(false);
            return ok;
          }}
        />
      )}

      {detail && selectedResponse && (
        <ConfirmModal
          open={confirmAward}
          title="Adjudicar cotización"
          message={`Se adjudicará ${detail.number} a ${responseSupplierLabel(detail, selectedResponse)}${(() => {
            const total = responseTotalClp(detail, selectedResponse);
            return total !== null ? ` por ${formatCurrency(total)}` : "";
          })()}. El dominio creará una propuesta de compra en borrador que sigue el circuito normal de aprobación.`}
          confirmLabel="Adjudicar"
          onCancel={() => setConfirmAward(false)}
          onConfirm={() => {
            setConfirmAward(false);
            void onAward(detail, selectedResponse.id);
          }}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
//  Comparación por línea: mejor precio real del dominio (bestUnitCostClp)
//  resaltado con el mismo patrón visual del mock; plazo a nivel de oferta.
// ----------------------------------------------------------------------------

function LineComparison({ detail, line }: { detail: RfqDetailView; line: RfqLineView }) {
  const rows = detail.responses
    .map((response) => ({
      response,
      quote: response.lines.find((l) => l.rfqLineId === line.id) ?? null,
    }))
    .filter((r): r is { response: RfqResponseView; quote: RfqResponseLineView } => r.quote !== null);

  const best = line.bestUnitCostClp;
  const bestRows = rows.filter((r) => best !== null && r.quote.unitCostClp === best);
  const fastest = rows.reduce<{ response: RfqResponseView; quote: RfqResponseLineView } | null>(
    (acc, r) => {
      if (r.response.leadTimeDays === null) return acc;
      if (!acc || acc.response.leadTimeDays === null) return r;
      return r.response.leadTimeDays < acc.response.leadTimeDays ? r : acc;
    },
    null
  );

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-200">
        <div className="min-w-0">
          <span className="text-xs font-mono text-slate-400">{line.sku}</span>
          <p className="text-sm font-medium text-slate-800 truncate">{line.skuName}</p>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0">
          Solicitado: <b className="text-slate-700">{formatNumber(line.qty ?? 0)} u.</b>
          {line.targetUnitCostClp !== null && (
            <span className="ml-2">
              objetivo <b className="text-slate-700">{formatCurrency(line.targetUnitCostClp)}</b>
            </span>
          )}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-400">Ningún proveedor cotizó esta línea.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2 text-right">Costo</th>
                <th className="px-3 py-2 text-right">Plazo</th>
                <th className="px-3 py-2 text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ response, quote }) => {
                const supplierLabel = responseSupplierLabel(detail, response);
                const isBest = bestRows.some((r) => r.response.id === response.id);
                const isFastest =
                  !!fastest &&
                  fastest.response.id === response.id &&
                  !bestRows.some((r) => r.response.id === fastest.response.id);
                return (
                  <tr
                    key={response.id}
                    className={`border-b border-slate-50 last:border-0 ${isBest ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <span className={isBest ? "font-medium text-slate-900" : "text-slate-700"}>
                        {supplierLabel}
                      </span>
                      {isBest && (
                        <Badge tone="green" className="ml-1.5">
                          Mejor precio
                        </Badge>
                      )}
                      {isFastest && (
                        <Badge tone="blue" className="ml-1.5">
                          Más rápido
                        </Badge>
                      )}
                      {quote.comment && (
                        <p className="text-xs text-slate-400 mt-0.5">{quote.comment}</p>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right whitespace-nowrap ${isBest ? "font-semibold text-emerald-700" : "text-slate-700"}`}
                    >
                      {quote.unitCostClp !== null ? formatCurrency(quote.unitCostClp) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">
                      {response.leadTimeDays !== null ? formatDays(response.leadTimeDays) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">
                      {quote.minQty !== null ? `${formatNumber(quote.minQty)} u.` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Ofertas recibidas: condiciones globales por proveedor y selección para
//  adjudicar (radio) cuando la máquina y el permiso lo permiten.
// ----------------------------------------------------------------------------

function ResponsesSection({
  detail,
  selectable,
  selectedResponseId,
  onSelect,
}: {
  detail: RfqDetailView;
  selectable: boolean;
  selectedResponseId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
        Ofertas recibidas
        {selectable && (
          <span className="ml-1 normal-case font-normal text-slate-400">
            — elige una para adjudicar
          </span>
        )}
      </p>
      <div className="space-y-2">
        {detail.responses.map((response) => {
          const label = responseSupplierLabel(detail, response);
          const total = responseTotalClp(detail, response);
          const isAwarded = detail.awardedResponseId === response.id;
          const selected = selectedResponseId === response.id;
          const conditions = [
            response.leadTimeDays !== null ? `plazo ${formatDays(response.leadTimeDays)}` : null,
            response.validUntil ? `válida hasta ${fmtIso(response.validUntil)}` : null,
            response.paymentTermRef ? `pago ${response.paymentTermRef}` : null,
          ].filter((c): c is string => c !== null);
          const content = (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {label}
                    {isAwarded && (
                      <Badge tone="green" className="ml-1.5">
                        Adjudicada
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    recibida {fmtIso(response.receivedAt)}
                    {conditions.length > 0 && ` · ${conditions.join(" · ")}`}
                  </p>
                  {response.notes && (
                    <p className="text-xs text-slate-400 mt-0.5">{response.notes}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {total !== null ? formatCurrency(total) : "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {response.lines.length} línea{response.lines.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </>
          );

          if (!selectable) {
            return (
              <div
                key={response.id}
                className={`rounded-lg border px-3 py-2 ${isAwarded ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200"}`}
              >
                {content}
              </div>
            );
          }

          return (
            <label
              key={response.id}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                selected
                  ? "border-brand-400 bg-brand-50/50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="rfq-award-response"
                className="mt-1 accent-brand-600"
                checked={selected}
                onChange={() => onSelect(response.id)}
              />
              <div className="flex-1 min-w-0">{content}</div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
//  Modal "Registrar respuesta": oferta de UN proveedor invitado pendiente —
//  precios por línea (solo las líneas con costo se envían) + condiciones.
// ============================================================================

interface ResponseLineDraft {
  unitCost: string;
  minQty: string;
  comment: string;
}

function RegisterResponseModal({
  detail,
  busy,
  onClose,
  onSubmit,
}: {
  detail: RfqDetailView;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: CreateRfqResponseBody) => Promise<boolean>;
}) {
  const pending = detail.suppliers.filter((s) => s.respondedAt === null);
  const [supplierRef, setSupplierRef] = useState(pending[0]?.supplierRef ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [paymentTermRef, setPaymentTermRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Record<string, ResponseLineDraft>>(() =>
    Object.fromEntries(
      detail.lines.map((line) => [line.id, { unitCost: "", minQty: "", comment: "" }])
    )
  );

  const setLine = (lineId: string, patch: Partial<ResponseLineDraft>) =>
    setLines((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));

  const quotedLines = detail.lines
    .map((line) => {
      const draft = lines[line.id];
      const unitCost = Math.round(Number(draft.unitCost));
      if (!draft.unitCost.trim() || !Number.isFinite(unitCost) || unitCost < 1) return null;
      const minQty = Math.round(Number(draft.minQty));
      const body: { rfqLineId: string; unitCostClp: number; minQty?: number; comment?: string } = {
        rfqLineId: line.id,
        unitCostClp: unitCost,
      };
      if (draft.minQty.trim() && Number.isFinite(minQty) && minQty >= 1) body.minQty = minQty;
      if (draft.comment.trim()) body.comment = draft.comment.trim();
      return body;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const canSubmit = supplierRef !== "" && quotedLines.length > 0 && !busy;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const lead = Math.round(Number(leadTimeDays));
    const body: CreateRfqResponseBody = {
      supplierRef,
      lines: quotedLines,
      ...(validUntil ? { validUntil } : {}),
      ...(paymentTermRef.trim() ? { paymentTermRef: paymentTermRef.trim() } : {}),
      ...(leadTimeDays.trim() && Number.isFinite(lead) && lead >= 0
        ? { leadTimeDays: lead }
        : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    void onSubmit(body);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Registrar respuesta · ${detail.number}`}
      description="Ingresa la oferta recibida de un proveedor invitado: costo por línea (deja en blanco las líneas que no cotizó) y sus condiciones."
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {busy ? "Registrando…" : "Registrar respuesta"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Proveedor que responde"
          value={supplierRef}
          onChange={(e) => setSupplierRef(e.target.value)}
          options={pending.map((s) => ({
            value: s.supplierRef,
            label: s.supplierName ? `${s.supplierName} (${s.supplierRef})` : s.supplierRef,
          }))}
        />

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">Precios por línea</p>
          <div className="space-y-2">
            {detail.lines.map((line) => {
              const draft = lines[line.id];
              return (
                <div key={line.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-slate-400">{line.sku}</span>
                      <p className="text-sm text-slate-700 truncate">{line.skuName}</p>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {formatNumber(line.qty ?? 0)} u.
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      label="Costo unitario (CLP)"
                      type="number"
                      min={1}
                      placeholder="Sin oferta"
                      value={draft.unitCost}
                      onChange={(e) => setLine(line.id, { unitCost: e.target.value })}
                    />
                    <Input
                      label="Mínimo de compra (opcional)"
                      type="number"
                      min={1}
                      placeholder="—"
                      value={draft.minQty}
                      onChange={(e) => setLine(line.id, { minQty: e.target.value })}
                    />
                  </div>
                  <div className="mt-2">
                    <Input
                      label="Comentario (opcional)"
                      placeholder="Ej. precio por volumen"
                      value={draft.comment}
                      onChange={(e) => setLine(line.id, { comment: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {quotedLines.length === 0 && (
            <p className="mt-1.5 text-xs text-amber-600">
              Ingresa el costo de al menos una línea para registrar la respuesta.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Plazo de entrega (días)"
            type="number"
            min={0}
            placeholder="—"
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(e.target.value)}
          />
          <Input
            label="Oferta válida hasta"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <Input
          label="Condición de pago (opcional)"
          placeholder="Ej. 30 días"
          value={paymentTermRef}
          onChange={(e) => setPaymentTermRef(e.target.value)}
        />
        <Input
          label="Notas (opcional)"
          placeholder="Observaciones del proveedor"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
//  Modal de cancelación con motivo (obligatorio para el dominio, auditable).
// ----------------------------------------------------------------------------

function CancelRfqModal({
  rfq,
  busy,
  onClose,
  onConfirm,
}: {
  rfq: RfqDetailView;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancelar ${rfq.number}`}
      description="La cotización quedará cancelada y no admitirá más respuestas ni adjudicación."
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Volver
          </Button>
          <Button
            variant="danger"
            disabled={busy || !reason.trim()}
            onClick={() => void onConfirm(reason.trim())}
          >
            {busy ? "Cancelando…" : "Cancelar cotización"}
          </Button>
        </>
      }
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Motivo de la cancelación (obligatorio)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          placeholder="Ej. la necesidad se cubrió con stock de otra bodega…"
        />
      </div>
    </Modal>
  );
}

// ============================================================================
//  Modal de creación: título, vencimiento, líneas (SKU + cantidad) y
//  proveedores invitados. Fuente de los selectores: recomendaciones reales del
//  motor de reposición (SKUs y supplierRefs que el front ya conoce), con
//  entrada libre de SKU y de proveedor SUP-xxx (formato validado) como
//  respaldo si el motor degrada.
// ============================================================================

interface DraftLine {
  sku: string;
  name: string;
  qty: string;
}

const DEFAULT_DUE_DAYS = 14;

function defaultDueDate(): string {
  const d = new Date(`${TODAY_ISO}T00:00:00`);
  d.setDate(d.getDate() + DEFAULT_DUE_DAYS);
  return d.toISOString().slice(0, 10);
}

function CreateRfqModal({
  open,
  onClose,
  onCreate,
  skuOptions,
  supplierOptions,
  pickerLoading,
  pickerDegraded,
  ensurePicker,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (body: CreateRfqBody) => Promise<boolean>;
  skuOptions: RfqSkuOption[];
  supplierOptions: RfqSupplierOption[];
  pickerLoading: boolean;
  pickerDegraded: boolean;
  ensurePicker: () => void;
}) {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLinesState] = useState<DraftLine[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [freeSupplier, setFreeSupplier] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [saving, setSaving] = useState(false);

  // Carga perezosa de los selectores (recomendaciones) al abrir el modal.
  useEffect(() => {
    if (open) ensurePicker();
  }, [open, ensurePicker]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? skuOptions.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q))
      : skuOptions;
    return base.slice(0, 8);
  }, [search, skuOptions]);

  const freeSkuCandidate = useMemo(() => {
    const q = search.trim();
    if (!q || q.length < 3) return null;
    const exists =
      skuOptions.some((p) => p.sku.toLowerCase() === q.toLowerCase()) ||
      lines.some((l) => l.sku.toLowerCase() === q.toLowerCase());
    return exists ? null : q.toUpperCase();
  }, [search, skuOptions, lines]);

  const reset = () => {
    setTitle("");
    setSearch("");
    setLinesState([]);
    setSelectedSuppliers([]);
    setFreeSupplier("");
    setDueDate(defaultDueDate());
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggleSku = (option: RfqSkuOption) =>
    setLinesState((prev) => {
      if (prev.some((l) => l.sku === option.sku)) return prev.filter((l) => l.sku !== option.sku);
      return [...prev, { sku: option.sku, name: option.name, qty: String(option.suggestedQty) }];
    });

  const addFreeSku = () => {
    if (!freeSkuCandidate) return;
    setLinesState((prev) => [...prev, { sku: freeSkuCandidate, name: freeSkuCandidate, qty: "1" }]);
    setSearch("");
  };

  const setQty = (sku: string, qty: string) =>
    setLinesState((prev) => prev.map((l) => (l.sku === sku ? { ...l, qty } : l)));

  const removeLine = (sku: string) => setLinesState((prev) => prev.filter((l) => l.sku !== sku));

  const toggleSupplier = (ref: string) =>
    setSelectedSuppliers((prev) =>
      prev.includes(ref) ? prev.filter((x) => x !== ref) : [...prev, ref]
    );

  const addFreeSupplier = () => {
    const ref = freeSupplier.trim().toUpperCase();
    if (!isValidSupplierRef(ref) || selectedSuppliers.includes(ref)) return;
    setSelectedSuppliers((prev) => [...prev, ref]);
    setFreeSupplier("");
  };

  const freeSupplierValid = isValidSupplierRef(freeSupplier.trim());
  const linesValid =
    lines.length > 0 && lines.every((l) => Number.isFinite(Number(l.qty)) && Number(l.qty) > 0);
  const canSave = title.trim().length > 0 && linesValid && selectedSuppliers.length > 0 && !saving;

  const supplierLabel = (ref: string) => supplierOptions.find((s) => s.ref === ref)?.name ?? ref;

  const handleSave = async () => {
    if (!canSave) return;
    const body: CreateRfqBody = {
      title: title.trim(),
      ...(dueDate ? { dueDate } : {}),
      lines: lines.map((l) => ({
        sku: l.sku,
        ...(l.name !== l.sku ? { skuName: l.name } : {}),
        qty: Number(l.qty),
      })),
      supplierRefs: selectedSuppliers,
    };
    setSaving(true);
    const ok = await onCreate(body);
    setSaving(false);
    if (ok) reset();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Nueva cotización (RFQ)"
      description="Elige los productos a cotizar y los proveedores a invitar. Se crea como borrador."
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={close}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? "Creando…" : "Crear cotización"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          label="Nombre / referencia"
          placeholder="Ej. Reposición construcción julio"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Productos a cotizar</p>
          <Input
            icon={<IconSearch className="w-4 h-4" />}
            placeholder="Buscar por SKU o nombre (recomendaciones de reposición)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto scrollbar-thin">
            {pickerLoading && (
              <p className="px-3 py-3 text-sm text-slate-400">Cargando recomendaciones…</p>
            )}
            {!pickerLoading &&
              matches.map((p) => {
                const checked = lines.some((l) => l.sku === p.sku);
                return (
                  <button
                    key={p.sku}
                    type="button"
                    onClick={() => toggleSku(p)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 ${checked ? "bg-brand-50/50" : ""}`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300"}`}
                    >
                      {checked && <IconCheck className="w-3 h-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                      <span className="block text-sm text-slate-700 truncate">{p.name}</span>
                    </span>
                  </button>
                );
              })}
            {!pickerLoading && matches.length === 0 && !freeSkuCandidate && (
              <p className="px-3 py-3 text-sm text-slate-400">
                {pickerDegraded
                  ? "No se pudieron cargar las recomendaciones; ingresa el SKU manualmente."
                  : "Sin coincidencias."}
              </p>
            )}
            {!pickerLoading && freeSkuCandidate && (
              <button
                type="button"
                onClick={addFreeSku}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand-600 hover:bg-slate-50"
              >
                <IconPlus className="w-4 h-4" />
                Agregar «{freeSkuCandidate}» como SKU libre
              </button>
            )}
          </div>

          {lines.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {lines.map((l) => {
                const qtyValid = Number.isFinite(Number(l.qty)) && Number(l.qty) > 0;
                return (
                  <div
                    key={l.sku}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono text-slate-400">{l.sku}</span>
                      <p className="text-sm text-slate-700 truncate">{l.name}</p>
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <Input
                        aria-label={`Cantidad de ${l.sku}`}
                        type="number"
                        min={1}
                        value={l.qty}
                        className={qtyValid ? "" : "border-rose-300"}
                        onChange={(e) => setQty(l.sku, e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => removeLine(l.sku)}
                      aria-label={`Quitar ${l.name}`}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <IconClose className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">Proveedores a invitar</p>
          {supplierOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {supplierOptions.map((s) => {
                const active = selectedSuppliers.includes(s.ref);
                return (
                  <button
                    key={s.ref}
                    type="button"
                    onClick={() => toggleSupplier(s.ref)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      active
                        ? "border-brand-400 bg-brand-50 text-brand-700"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {active && <IconCheck className="w-3 h-3" />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Otro proveedor por referencia (SUP-001)"
              value={freeSupplier}
              onChange={(e) => setFreeSupplier(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!freeSupplierValid}
              onClick={addFreeSupplier}
              className="flex-shrink-0"
            >
              Invitar
            </Button>
          </div>
          {freeSupplier.trim().length > 0 && !freeSupplierValid && (
            <p className="mt-1 text-xs text-amber-600">
              La referencia debe tener el formato SUP-xxx (proveedor registrado en compras).
            </p>
          )}
          {selectedSuppliers.some((ref) => !supplierOptions.some((s) => s.ref === ref)) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedSuppliers
                .filter((ref) => !supplierOptions.some((s) => s.ref === ref))
                .map((ref) => (
                  <span
                    key={ref}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 text-xs text-brand-700"
                  >
                    {supplierLabel(ref)}
                    <button onClick={() => toggleSupplier(ref)} aria-label={`Quitar ${ref}`}>
                      <IconClose className="w-3 h-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>

        <Input
          label="Fecha de vencimiento (opcional)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
    </Modal>
  );
}
