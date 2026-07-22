import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { IconBox } from "../ui/icons";
import { cn } from "../../utils/cn";
import { DOT_TONE as TONE_DOT } from "../../utils/tone";
import { SIGNAL_TYPE, SIGNAL_CHANNEL, SIGNAL_PRIORITY, suggestPriority } from "./signalLabels";
import type { SignalChannel, SignalPriority, SignalType } from "../../types/purchasing";
import type { SignalDetails } from "../../services/purchaseBff";
import type { CreateSignalInput } from "../../hooks/useSignals";

// ============================================================================
//  Captura rápida de una señal (modo vendedor) contra POST /signals.
//  Pensada para reportar en menos de 30 segundos: tipo, qué pasó y listo.
//  La evidencia y la solicitud formal son opcionales y van plegadas; viajan
//  como datos en `details` (no como estados: la máquina real solo tiene 4).
// ============================================================================

const TYPE_ORDER: SignalType[] = [
  "stockout",
  "asked_no_stock",
  "high_demand",
  "unexpected_demand",
  "restock",
  "price_error",
  "campaign",
  "liquidation",
  "low_rotation",
  "customer_suggested",
];

export interface ReportSignalDefaults {
  sku?: string;
}

interface ReportSignalModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateSignalInput) => void;
  defaults?: ReportSignalDefaults;
}

