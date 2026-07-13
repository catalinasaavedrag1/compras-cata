import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Drawer } from "../components/ui/Drawer";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import {
  IconPlus,
  IconClose,
  IconChat,
  IconCheck,
  IconClock,
  IconCart,
  IconSearch,
} from "../components/ui/icons";
import { formatCurrency, formatDate, formatDays, formatNumber } from "../utils/formatters";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { useBuyer } from "../context/BuyerContext";
import { useLocalStorage } from "../utils/useLocalStorage";
import { TODAY_ISO } from "../utils/constants";
import { products } from "../data/mockProducts";
import { suppliers } from "../data/mockSuppliers";
import {
  rfqs as seedRfqs,
  pickBestForLine,
  respondedSupplierCount,
  RFQ_STATUS_LABELS,
  RFQ_STATUS_TONE,
  type Rfq,
  type RfqLine,
  type RfqResponse,
  type RfqStatus,
} from "../data/mockRfq";

// Estados que se consideran "convertibles" a OC desde el detalle.
const APROBABLE: RfqStatus[] = ["respondida", "respondida_parcial", "en_negociacion", "aprobada"];

// Tabs por estado: cada tab define qué estados agrupa.
const TABS: { value: string; label: string; estados: RfqStatus[] | null }[] = [
  { value: "todas", label: "Todas", estados: null },
  { value: "borrador", label: "Borrador", estados: ["borrador"] },
  { value: "enviadas", label: "Enviadas", estados: ["enviada"] },
  { value: "respondidas", label: "Respondidas", estados: ["respondida", "respondida_parcial"] },
  { value: "negociacion", label: "En negociación", estados: ["en_negociacion"] },
  { value: "aprobadas", label: "Aprobadas", estados: ["aprobada", "convertida"] },
];

