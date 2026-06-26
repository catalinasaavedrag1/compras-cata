import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MoreActions } from "../ui/MoreActions";
import {
  IconChat,
  IconCart,
  IconCheck,
  IconClose,
  IconChevronRight,
  IconBox,
  IconSales,
  IconArrowRight,
} from "../ui/icons";
import { cn } from "../../utils/cn";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import {
  SIGNAL_TYPE,
  SIGNAL_STATUS,
  SIGNAL_PRIORITY,
  SIGNAL_CHANNEL,
} from "./signalLabels";
import { useSignals } from "../../context/SignalsContext";
import { useBuyer } from "../../context/BuyerContext";
import { useOcDraft } from "../../context/OcDraftContext";
import { useToast } from "../../context/ToastContext";
import { recommendationService, productService } from "../../services";
import type { SalesSignal } from "../../types/purchasing";

// Fecha/hora locales (los formatters base sólo manejan fechas sin hora).
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function fmtDateTime(iso: string): string {
  const time = iso.slice(11, 16);
  return time ? `${fmtDate(iso)} · ${time}` : fmtDate(iso);
}

export function SignalDetail({ signal }: { signal: SalesSignal }) {
  const navigate = useNavigate();
  const { buyer, buyers } = useBuyer();
  const { addItem, hasItem } = useOcDraft();
  const { setStatus, assign, reject, addMessage, markConverted, updateRequest } = useSignals();
  const toast = useToast();

  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editReq, setEditReq] = useState(false);
  const [reqDraft, setReqDraft] = useState({
    customerName: signal.customerName ?? "",
    requestedQty: signal.requestedQty ? String(signal.requestedQty) : "",
    requiredDate: signal.requiredDate ?? "",
    targetPrice: signal.targetPrice ? String(signal.targetPrice) : "",
    suggestedSupplier: signal.suggestedSupplier ?? "",
    quotedCost: signal.quotedCost ? String(signal.quotedCost) : "",
  });
  const saveReq = () => {
    updateRequest(signal.id, {
      customerName: reqDraft.customerName.trim() || undefined,
      requestedQty: reqDraft.requestedQty ? Number(reqDraft.requestedQty) : undefined,
      requiredDate: reqDraft.requiredDate || undefined,
      targetPrice: reqDraft.targetPrice ? Number(reqDraft.targetPrice) : undefined,
      suggestedSupplier: reqDraft.suggestedSupplier.trim() || undefined,
      quotedCost: reqDraft.quotedCost ? Number(reqDraft.quotedCost) : undefined,
    });
    setEditReq(false);
    toast.success("Solicitud actualizada");
  };

  // Margen esperado si hay precio objetivo y costo cotizado
  const expectedMargin =
    signal.targetPrice && signal.quotedCost && signal.targetPrice > 0
      ? ((signal.targetPrice - signal.quotedCost) / signal.targetPrice) * 100
      : null;
  const hasRequestData =
    signal.customerName || signal.requestedQty || signal.requiredDate || signal.targetPrice || signal.suggestedSupplier || signal.quotedCost;

  const meta = SIGNAL_TYPE[signal.type];
  const status = SIGNAL_STATUS[signal.status];
  const isOpen = signal.status !== "resolved" && signal.status !== "rejected";

  // Construye el ítem de OC desde la recomendación o el producto.
  const rec = signal.sku ? recommendationService.getBySku(signal.sku) : undefined;
  const product = signal.sku ? productService.getBySku(signal.sku) : undefined;
  const ocItem =
    rec && rec.suggestedQuantity > 0
      ? {
          sku: rec.sku,
          productName: rec.productName,
          supplierName: rec.supplierName,
          quantity: rec.suggestedQuantity,
          unitCost: rec.unitCost,
        }
      : product
        ? {
            sku: product.sku,
            productName: product.name,
            supplierName: product.supplierName,
            quantity: Math.max(
              1,
              product.maxStock - product.totalStock > 0
                ? product.maxStock - product.totalStock
                : Math.round(product.salesLast30Days * 1.5) || 10
            ),
            unitCost: product.cost,
          }
        : undefined;
  const alreadyInOc = ocItem ? hasItem(ocItem.sku) : false;

  const convert = () => {
    if (!ocItem) return;
    addItem(ocItem);
    markConverted(
      signal.id,
      `Convertida en tarea de compra: ${formatNumber(ocItem.quantity)} u. de ${ocItem.productName}`
    );
    toast.success(`${ocItem.productName} agregado al borrador de OC`, {
      label: "Ver borrador OC",
      onClick: () => navigate("/ordenes-compra"),
    });
  };

  // Flujo de la solicitud: solicitado → en revisión → consultando proveedor →
  // cotizado → esperando cliente → aprobado → comprado → resuelto.
  const STEP: Partial<Record<SalesSignal["status"], { to: SalesSignal["status"]; label: string }>> = {
    new: { to: "in_review", label: "Marcar en revisión" },
    in_review: { to: "sourcing", label: "Consultar proveedor" },
    sourcing: { to: "quoted", label: "Registrar cotización" },
    quoted: { to: "awaiting_customer", label: "Esperar respuesta cliente" },
    awaiting_customer: { to: "accepted", label: "Aprobar" },
    accepted: { to: "purchased", label: "Marcar comprado" },
    purchased: { to: "resolved", label: "Marcar resuelto" },
  };
  const step = STEP[signal.status];
  const advance = () => {
    if (!step) return;
    setStatus(signal.id, step.to);
    toast.success(`Solicitud: ${SIGNAL_STATUS[step.to].label}`);
  };
  const doReject = () => {
    if (rejectReason.trim().length < 3) return;
    reject(signal.id, rejectReason.trim());
    setRejecting(false);
    setRejectReason("");
    toast.info("Señal rechazada con motivo");
  };
  const send = () => {
    if (draft.trim().length === 0) return;
    addMessage(signal.id, { role: "buyer", author: buyer, text: draft.trim() });
    setDraft("");
  };

  const moreActions = [
    ...(signal.sku
      ? [
          {
            label: "Ver historial del producto",
            icon: <IconBox className="w-4 h-4" />,
            onClick: () => navigate(`/productos/${signal.sku}`),
          },
          {
            label: "Ver ventas recientes",
            icon: <IconSales className="w-4 h-4" />,
            onClick: () => navigate(`/productos/${signal.sku}?tab=ventas`),
          },
        ]
      : []),
    {
      label: "Asignármela",
      icon: <IconCheck className="w-4 h-4" />,
      onClick: () => assign(signal.id, buyer),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="p-4 lg:max-h-[74vh] lg:overflow-y-auto no-scrollbar">
        {/* Cabecera */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          <Badge tone={SIGNAL_PRIORITY[signal.priority].tone}>
            Prioridad {SIGNAL_PRIORITY[signal.priority].label.toLowerCase()}
          </Badge>
          <div className="flex-1" />
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {signal.sku ? (
              <Link
                to={`/productos/${signal.sku}`}
                className="text-lg font-semibold text-brand-700 hover:underline"
              >
                {signal.productName}
              </Link>
            ) : (
              <h3 className="text-lg font-semibold text-slate-900">
                {signal.productName}
                <Badge tone="green" className="ml-2 align-middle">
                  Producto nuevo
                </Badge>
              </h3>
            )}
            <p className="text-xs text-slate-500 mt-0.5">
              {signal.category}
              {signal.brand ? ` · ${signal.brand}` : ""} ·{" "}
              {SIGNAL_CHANNEL[signal.channel]} · {signal.store}
            </p>
          </div>
          <MoreActions actions={moreActions} />
        </div>

        {/* Motivo del reporte */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">
              Reportado por {signal.reportedBy}
            </p>
            <span className="text-xs text-slate-400">{fmtDateTime(signal.date)}</span>
          </div>
          <p className="text-sm text-slate-700 mt-1">{signal.comment}</p>
        </div>

        {/* Solicitud de compra (datos formales) */}
        <div className="mt-3 rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Solicitud de compra</p>
            <button type="button" onClick={() => setEditReq((v) => !v)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              {editReq ? "Cancelar" : hasRequestData ? "Editar" : "Completar"}
            </button>
          </div>

          {editReq ? (
            <div className="grid grid-cols-2 gap-2">
              <ReqInput label="Cliente" value={reqDraft.customerName} onChange={(v) => setReqDraft({ ...reqDraft, customerName: v })} placeholder="Ej: Constructora Andes" />
              <ReqInput label="Cantidad" type="number" value={reqDraft.requestedQty} onChange={(v) => setReqDraft({ ...reqDraft, requestedQty: v })} placeholder="0" />
              <ReqInput label="Fecha requerida" type="date" value={reqDraft.requiredDate} onChange={(v) => setReqDraft({ ...reqDraft, requiredDate: v })} />
              <ReqInput label="Precio objetivo" type="number" value={reqDraft.targetPrice} onChange={(v) => setReqDraft({ ...reqDraft, targetPrice: v })} placeholder="CLP" />
              <ReqInput label="Proveedor sugerido" value={reqDraft.suggestedSupplier} onChange={(v) => setReqDraft({ ...reqDraft, suggestedSupplier: v })} placeholder="Opcional" />
              <ReqInput label="Costo cotizado" type="number" value={reqDraft.quotedCost} onChange={(v) => setReqDraft({ ...reqDraft, quotedCost: v })} placeholder="CLP" />
              <div className="col-span-2 flex gap-2 mt-1">
                <Button size="sm" onClick={saveReq}>Guardar</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditReq(false)}>Cancelar</Button>
              </div>
            </div>
          ) : hasRequestData ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {signal.customerName && <ReqField label="Cliente" value={signal.customerName} />}
              {signal.requestedQty != null && <ReqField label="Cantidad" value={`${formatNumber(signal.requestedQty)} u.`} />}
              {signal.requiredDate && <ReqField label="Fecha requerida" value={fmtDate(signal.requiredDate)} />}
              {signal.targetPrice != null && <ReqField label="Precio objetivo" value={formatCurrency(signal.targetPrice)} />}
              {signal.suggestedSupplier && <ReqField label="Proveedor sugerido" value={signal.suggestedSupplier} />}
              {signal.quotedCost != null && <ReqField label="Costo cotizado" value={formatCurrency(signal.quotedCost)} />}
              {expectedMargin != null && <ReqField label="Margen esperado" value={formatPercent(expectedMargin, 0)} tone={expectedMargin < 20 ? "bad" : "good"} />}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Aún sin datos formales. Completa cliente, cantidad, fecha y precio objetivo para gestionarla como solicitud de compra.</p>
          )}
        </div>

        {/* Evidencia */}
        {(signal.customersAsking ||
          signal.estimatedLostSale ||
          signal.evidenceNote) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {signal.customersAsking ? (
              <Badge tone="blue">
                {signal.customersAsking} cliente
                {signal.customersAsking === 1 ? "" : "s"} preguntó
              </Badge>
            ) : null}
            {signal.estimatedLostSale ? (
              <Badge tone="red">
                Venta perdida ~{formatCurrency(signal.estimatedLostSale)}
              </Badge>
            ) : null}
            {signal.evidenceNote ? (
              <Badge tone="neutral">{signal.evidenceNote}</Badge>
            ) : null}
          </div>
        )}

        {/* Acción recomendada por ventas */}
        {signal.recommendedAction && (
          <div className="mt-3 rounded-lg bg-brand-50/70 border border-brand-100 px-3 py-2.5">
            <p className="text-xs font-medium text-brand-700">
              Acción recomendada por ventas
            </p>
            <p className="text-sm text-slate-700 mt-0.5">
              {signal.recommendedAction}
            </p>
          </div>
        )}

        {/* Datos de apoyo simulados */}
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Datos de apoyo para decidir
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Stock disp." value={formatNumber(signal.support.stock)} tone={signal.support.stock <= 0 ? "bad" : "neutral"} />
            <Stat label="Venta 30d" value={formatNumber(signal.support.sales30)} />
            <Stat label="Rotación" value={`${formatNumber(signal.support.rotation)}x`} />
            <Stat label="Margen" value={formatPercent(signal.support.marginPct, 0)} />
            <Stat label="Quiebres 30d" value={formatNumber(signal.support.stockoutEvents30)} tone={signal.support.stockoutEvents30 > 0 ? "warn" : "neutral"} />
            <Stat
              label="Tiendas afect."
              value={formatNumber(signal.support.affectedStores.length)}
            />
          </div>
          {signal.support.affectedStores.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {signal.support.affectedStores.map((s) => (
                <span
                  key={s}
                  className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          {signal.sku && (
            <Link
              to={`/productos/${signal.sku}`}
              className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Ver ficha completa del producto{" "}
              <IconChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* Estado rechazado */}
        {signal.status === "rejected" && signal.rejectionReason && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Motivo del rechazo</p>
            <p className="text-sm text-slate-700 mt-0.5">{signal.rejectionReason}</p>
          </div>
        )}

        {/* Toolbar de decisión */}
        {rejecting ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
            <p className="text-sm font-medium text-slate-700 mb-1.5">
              ¿Por qué rechazas esta señal?
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Ej: Producto estacional, repunta en agosto."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="danger" onClick={doReject} disabled={rejectReason.trim().length < 3}>
                Confirmar rechazo
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {ocItem && (
              <Button
                size="sm"
                icon={<IconCart className="w-4 h-4" />}
                disabled={alreadyInOc}
                onClick={convert}
              >
                {alreadyInOc ? "En borrador de OC" : "Convertir en compra"}
              </Button>
            )}
            {step && isOpen && (
              <Button size="sm" variant="secondary" icon={<IconCheck className="w-4 h-4" />} onClick={advance}>
                {step.label}
              </Button>
            )}
            {isOpen && (
              <Button size="sm" variant="secondary" icon={<IconClose className="w-4 h-4" />} onClick={() => setRejecting(true)}>
                Rechazar
              </Button>
            )}
          </div>
        )}

        {/* Asignación */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Comprador asignado</span>
          <select
            value={signal.assignedBuyer ?? ""}
            onChange={(e) => assign(signal.id, e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
          >
            <option value="">Sin asignar</option>
            {buyers.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          {signal.assignedBuyer === buyer && (
            <Badge tone="violet">Para mí</Badge>
          )}
        </div>

        {/* Conversación comprador ↔ vendedor */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">
            <IconChat className="w-3.5 h-3.5" /> Conversación con ventas
          </p>
          <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar pr-1">
            {signal.messages.length === 0 ? (
              <p className="text-xs text-slate-400">
                Aún no hay mensajes. Escríbele al vendedor para coordinar.
              </p>
            ) : (
              signal.messages.map((m) => (
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
                    {m.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                    {m.author} · {fmtDateTime(m.date)}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={`Responder como ${buyer}…`}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <Button size="sm" onClick={send} disabled={!draft.trim()} icon={<IconArrowRight className="w-4 h-4" />}>
              Enviar
            </Button>
          </div>
        </div>

        {/* Historial / trazabilidad */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
          >
            {showHistory ? "− Ocultar" : "+ Ver"} historial ({signal.timeline.length})
          </button>
          {showHistory && (
            <ol className="mt-2 space-y-2.5 border-l border-slate-200 pl-3">
              {[...signal.timeline]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-slate-300" />
                    <p className="text-sm text-slate-700">{ev.text}</p>
                    <p className="text-[11px] text-slate-400">
                      {ev.actor} · {fmtDateTime(ev.date)}
                    </p>
                  </li>
                ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function ReqField({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const c = tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-700" : "text-slate-800";
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={cn("text-sm font-medium", c)}>{value}</span>
    </div>
  );
}

function ReqInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </label>
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
      <p className={cn("text-base font-semibold leading-none", toneClass)}>
        {value}
      </p>
      <p className="text-[11px] text-slate-500 mt-1 leading-tight">{label}</p>
    </div>
  );
}
