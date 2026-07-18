import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import {
  IconChat,
  IconCheck,
  IconClose,
  IconChevronRight,
  IconArrowRight,
} from "../ui/icons";
import { cn } from "../../utils/cn";
import { formatCurrency, formatNumber, formatPercent } from "../../utils/formatters";
import { productPath } from "../../utils/entityLinks";
import {
  SIGNAL_STATUS,
  SIGNAL_PRIORITY,
  signalChannelLabel,
  signalKindMeta,
} from "./signalLabels";
import { useSignals } from "../../context/SignalsContext";
import { useSignalDetail } from "../../hooks/useSignals";
import { useToast } from "../../context/ToastContext";
import {
  describePurchaseBffError,
  type PurchaseBffError,
  type SignalBffPriority,
  type SignalDetailData,
} from "../../services/purchaseBff";

// ============================================================================
//  Detalle de una señal real (GET /signals/:id): cuerpo, evidencia, solicitud
//  formal, bloque de apoyo del motor, hilo vendedor ↔ comprador y acciones de
//  la máquina new → in_review → actioned | dismissed. Los estados terminales
//  cierran la señal y dejan el hilo de solo lectura.
// ============================================================================

// Fecha/hora locales (los formatters base sólo manejan fechas sin hora).
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function fmtDateTime(iso: string): string {
  const time = iso.slice(11, 16);
  return time ? `${fmtDate(iso)} · ${time}` : fmtDate(iso);
}

export function SignalDetail({ id, onMutated }: { id: string; onMutated?: () => void }) {
  const { detail, loading, error, refetch } = useSignalDetail(id);
  const { transition, setPriority, comment } = useSignals();
  const toast = useToast();

  const [dismissing, setDismissing] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [actioning, setActioning] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // Cierra los paneles de confirmación y refresca detalle + bandeja.
  const afterCommand = () => {
    setDismissing(false);
    setDismissReason("");
    setActioning(false);
    setActionNote("");
    refetch();
    onMutated?.();
  };

  const handleCommandError = (info: PurchaseBffError) => {
    if (info.code === "VERSION_CONFLICT") {
      toast.warning("La señal cambió en otra sesión; se recargaron los datos");
      refetch();
      onMutated?.();
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };

  const takeInReview = async () => {
    if (!detail || busy) return;
    setBusy(true);
    const result = await transition(detail.id, detail.version, "in_review");
    setBusy(false);
    if (result.ok) {
      toast.success("Señal en revisión (asignada a ti)");
      afterCommand();
    } else handleCommandError(result.error);
  };

  const confirmDismiss = async () => {
    if (!detail || busy || dismissReason.trim().length < 3) return;
    setBusy(true);
    const result = await transition(detail.id, detail.version, "dismissed", dismissReason.trim());
    setBusy(false);
    if (result.ok) {
      toast.info("Señal descartada con motivo");
      afterCommand();
    } else handleCommandError(result.error);
  };

  const confirmAction = async () => {
    if (!detail || busy) return;
    setBusy(true);
    const result = await transition(
      detail.id,
      detail.version,
      "actioned",
      actionNote.trim() || undefined
    );
    setBusy(false);
    if (result.ok) {
      toast.success("Señal marcada como accionada");
      afterCommand();
    } else handleCommandError(result.error);
  };

  const changePriority = async (priority: SignalBffPriority) => {
    if (!detail || busy || priority === detail.priority) return;
    setBusy(true);
    const result = await setPriority(detail.id, detail.version, priority);
    setBusy(false);
    if (result.ok) {
      toast.success(`Prioridad cambiada a ${SIGNAL_PRIORITY[priority].label.toLowerCase()}`);
      afterCommand();
    } else handleCommandError(result.error);
  };

  const send = async () => {
    if (!detail || busy || draft.trim().length === 0) return;
    setBusy(true);
    const result = await comment(detail.id, draft.trim());
    setBusy(false);
    if (result.ok) {
      setDraft("");
      refetch();
      onMutated?.();
    } else {
      toast.error(describePurchaseBffError(result.error));
    }
  };

  if (loading && !detail) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4" aria-busy="true">
        <div className="space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-800">No se pudo cargar la señal</p>
        <p className="mt-1 text-sm text-slate-500">{error.message}</p>
        <Button className="mt-4" size="sm" onClick={refetch}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!detail) return null;

  return <SignalDetailBody detail={detail} busy={busy} panels={{
    dismissing, setDismissing, dismissReason, setDismissReason, confirmDismiss,
    actioning, setActioning, actionNote, setActionNote, confirmAction,
    takeInReview, changePriority, draft, setDraft, send,
  }} />;
}