export function RfqPage() {
  const navigate = useNavigate();
  const { addItem } = useOcDraft();
  const toast = useToast();
  const { buyer } = useBuyer();

  // Persistencia: RFQs creadas por el usuario + cambios de estado sobre semillas.
  const [createdRfqs, setCreatedRfqs] = useLocalStorage<Rfq[]>("compras:rfq", []);
  const [statusOverrides, setStatusOverrides] = useLocalStorage<Record<string, RfqStatus>>(
    "compras:rfq-status",
    {}
  );

  const [tab, setTab] = useState("todas");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Lista combinada (creadas primero) con overrides de estado aplicados.
  const all = useMemo<Rfq[]>(() => {
    const merged = [...createdRfqs, ...seedRfqs];
    return merged.map((r) => (statusOverrides[r.id] ? { ...r, estado: statusOverrides[r.id] } : r));
  }, [createdRfqs, statusOverrides]);

  const detail = useMemo(() => all.find((r) => r.id === detailId) ?? null, [all, detailId]);

  // KPIs.
  const porResponder = all.filter(
    (r) => r.estado === "enviada" || r.estado === "respondida_parcial"
  ).length;
  const enNegociacion = all.filter((r) => r.estado === "en_negociacion").length;
  // Una cotización sigue "en juego" mientras no esté cerrada: enviada, con respuesta
  // (parcial/total) o en negociación. Cualquiera de estas puede vencer si no se decide.
  const openEstados: RfqStatus[] = [
    "enviada",
    "respondida_parcial",
    "respondida",
    "en_negociacion",
  ];
  const porVencer = all.filter(
    (r) =>
      openEstados.includes(r.estado) &&
      daysUntil(r.fechaVencimiento) >= 0 &&
      daysUntil(r.fechaVencimiento) <= 7
  ).length;
  const convertidas = all.filter((r) => r.estado === "convertida").length;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) {
      c[t.value] =
        t.estados === null ? all.length : all.filter((r) => t.estados!.includes(r.estado)).length;
    }
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    const cfg = TABS.find((t) => t.value === tab);
    if (!cfg || cfg.estados === null) return all;
    return all.filter((r) => cfg.estados!.includes(r.estado));
  }, [all, tab]);

  // Transiciones de estado (persisten en localStorage).
  const setEstado = (
    rfq: Rfq,
    estado: RfqStatus,
    msg: string,
    action?: { label: string; onClick: () => void }
  ) => {
    setStatusOverrides((prev) => ({ ...prev, [rfq.id]: estado }));
    toast.success(msg, action);
  };

  // Convertir a OC: agrega la mejor oferta disponible de cada línea al borrador.
  const convertToOc = (rfq: Rfq) => {
    let added = 0;
    for (const line of rfq.lines) {
      const lineResponses = rfq.responses.filter((r) => r.sku === line.sku);
      const { cheapest } = pickBestForLine(lineResponses);
      if (!cheapest) continue;
      addItem({
        sku: line.sku,
        productName: line.productName,
        supplierName: cheapest.supplierName,
        quantity: Math.max(line.qtyRequested, cheapest.minimoCompra),
        unitCost: cheapest.costoUnitario,
      });
      added++;
    }
    setStatusOverrides((prev) => ({ ...prev, [rfq.id]: "convertida" }));
    setDetailId(null);
    toast.success(
      added > 0
        ? `${added} línea${added === 1 ? "" : "s"} de ${rfq.numero} agregada${added === 1 ? "" : "s"} al borrador de OC`
        : `No hay ofertas disponibles para convertir en ${rfq.numero}`,
      added > 0
        ? { label: "Ver borrador OC", onClick: () => navigate("/comprar/borradores") }
        : undefined
    );
  };

  const saveRfq = (rfq: Rfq) => {
    setCreatedRfqs((prev) => [rfq, ...prev]);
    setCreateOpen(false);
    setTab("borrador");
    toast.success(
      `Cotización ${rfq.numero} creada con ${rfq.lines.length} producto${rfq.lines.length === 1 ? "" : "s"} y ${rfq.suppliers.length} proveedor${rfq.suppliers.length === 1 ? "" : "es"}`
    );
  };

  const columns: Column<Rfq>[] = [
    {
      key: "numero",
      header: "N° cotización",
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.numero}</p>
          <p className="text-xs text-slate-400">{r.comprador}</p>
        </div>
      ),
    },
    {
      key: "fechas",
      header: "Fecha / Vencimiento",
      hideOnMobile: true,
      render: (r) => {
        const d = daysUntil(r.fechaVencimiento);
        const soon = openEstados.includes(r.estado) && d >= 0 && d <= 7;
        return (
          <div className="text-sm">
            <p className="text-slate-700">{formatDate(r.fecha)}</p>
            <p className={`text-xs ${soon ? "text-amber-600 font-medium" : "text-slate-400"}`}>
              vence {formatDate(r.fechaVencimiento)}
              {soon && ` · en ${formatDays(d)}`}
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
      render: (r) => formatNumber(r.lines.length),
    },
    {
      key: "proveedores",
      header: "Proveedores",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatNumber(r.suppliers.length)}</p>
          <p className="text-xs text-slate-400">{respondedSupplierCount(r)} respondió</p>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (r) => (
        <Badge tone={RFQ_STATUS_TONE[r.estado]} dot>
          {RFQ_STATUS_LABELS[r.estado]}
        </Badge>
      ),
    },
    {
      key: "accion",
      header: "",
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDetailId(r.id);
          }}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {r.responses.length > 0 ? "Comparar" : "Ver detalle"}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        description="Solicita cotizaciones (RFQ) a tus proveedores, compara precio, plazo y mínimo de compra lado a lado, y convierte la mejor oferta en una orden de compra."
        action={
          <Button onClick={() => setCreateOpen(true)} icon={<IconPlus className="w-4 h-4" />}>
            Nueva cotización
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Por responder"
          value={formatNumber(porResponder)}
          tone="info"
          icon={<IconChat className="w-4 h-4" />}
          description="Enviadas o parciales"
          active={tab === "enviadas" || tab === "respondidas"}
          onClick={() => setTab("respondidas")}
        />
        <KpiCard
          title="En negociación"
          value={formatNumber(enNegociacion)}
          tone="warn"
          icon={<IconClock className="w-4 h-4" />}
          description="Ajustando oferta"
          active={tab === "negociacion"}
          onClick={() => setTab("negociacion")}
        />
        <KpiCard
          title="Por vencer (≤ 7 días)"
          value={formatNumber(porVencer)}
          tone="bad"
          icon={<IconClock className="w-4 h-4" />}
          description="Cierra el proceso"
        />
        <KpiCard
          title="Convertidas a OC"
          value={formatNumber(convertidas)}
          tone="good"
          icon={<IconCart className="w-4 h-4" />}
          description="Adjudicadas"
          active={tab === "aprobadas"}
          onClick={() => setTab("aprobadas")}
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
          onRowClick={(r) => setDetailId(r.id)}
          emptyMessage="No hay cotizaciones en esta vista. Crea una nueva con el botón de arriba."
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{r.numero}</p>
                  <p className="text-xs text-slate-400">
                    {r.lines.length} prod. · {r.suppliers.length} prov. · vence{" "}
                    {formatDate(r.fechaVencimiento)}
                  </p>
                </div>
                <Badge tone={RFQ_STATUS_TONE[r.estado]} dot>
                  {RFQ_STATUS_LABELS[r.estado]}
                </Badge>
              </div>
            </div>
          )}
        />
      </Card>

      <CreateRfqModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={saveRfq}
        buyer={buyer}
        existingCount={createdRfqs.length}
      />

      <ComparisonDrawer
        rfq={detail}
        onClose={() => setDetailId(null)}
        onNegotiate={(r) => setEstado(r, "en_negociacion", `${r.numero} marcada en negociación`)}
        onApprove={(r) =>
          setEstado(r, "aprobada", `${r.numero} aprobada. Ya puedes convertirla a OC.`)
        }
        onConvert={convertToOc}
      />
    </div>
  );
}

