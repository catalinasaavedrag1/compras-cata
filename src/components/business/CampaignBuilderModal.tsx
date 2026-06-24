import { useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { IconSearch, IconPlus, IconClose, IconBox } from "../ui/icons";
import { cn } from "../../utils/cn";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import { products as allProducts } from "../../data/mockProducts";
import { PROMO_CHANNELS } from "./campaignLabels";
import type {
  CampaignProductLine,
  CreatedCampaign,
  PromoChannel,
} from "../../types/purchasing";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (campaign: CreatedCampaign) => void;
  /** Plantilla opcional para precargar el nombre (ej. "Cyber"). */
  initialName?: string;
}

const todayISO = "2026-06-24";

function lineFor(sku: string, discountPct: number): CampaignProductLine | null {
  const p = allProducts.find((x) => x.sku === sku);
  if (!p) return null;
  return {
    sku: p.sku,
    productName: p.name,
    basePrice: p.price,
    discountPct,
    campaignPrice: Math.round(p.price * (1 - discountPct / 100)),
    availableStock: p.availableStock,
  };
}

export function CampaignBuilderModal({ open, onClose, onSave, initialName = "" }: Props) {
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState("2026-07-04");
  const [channels, setChannels] = useState<PromoChannel[]>(["web"]);
  const [lines, setLines] = useState<CampaignProductLine[]>([]);
  const [picker, setPicker] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setName(initialName);
    setStartDate(todayISO);
    setEndDate("2026-07-04");
    setChannels(["web"]);
    setLines([]);
    setPicker("");
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickerResults = useMemo(() => {
    const q = picker.trim().toLowerCase();
    if (q.length < 1) return [];
    const added = new Set(lines.map((l) => l.sku));
    return allProducts
      .filter((p) => !added.has(p.sku) && `${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [picker, lines]);

  const toggleChannel = (c: PromoChannel) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const addProduct = (sku: string) => {
    const line = lineFor(sku, 10);
    if (line) setLines((prev) => [...prev, line]);
    setPicker("");
  };

  const setDiscount = (sku: string, discountPct: number) =>
    setLines((prev) =>
      prev.map((l) =>
        l.sku === sku
          ? { ...l, discountPct, campaignPrice: Math.round(l.basePrice * (1 - discountPct / 100)) }
          : l
      )
    );

  const removeLine = (sku: string) => setLines((prev) => prev.filter((l) => l.sku !== sku));

  const save = () => {
    if (!name.trim()) return setError("Ponle un nombre a la campaña (ej. Cyber herramientas).");
    if (channels.length === 0) return setError("Selecciona al menos un canal.");
    if (lines.length === 0) return setError("Agrega al menos un producto en descuento.");
    const campaign: CreatedCampaign = {
      id: `CAMP-${Math.abs(hashCode(name + startDate + lines.length))}`,
      name: name.trim(),
      channels,
      startDate,
      endDate,
      status: startDate > todayISO ? "scheduled" : "active",
      products: lines,
      createdAt: todayISO,
    };
    onSave(campaign);
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Crear campaña comercial"
      description="Define la campaña, elige los canales y sube los productos que estarán con descuento."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={save}>Guardar campaña</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Datos básicos */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <Input label="Nombre de la campaña" placeholder="Ej. Cyber herramientas" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Input label="Fecha inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Fecha término" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <div className="flex items-end">
            <p className="text-xs text-slate-500">
              La campaña queda <b>{startDate > todayISO ? "programada" : "activa"}</b> según la fecha de inicio.
            </p>
          </div>
        </div>

        {/* Canales */}
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">Canales de la campaña</p>
          <div className="flex flex-wrap gap-2">
            {PROMO_CHANNELS.map((c) => (
              <button
                key={c.value}
                onClick={() => toggleChannel(c.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  channels.includes(c.value)
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Productos en descuento */}
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">
            Productos en descuento ({lines.length})
          </p>

          <div className="relative mb-3">
            <Input
              icon={<IconSearch className="w-4 h-4" />}
              placeholder="Buscar producto por SKU o nombre para agregar..."
              value={picker}
              onChange={(e) => setPicker(e.target.value)}
            />
            {pickerResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                {pickerResults.map((p) => (
                  <button
                    key={p.sku}
                    onClick={() => addProduct(p.sku)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.sku} · {formatCurrency(p.price)} · stock {formatNumber(p.availableStock)}</span>
                    </span>
                    <IconPlus className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center">
              <IconBox className="w-6 h-6 text-slate-300 mx-auto mb-1" />
              <p className="text-sm text-slate-500">Busca productos arriba y agrégalos con su descuento.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {lines.map((l) => (
                <div key={l.sku} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-mono text-slate-400">{l.sku}</span>
                    <p className="text-sm font-medium text-slate-800 truncate">{l.productName}</p>
                    <p className="text-xs text-slate-500">
                      Stock {formatNumber(l.availableStock)}
                      {l.availableStock <= 5 && <span className="text-rose-500 font-medium"> · stock bajo</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={l.discountPct}
                      onChange={(e) => setDiscount(l.sku, Number(e.target.value))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-right focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
                    />
                    <span className="text-xs text-slate-400">% dcto</span>
                  </div>
                  <div className="text-right w-28">
                    <p className="text-xs text-slate-400 line-through">{formatCurrency(l.basePrice)}</p>
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(l.campaignPrice)}</p>
                  </div>
                  <button onClick={() => removeLine(l.sku)} className="text-slate-400 hover:text-rose-600" aria-label="Quitar">
                    <IconClose className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {lines.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="neutral">{lines.length} productos</Badge>
              <Badge tone="amber">
                Descuento promedio {Math.round(lines.reduce((a, l) => a + l.discountPct, 0) / lines.length)}%
              </Badge>
              {lines.some((l) => l.availableStock <= 5) && (
                <Badge tone="red">
                  {lines.filter((l) => l.availableStock <= 5).length} con stock bajo — revisa compra antes de lanzar
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