interface DetailPanels {
  dismissing: boolean;
  setDismissing: (v: boolean) => void;
  dismissReason: string;
  setDismissReason: (v: string) => void;
  confirmDismiss: () => void;
  actioning: boolean;
  setActioning: (v: boolean) => void;
  actionNote: string;
  setActionNote: (v: string) => void;
  confirmAction: () => void;
  takeInReview: () => void;
  changePriority: (p: SignalBffPriority) => void;
  draft: string;
  setDraft: (v: string) => void;
  send: () => void;
}

function SignalDetailBody({
  detail,
  busy,
  panels,
}: {
  detail: SignalDetailData;
  busy: boolean;
  panels: DetailPanels;
}) {
  const meta = signalKindMeta(detail.kind);
  const status = SIGNAL_STATUS[detail.status];
  const isTerminal = detail.status === "actioned" || detail.status === "dismissed";
  const details = detail.details;
  const request = details?.request;
  const support = detail.support;
  const channel = signalChannelLabel(details?.channel);
  const title = support?.skuName ?? detail.sku ?? meta.label;

  // Margen esperado si la solicitud trae precio objetivo y costo cotizado.
  const expectedMargin =
    request?.targetPrice && request?.quotedCost && request.targetPrice > 0
      ? ((request.targetPrice - request.quotedCost) / request.targetPrice) * 100
      : null;
  const hasRequestData =
    request &&
    (request.customerName ||
      request.requestedQty != null ||
      request.requiredDate ||
      request.targetPrice != null ||
      request.suggestedSupplier ||
      request.quotedCost != null);

  const num = (v: number | null | undefined) => (v == null ? "—" : formatNumber(v));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="p-4 lg:max-h-[74vh] lg:overflow-y-auto no-scrollbar">
        {/* Cabecera */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          <span
            className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded px-1.5 py-0.5"
            title="Reportada desde el terreno por el equipo de ventas (no es una alerta automática del sistema)"
          >
            Terreno
          </span>
          <Badge tone={SIGNAL_PRIORITY[detail.priority].tone}>
            Prioridad {SIGNAL_PRIORITY[detail.priority].label.toLowerCase()}
          </Badge>
          <div className="flex-1" />
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        <div className="min-w-0">
          {detail.sku ? (
            <Link
              to={productPath(detail.sku)}
              className="text-lg font-semibold text-brand-700 hover:underline"
            >
              {title}
            </Link>
          ) : (
            <h3 className="text-lg font-semibold text-slate-900">
              {title}
              <Badge tone="green" className="ml-2 align-middle">
                Sin SKU
              </Badge>
            </h3>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            {[
              detail.sku,
              channel,
              detail.storeRef,
              detail.assignedBuyerId ? `Comprador: ${detail.assignedBuyerId}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Sin origen registrado"}
          </p>
        </div>

        {/* Motivo del reporte */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">
              Reportado por {detail.reporterName ?? detail.reporterUserId}
            </p>
            <span className="text-xs text-slate-400">{fmtDateTime(detail.dateCreated)}</span>
          </div>
          <p className="text-sm text-slate-700 mt-1">{detail.body}</p>
        </div>

        {/* Solicitud formal (datos, no estados: la gestión se conversa en el hilo) */}
        {hasRequestData && request && (
          <div className="mt-3 rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Solicitud de compra
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {request.customerName && <ReqField label="Cliente" value={request.customerName} />}
              {request.requestedQty != null && (
                <ReqField label="Cantidad" value={`${formatNumber(request.requestedQty)} u.`} />
              )}
              {request.requiredDate && (
                <ReqField label="Fecha requerida" value={fmtDate(request.requiredDate)} />
              )}
              {request.targetPrice != null && (
                <ReqField label="Precio objetivo" value={formatCurrency(request.targetPrice)} />
              )}
              {request.suggestedSupplier && (
                <ReqField label="Proveedor sugerido" value={request.suggestedSupplier} />
              )}
              {request.quotedCost != null && (
                <ReqField label="Costo cotizado" value={formatCurrency(request.quotedCost)} />
              )}
              {expectedMargin != null && (
                <ReqField
                  label="Margen esperado"
                  value={formatPercent(expectedMargin, 0)}
                  tone={expectedMargin < 20 ? "bad" : "good"}
                />
              )}
            </div>
          </div>
        )}

        {/* Evidencia */}
        {(details?.customersAsking || details?.estimatedLostSale || details?.evidenceNote) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {details.customersAsking ? (
              <Badge tone="blue">
                {details.customersAsking} cliente
                {details.customersAsking === 1 ? "" : "s"} preguntó
              </Badge>
            ) : null}
            {details.estimatedLostSale ? (
              <Badge tone="red">Venta perdida ~{formatCurrency(details.estimatedLostSale)}</Badge>
            ) : null}
            {details.evidenceNote ? <Badge tone="neutral">{details.evidenceNote}</Badge> : null}
          </div>
        )}

        {/* Acción recomendada por ventas */}
        {details?.recommendedAction && (
          <div className="mt-3 rounded-lg bg-brand-50/70 border border-brand-100 px-3 py-2.5">
            <p className="text-xs font-medium text-brand-700">Acción recomendada por ventas</p>
            <p className="text-sm text-slate-700 mt-0.5">{details.recommendedAction}</p>
          </div>
        )}

        {/* Datos de apoyo reales (motor + stock vivo, degradable) */}
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Datos de apoyo para decidir
            </p>
            {support?.stockFromSnapshot && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-1.5 py-0.5"
                title="El feed de stock en vivo no respondió: se muestra el snapshot del motor de reposición"
              >
                Snapshot del motor
              </span>
            )}
          </div>
          {support ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label="Stock disp."
                  value={num(support.stockAvailable)}
                  tone={
                    support.stockAvailable != null && support.stockAvailable <= 0
                      ? "bad"
                      : "neutral"
                  }
                />
                <Stat label="En tránsito" value={num(support.stockInTransit)} />
                <Stat
                  label="Velocidad diaria"
                  value={support.dailyVelocity == null ? "—" : formatNumber(support.dailyVelocity)}
                />
                <Stat
                  label="Cobertura"
                  value={support.coverageDays == null ? "—" : `${formatNumber(support.coverageDays)} d`}
                  tone={
                    support.coverageDays != null && support.coverageDays <= 7 ? "warn" : "neutral"
                  }
                />
                <Stat label="Venta 30d" value={num(support.salesLast30d)} />
                <Stat
                  label="Margen"
                  value={support.marginPct == null ? "—" : formatPercent(support.marginPct, 0)}
                />
                <Stat
                  label="Rotación"
                  value={support.rotation == null ? "—" : `${formatNumber(support.rotation)}x`}
                />
                <Stat
                  label="Costo unitario"
                  value={support.unitCostClp == null ? "—" : formatCurrency(support.unitCostClp)}
                />
                <Stat label="Proveedor" value={support.supplierName ?? support.supplierId ?? "—"} />
              </div>
              {detail.sku && (
                <Link
                  to={productPath(detail.sku)}
                  className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Ver ficha completa del producto <IconChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">
              Sin datos de apoyo: la señal no tiene SKU o el catálogo no lo conoce.
            </p>
          )}
          {detail.warnings && detail.warnings.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {detail.warnings.map((w) => (
                <li key={`${w.scope}-${w.code}`} className="text-xs text-amber-700">
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resolución (estados terminales) */}
        {isTerminal && detail.resolution && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-500">
              {detail.status === "dismissed" ? "Motivo del descarte" : "Nota de la resolución"}
            </p>
            <p className="text-sm text-slate-700 mt-0.5">{detail.resolution}</p>
          </div>
        )}

        {/* Toolbar de decisión según la máquina real */}
        {panels.dismissing ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
            <p className="text-sm font-medium text-slate-700 mb-1.5">
              ¿Por qué descartas esta señal? El motivo queda registrado.
            </p>
            <textarea
              value={panels.dismissReason}
              onChange={(e) => panels.setDismissReason(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Ej: Producto estacional, repunta en agosto."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="danger"
                onClick={panels.confirmDismiss}
                disabled={busy || panels.dismissReason.trim().length < 3}
              >
                Confirmar descarte
              </Button>
              <Button size="sm" variant="secondary" onClick={() => panels.setDismissing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : panels.actioning ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-sm font-medium text-slate-700 mb-1.5">
              Marcar como accionada: ¿qué se hizo con la señal? (opcional)
            </p>
            <textarea
              value={panels.actionNote}
              onChange={(e) => panels.setActionNote(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Ej: Agregada a la OC del proveedor; llega la próxima semana."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={panels.confirmAction} disabled={busy}>
                Confirmar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => panels.setActioning(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          !isTerminal && (
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.status === "new" && (
                <Button
                  size="sm"
                  icon={<IconCheck className="w-4 h-4" />}
                  onClick={panels.takeInReview}
                  disabled={busy}
                >
                  Tomar en revisión
                </Button>
              )}
              {detail.status === "in_review" && (
                <Button
                  size="sm"
                  icon={<IconCheck className="w-4 h-4" />}
                  onClick={() => panels.setActioning(true)}
                  disabled={busy}
                >
                  Marcar accionada…
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon={<IconClose className="w-4 h-4" />}
                onClick={() => panels.setDismissing(true)}
                disabled={busy}
              >
                Descartar…
              </Button>
              {detail.status === "in_review" && (
                <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                  Prioridad
                  <select
                    value={detail.priority}
                    onChange={(e) => panels.changePriority(e.target.value as SignalBffPriority)}
                    disabled={busy}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
                  >
                    {(["high", "medium", "low"] as SignalBffPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {SIGNAL_PRIORITY[p].label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )
        )}

        {/* Conversación comprador ↔ vendedor */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">
            <IconChat className="w-3.5 h-3.5" /> Conversación con ventas
          </p>
          <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar pr-1">
            {detail.messages.length === 0 ? (
              <p className="text-xs text-slate-400">
                Aún no hay mensajes. Escríbele al vendedor para coordinar.
              </p>
            ) : (
              detail.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    m.role === "buyer" ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-1.5 text-sm",
                      m.role === "buyer"
                        ? "bg-brand-600 text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-700 rounded-bl-sm"
                    )}
                  >
                    {m.body}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                    {m.authorName ?? m.authorUserId} · {fmtDateTime(m.dateCreated)}
                  </span>
                </div>
              ))
            )}
          </div>
          {isTerminal ? (
            <p className="mt-2 text-xs text-slate-400">
              La señal está cerrada: el hilo quedó de solo lectura.
            </p>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={panels.draft}
                onChange={(e) => panels.setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") panels.send();
                }}
                placeholder="Responder al vendedor…"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <Button
                size="sm"
                onClick={panels.send}
                disabled={busy || !panels.draft.trim()}
                icon={<IconArrowRight className="w-4 h-4" />}
              >
                Enviar
              </Button>
            </div>
          )}
        </div>

        {/* Historial derivable de datos reales (sin eventos inventados) */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Historial
          </p>
          <ol className="space-y-2.5 border-l border-slate-200 pl-3">
            {detail.status !== "new" && (
              <li className="relative">
                <span className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-slate-300" />
                <p className="text-sm text-slate-700">
                  {status.label}
                  {detail.resolution ? ` — ${detail.resolution}` : ""}
                </p>
                <p className="text-[11px] text-slate-400">{fmtDateTime(detail.dateModified)}</p>
              </li>
            )}
            <li className="relative">
              <span className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-slate-300" />
              <p className="text-sm text-slate-700">
                Reportada por {detail.reporterName ?? detail.reporterUserId}
                {detail.storeRef ? ` desde ${detail.storeRef}` : ""}
              </p>
              <p className="text-[11px] text-slate-400">{fmtDateTime(detail.dateCreated)}</p>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function ReqField({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const c =
    tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-700" : "text-slate-800";
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={cn("text-sm font-medium", c)}>{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "bad" | "warn";
}) {
  const toneClass = {
    neutral: "text-slate-800",
    bad: "text-rose-600",
    warn: "text-amber-600",
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 px-2.5 py-2">
      <p className={cn("text-base font-semibold leading-none truncate", toneClass)}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-1 leading-tight">{label}</p>
    </div>
  );
}
