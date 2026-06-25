import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { IconSearch, IconBox, IconBulb } from "../ui/icons";
import { productService } from "../../services";
import { cn } from "../../utils/cn";
import {
  SIGNAL_TYPE,
  SIGNAL_CHANNEL,
  SIGNAL_PRIORITY,
  suggestPriority,
} from "./signalLabels";
import type {
  SignalChannel,
  SignalPriority,
  SignalType,
} from "../../types/purchasing";
import type { NewSignalInput } from "../../context/SignalsContext";

// ============================================================================
//  Captura rápida de una señal (modo vendedor). Pensada para reportar en
//  menos de 30 segundos: primero el tipo, luego el producto, y listo.
//  La evidencia es opcional y va plegada para no alargar el formulario.
// ============================================================================

const SELLERS = [
  "Rodrigo Fuentes",
  "Camila Tapia",
  "Sebastián Reyes",
  "Paola Núñez",
  "Diego Carrasco",
  "Valentina Soto",
];

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

const TONE_DOT: Record<string, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
  slate: "bg-slate-400",
  neutral: "bg-slate-400",
};

export interface ReportSignalDefaults {
  sku?: string;
  productName?: string;
  category?: string;
  brand?: string;
}

interface ReportSignalModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewSignalInput) => void;
  defaults?: ReportSignalDefaults;
}

export function ReportSignalModal({
  open,
  onClose,
  onSubmit,
  defaults,
}: ReportSignalModalProps) {
  const products = productService.list();
  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.category))).sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [products]
  );

  const [type, setType] = useState<SignalType>("stockout");
  const [sku, setSku] = useState<string | undefined>(defaults?.sku);
  const [productName, setProductName] = useState(defaults?.productName ?? "");
  const [category, setCategory] = useState(defaults?.category ?? "");
  const [brand, setBrand] = useState(defaults?.brand ?? "");
  const [query, setQuery] = useState(defaults?.productName ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);

  const [channel, setChannel] = useState<SignalChannel>("store");
  const [store, setStore] = useState("Balmaceda San Javier");
  const [reportedBy, setReportedBy] = useState(SELLERS[0]);
  const [comment, setComment] = useState("");
  const [priority, setPriority] = useState<SignalPriority>("high");
  const [priorityTouched, setPriorityTouched] = useState(false);

  const [showEvidence, setShowEvidence] = useState(false);
  const [customersAsking, setCustomersAsking] = useState("");
  const [estimatedLostSale, setEstimatedLostSale] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setType(defaults?.sku || defaults?.productName ? "stockout" : "stockout");
    setSku(defaults?.sku);
    setProductName(defaults?.productName ?? "");
    setCategory(defaults?.category ?? "");
    setBrand(defaults?.brand ?? "");
    setQuery(defaults?.productName ?? "");
    setIsNewProduct(false);
    setChannel("store");
    setStore("Balmaceda San Javier");
    setReportedBy(SELLERS[0]);
    setComment("");
    setPriorityTouched(false);
    setShowEvidence(false);
    setCustomersAsking("");
    setEstimatedLostSale("");
    setEvidenceNote("");
  }, [open, defaults]);

  // Cuando se elige "Sugerido por cliente" se asume producto nuevo (sin SKU)
  useEffect(() => {
    if (type === "customer_suggested") setIsNewProduct(true);
  }, [type]);

  // Prioridad sugerida (recalcula salvo que el usuario la haya tocado)
  const stock = sku
    ? productService.getBySku(sku)?.availableStock ?? 0
    : 0;
  const suggestion = useMemo(
    () =>
      suggestPriority({
        type,
        customersAsking: customersAsking ? Number(customersAsking) : undefined,
        stock,
      }),
    [type, customersAsking, stock]
  );
  useEffect(() => {
    if (!priorityTouched) setPriority(suggestion.priority);
  }, [suggestion.priority, priorityTouched]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || isNewProduct) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, products, isNewProduct]);

  const pickProduct = (p: (typeof products)[number]) => {
    setSku(p.sku);
    setProductName(p.name);
    setCategory(p.category);
    setBrand(p.brand);
    setQuery(p.name);
    setShowSuggestions(false);
  };

  const storeForChannel =
    channel === "store"
      ? store
      : channel === "web"
        ? "Tienda Web"
        : channel === "marketplace"
          ? "Marketplace"
          : "Call center";

  const canSubmit =
    productName.trim().length > 1 &&
    comment.trim().length > 2 &&
    (isNewProduct ? category.trim().length > 0 : true);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      type,
      priority,
      sku: isNewProduct ? undefined : sku,
      productName: productName.trim(),
      category: category || "Sin categoría",
      brand: brand || undefined,
      channel,
      store: storeForChannel,
      reportedBy,
      comment: comment.trim(),
      recommendedAction: SIGNAL_TYPE[type].hint,
      customersAsking: customersAsking ? Number(customersAsking) : undefined,
      estimatedLostSale: estimatedLostSale
        ? Number(estimatedLostSale)
        : undefined,
      evidenceNote: evidenceNote.trim() || undefined,
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
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      TONE_DOT[meta.tone]
                    )}
                  />
                  <span className="truncate">{meta.short}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">{SIGNAL_TYPE[type].hint}.</p>
        </div>

        {/* 2. Producto */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              2 · Producto
            </p>
            <button
              type="button"
              onClick={() => {
                setIsNewProduct((v) => !v);
                setSku(undefined);
              }}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {isNewProduct ? "Buscar en el surtido" : "Producto nuevo (sin SKU)"}
            </button>
          </div>

          {isNewProduct ? (
            <div className="space-y-2">
              <Input
                placeholder="Nombre del producto sugerido"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                icon={<IconBulb className="w-4 h-4" />}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Categoría…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Buscar por nombre, SKU o marca"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                  setSku(undefined);
                  setProductName(e.target.value);
                }}
                onFocus={() => setShowSuggestions(true)}
                icon={<IconSearch className="w-4 h-4" />}
              />
              {sku && (
                <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                  <IconBox className="w-3.5 h-3.5" /> {sku} · {category}
                  {brand ? ` · ${brand}` : ""}
                </p>
              )}
              {showSuggestions && matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                  {matches.map((p) => (
                    <button
                      key={p.sku}
                      type="button"
                      onClick={() => pickProduct(p)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-slate-700 truncate">
                          {p.name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {p.category} · {p.brand}
                        </span>
                      </span>
                      <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                        {p.sku}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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

        {/* Reportado por */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-500">Reportado por</span>
          <select
            value={reportedBy}
            onChange={(e) => setReportedBy(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
          >
            {SELLERS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Badge tone="blue" className="ml-auto">
            Modo vendedor
          </Badge>
        </div>
      </div>
    </Modal>
  );
}