export function ReportSignalModal({ open, onClose, onSubmit, defaults }: ReportSignalModalProps) {
  const [type, setType] = useState<SignalType>("stockout");
  const [sku, setSku] = useState(defaults?.sku ?? "");

  const [channel, setChannel] = useState<SignalChannel>("store");
  const [store, setStore] = useState("Balmaceda San Javier");
  const [comment, setComment] = useState("");
  const [priority, setPriority] = useState<SignalPriority>("high");
  const [priorityTouched, setPriorityTouched] = useState(false);

  const [showEvidence, setShowEvidence] = useState(false);
  const [customersAsking, setCustomersAsking] = useState("");
  const [estimatedLostSale, setEstimatedLostSale] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");

  const [showRequest, setShowRequest] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [requestedQty, setRequestedQty] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [suggestedSupplier, setSuggestedSupplier] = useState("");

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setType("stockout");
    setSku(defaults?.sku ?? "");
    setChannel("store");
    setStore("Balmaceda San Javier");
    setComment("");
    setPriorityTouched(false);
    setShowEvidence(false);
    setCustomersAsking("");
    setEstimatedLostSale("");
    setEvidenceNote("");
    setShowRequest(false);
    setCustomerName("");
    setRequestedQty("");
    setRequiredDate("");
    setTargetPrice("");
    setSuggestedSupplier("");
  }, [open, defaults]);

  // Prioridad sugerida (recalcula salvo que el usuario la haya tocado)
  const suggestion = useMemo(
    () =>
      suggestPriority({
        type,
        customersAsking: customersAsking ? Number(customersAsking) : undefined,
      }),
    [type, customersAsking]
  );
  useEffect(() => {
    if (!priorityTouched) setPriority(suggestion.priority);
  }, [suggestion.priority, priorityTouched]);

  const storeForChannel =
    channel === "store"
      ? store
      : channel === "web"
        ? "Tienda Web"
        : channel === "marketplace"
          ? "Marketplace"
          : "Call center";

  const canSubmit = comment.trim().length > 2;

  const submit = () => {
    if (!canSubmit) return;
    const request = {
      customerName: customerName.trim() || undefined,
      requestedQty: requestedQty ? Number(requestedQty) : undefined,
      requiredDate: requiredDate || undefined,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      suggestedSupplier: suggestedSupplier.trim() || undefined,
    };
    const hasRequest = Object.values(request).some((v) => v !== undefined);
    const details: SignalDetails = {
      channel,
      recommendedAction: SIGNAL_TYPE[type].hint,
      customersAsking: customersAsking ? Number(customersAsking) : undefined,
      estimatedLostSale: estimatedLostSale ? Number(estimatedLostSale) : undefined,
      evidenceNote: evidenceNote.trim() || undefined,
      request: hasRequest ? request : undefined,
    };
    onSubmit({
      kind: type,
      body: comment.trim(),
      sku: sku.trim() || undefined,
      storeRef: storeForChannel,
      priority,
      details,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reportar señal de ventas"
      description="Avisa al comprador lo que estás viendo en el terreno. Toma menos de 30 segundos."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="text-xs text-slate-500 hidden sm:block">
            {SIGNAL_TYPE[type].label} · {SIGNAL_PRIORITY[priority].label}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              Enviar señal
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 1. Tipo de señal */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            1 · ¿Qué estás viendo?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {TYPE_ORDER.map((t) => {
              const meta = SIGNAL_TYPE[t];
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setPriorityTouched(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    active
                      ? "border-brand-400 bg-brand-50 text-brand-800 ring-1 ring-brand-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", TONE_DOT[meta.tone])} />
                  <span className="truncate">{meta.short}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">{SIGNAL_TYPE[type].hint}.</p>
        </div>

        {/* 2. Producto (SKU opcional: puede ser algo que no está en el surtido) */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            2 · Producto
          </p>
          <Input
            placeholder="SKU (opcional; déjalo vacío si el producto no está en el surtido)"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            icon={<IconBox className="w-4 h-4" />}
          />
        </div>

        {/* 3. Origen + prioridad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Canal
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as SignalChannel)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {(Object.keys(SIGNAL_CHANNEL) as SignalChannel[]).map((c) => (
                <option key={c} value={c}>
                  {SIGNAL_CHANNEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {channel === "store" ? "Tienda" : "Punto"}
            </label>
            {channel === "store" ? (
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option>Balmaceda San Javier</option>
                <option>Chorrillos San Javier</option>
              </select>
            ) : (
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {storeForChannel}
              </div>
            )}
          </div>
        </div>

        {/* Prioridad sugerida */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Prioridad
            </label>
            <span className="text-[11px] text-slate-400">Sugerida automáticamente</span>
          </div>
          <div className="flex gap-1.5">
            {(["high", "medium", "low"] as SignalPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPriority(p);
                  setPriorityTouched(true);
                }}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  priority === p
                    ? p === "high"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : p === "medium"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-slate-300 bg-slate-100 text-slate-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                {SIGNAL_PRIORITY[p].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">{suggestion.reason}</p>
        </div>

        {/* 4. Comentario */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            ¿Qué pasó? <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Ej: Vinieron 4 clientes buscando este producto y no había stock."
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {/* Evidencia opcional */}
        <div>
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            {showEvidence ? "− Ocultar evidencia" : "+ Agregar evidencia (opcional)"}
          </button>
          {showEvidence && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="number"
                min={0}
                label="Clientes que preguntaron"
                placeholder="0"
                value={customersAsking}
                onChange={(e) => setCustomersAsking(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                label="Venta perdida estimada (CLP)"
                placeholder="0"
                value={estimatedLostSale}
                onChange={(e) => setEstimatedLostSale(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Nota / link / foto"
                  placeholder="Ej: Foto enviada al grupo de la tienda"
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Solicitud formal opcional (cliente, cantidad, fecha, precio, proveedor) */}
        <div>
          <button
            type="button"
            onClick={() => setShowRequest((v) => !v)}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            {showRequest ? "− Ocultar solicitud de compra" : "+ Solicitud de compra (opcional)"}
          </button>
          {showRequest && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Cliente"
                placeholder="Ej: Constructora Andes"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                label="Cantidad requerida"
                placeholder="0"
                value={requestedQty}
                onChange={(e) => setRequestedQty(e.target.value)}
              />
              <Input
                type="date"
                label="Fecha requerida"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                label="Precio objetivo (CLP)"
                placeholder="0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Proveedor sugerido"
                  placeholder="Opcional"
                  value={suggestedSupplier}
                  onChange={(e) => setSuggestedSupplier(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* La señal queda a nombre del usuario de la sesión */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-500">Se reporta con tu usuario de la sesión</span>
          <Badge tone="blue" className="ml-auto">
            Modo vendedor
          </Badge>
        </div>
      </div>
    </Modal>
  );
}