// ============================================================================
//  Drawer de comparación de ofertas (precio / plazo / mínimo / disponible).
// ============================================================================

function ComparisonDrawer({
  rfq,
  onClose,
  onNegotiate,
  onApprove,
  onConvert,
}: {
  rfq: Rfq | null;
  onClose: () => void;
  onNegotiate: (r: Rfq) => void;
  onApprove: (r: Rfq) => void;
  onConvert: (r: Rfq) => void;
}) {
  const hasResponses = !!rfq && rfq.responses.length > 0;
  const convertible = !!rfq && APROBABLE.includes(rfq.estado) && hasResponses;
  const showApprove = !!rfq && rfq.estado !== "aprobada" && rfq.estado !== "convertida";
  const showNegotiate =
    !!rfq && (rfq.estado === "respondida" || rfq.estado === "respondida_parcial");

  return (
    <Drawer
      open={!!rfq}
      onClose={onClose}
      title={rfq ? `Comparación · ${rfq.numero}` : ""}
      description={
        rfq
          ? `${rfq.lines.length} producto${rfq.lines.length === 1 ? "" : "s"} · ${rfq.suppliers.length} proveedor${rfq.suppliers.length === 1 ? "" : "es"} · vence ${formatDate(rfq.fechaVencimiento)}`
          : ""
      }
      footer={
        rfq && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            {showNegotiate && (
              <Button variant="secondary" onClick={() => onNegotiate(rfq)}>
                Marcar en negociación
              </Button>
            )}
            {showApprove && hasResponses && (
              <Button variant="secondary" onClick={() => onApprove(rfq)}>
                Aprobar
              </Button>
            )}
            {convertible && (
              <Button icon={<IconCart className="w-4 h-4" />} onClick={() => onConvert(rfq)}>
                Convertir a OC
              </Button>
            )}
          </>
        )
      }
    >
      {rfq && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={RFQ_STATUS_TONE[rfq.estado]} dot>
              {RFQ_STATUS_LABELS[rfq.estado]}
            </Badge>
            <span className="text-xs text-slate-400">Solicitada {formatDate(rfq.fecha)}</span>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Proveedores invitados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rfq.suppliers.map((s) => {
                const responded = rfq.responses.some((r) => r.supplierName === s);
                return (
                  <Badge key={s} tone={responded ? "green" : "neutral"} dot>
                    {s}
                    {responded ? "" : " · sin respuesta"}
                  </Badge>
                );
              })}
            </div>
          </div>

          {!hasResponses ? (
            <EmptyState
              icon={<IconChat className="w-6 h-6" />}
              title="Aún sin respuestas"
              description="Esta cotización todavía no recibe ofertas de los proveedores invitados. Vuelve cuando lleguen para comparar."
            />
          ) : (
            <div className="space-y-4">
              {rfq.lines.map((line) => (
                <LineComparison
                  key={line.sku}
                  line={line}
                  responses={rfq.responses.filter((r) => r.sku === line.sku)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** Tabla de comparación de respuestas para una línea, con mejor por costo resaltado. */
function LineComparison({ line, responses }: { line: RfqLine; responses: RfqResponse[] }) {
  const { cheapest, fastest, tradeoffNote } = pickBestForLine(responses);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-200">
        <div className="min-w-0">
          <span className="text-xs font-mono text-slate-400">{line.sku}</span>
          <p className="text-sm font-medium text-slate-800 truncate">{line.productName}</p>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0">
          Solicitado: <b className="text-slate-700">{formatNumber(line.qtyRequested)} u.</b>
        </span>
      </div>

      {responses.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-400">Ningún proveedor cotizó esta línea.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">Plazo</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2 text-center">Disp.</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => {
              const isCheapest =
                !!cheapest && r.supplierName === cheapest.supplierName && r.disponible;
              const isFastest =
                !!fastest &&
                r.supplierName === fastest.supplierName &&
                r.disponible &&
                (!cheapest || fastest.supplierName !== cheapest.supplierName);
              return (
                <tr
                  key={r.supplierName}
                  className={`border-b border-slate-50 last:border-0 ${isCheapest ? "bg-emerald-50/60" : ""}`}
                >
                  <td className="px-3 py-2">
                    <span className={isCheapest ? "font-medium text-slate-900" : "text-slate-700"}>
                      {r.supplierName}
                    </span>
                    {isCheapest && (
                      <Badge tone="green" className="ml-1.5">
                        Mejor precio
                      </Badge>
                    )}
                    {isFastest && (
                      <Badge tone="blue" className="ml-1.5">
                        Más rápido
                      </Badge>
                    )}
                    {r.observacion && (
                      <p className="text-xs text-slate-400 mt-0.5">{r.observacion}</p>
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-right whitespace-nowrap ${isCheapest ? "font-semibold text-emerald-700" : "text-slate-700"}`}
                  >
                    {formatCurrency(r.costoUnitario)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">
                    {formatDays(r.plazoDias)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">
                    {formatNumber(r.minimoCompra)} u.
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.disponible ? (
                      <>
                        <IconCheck className="w-4 h-4 text-emerald-500 inline" aria-hidden="true" />
                        <span className="sr-only">Disponible</span>
                      </>
                    ) : (
                      <>
                        <IconClose className="w-4 h-4 text-rose-400 inline" aria-hidden="true" />
                        <span className="sr-only">No disponible</span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {tradeoffNote && (
        <p className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-100">
          ⚠ {tradeoffNote}
        </p>
      )}
    </div>
  );
}

// ============================================================================
//  Modal de creación de cotización (nombre, productos, proveedores, vencimiento).
// ============================================================================

function CreateRfqModal({
  open,
  onClose,
  onSave,
  buyer,
  existingCount,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (rfq: Rfq) => void;
  buyer: string;
  existingCount: number;
}) {
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("2026-07-08");

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q))
      : products;
    return base.slice(0, 8);
  }, [search]);

  const reset = () => {
    setName("");
    setSearch("");
    setSelectedSkus([]);
    setSelectedSuppliers([]);
    setDueDate("2026-07-08");
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggleSku = (sku: string) =>
    setSelectedSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );

  const toggleSupplier = (s: string) =>
    setSelectedSuppliers((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const canSave = selectedSkus.length > 0 && selectedSuppliers.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const seq = String(9 + existingCount).padStart(4, "0");
    const lines: RfqLine[] = selectedSkus.map((sku) => {
      const p = products.find((x) => x.sku === sku)!;
      return { sku: p.sku, productName: p.name, qtyRequested: Math.max(p.reorderPoint, 1) };
    });
    const rfq: Rfq = {
      id: `RFQ-2026-${seq}`,
      numero: `COT-2026-${seq}`,
      fecha: TODAY_ISO,
      fechaVencimiento: dueDate,
      comprador: buyer,
      estado: "borrador",
      lines,
      suppliers: selectedSuppliers,
      responses: [],
    };
    onSave(rfq);
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Nueva cotización (RFQ)"
      description="Elige los productos a cotizar y los proveedores a invitar. Se crea como borrador."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Crear cotización
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          label="Nombre / referencia (opcional)"
          placeholder="Ej. Reposición construcción julio"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Productos a cotizar</p>
          <Input
            icon={<IconSearch className="w-4 h-4" />}
            placeholder="Buscar por SKU o nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto scrollbar-thin">
            {matches.map((p) => {
              const checked = selectedSkus.includes(p.sku);
              return (
                <button
                  key={p.sku}
                  type="button"
                  onClick={() => toggleSku(p.sku)}
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
            {matches.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-400">Sin coincidencias.</p>
            )}
          </div>
          {selectedSkus.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedSkus.map((sku) => {
                const p = products.find((x) => x.sku === sku);
                return (
                  <span
                    key={sku}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 text-xs text-brand-700"
                  >
                    {p?.name ?? sku}
                    <button onClick={() => toggleSku(sku)} aria-label={`Quitar ${p?.name ?? sku}`}>
                      <IconClose className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">Proveedores a invitar</p>
          <div className="flex flex-wrap gap-1.5">
            {suppliers.map((s) => {
              const active = selectedSuppliers.includes(s.name);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSupplier(s.name)}
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
        </div>

        <Input
          label="Fecha de vencimiento"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
//  Utilidad local: días desde "hoy" (demo) hasta una fecha ISO.
// ----------------------------------------------------------------------------
function daysUntil(iso: string): number {
  const today = new Date(`${TODAY_ISO}T00:00:00`);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
