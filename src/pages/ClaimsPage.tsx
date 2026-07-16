import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Chip } from "../components/ui/Chip";
import { useClaims } from "../context/ClaimsContext";
import { useTrace } from "../context/TraceContext";
import {
  CLAIM_TYPE,
  CLAIM_STATUS,
  CLAIM_RESOLUTION,
  CLAIM_OPEN_STATES,
  claimTypeMeta,
  claimStatusMeta,
  claimResolutionLabel,
} from "../data/mockClaims";
import { useToast } from "../context/ToastContext";
import { supplierPath } from "../utils/entityLinks";
import { formatCurrency, formatCurrencyCompact, formatDate } from "../utils/formatters";
import { IconAlerts, IconCheck, IconSuppliers } from "../components/ui/icons";
import type {
  ClaimResolution,
  ClaimStatus,
  ClaimType,
  SupplierClaim,
} from "../types/purchasing";

const OPEN = new Set<ClaimStatus>(CLAIM_OPEN_STATES);
const RESUELTO_RECUPERA: ClaimResolution[] = ["nota_credito", "reposicion", "descuento"];

export function ClaimsPage() {
  const { claims, updateClaim, addClaim } = useClaims();
  const { log } = useTrace();
  const toast = useToast();
  const [filter, setFilter] = useState<"abiertos" | "todos" | "resueltos">("abiertos");
  const [managing, setManaging] = useState<SupplierClaim | null>(null);
  const [creating, setCreating] = useState(false);

  const kpis = useMemo(() => {
    const open = claims.filter((c) => OPEN.has(c.estado));
    const resolved = claims.filter((c) => c.estado === "resuelto");
    const recovered = resolved
      .filter((c) => RESUELTO_RECUPERA.includes(c.resolucion))
      .reduce((a, c) => a + c.valorReclamado, 0);
    return {
      open: open.length,
      openValue: open.reduce((a, c) => a + c.valorReclamado, 0),
      resolved: resolved.length,
      recovered,
    };
  }, [claims]);

  const rows = useMemo(() => {
    const list =
      filter === "abiertos"
        ? claims.filter((c) => OPEN.has(c.estado))
        : filter === "resueltos"
          ? claims.filter((c) => c.estado === "resuelto" || c.estado === "rechazado")
          : claims;
    return [...list].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [claims, filter]);

  const columns: Column<SupplierClaim>[] = [
    {
      key: "ref",
      header: "OC / Proveedor",
      render: (c) => (
        <div className="min-w-[150px]">
          <p className="text-sm font-medium text-slate-800">{c.poNumber}</p>
          <Link
            to={supplierPath(c.supplierName)}
            className="text-xs text-slate-500 hover:text-brand-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.supplierName}
          </Link>
        </div>
      ),
    },
    {
      key: "product",
      header: "Producto",
      render: (c) => (
        <div className="min-w-[160px]">
          <p className="text-sm text-slate-800">{c.productName}</p>
          <p className="text-xs text-slate-400 font-mono">{c.sku}</p>
        </div>
      ),
    },
    {
      key: "tipo",
      header: "Motivo",
      render: (c) => (
        <div className="min-w-[180px]">
          <Badge tone={claimTypeMeta(c.tipo).tone}>{claimTypeMeta(c.tipo).label}</Badge>
          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.motivo}</p>
        </div>
      ),
    },
    {
      key: "valor",
      header: "Valor reclamado",
      align: "right",
      sortable: true,
      sortValue: (c) => c.valorReclamado,
      render: (c) => (
        <span className="font-semibold text-rose-600">{formatCurrency(c.valorReclamado)}</span>
      ),
    },
    {
      key: "fecha",
      header: "Fecha / límite",
      hideOnMobile: true,
      render: (c) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatDate(c.fecha)}</p>
          {c.fechaLimite && (
            <p className="text-xs text-amber-600">compromiso {formatDate(c.fechaLimite)}</p>
          )}
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (c) => (
        <div>
          <Badge tone={claimStatusMeta(c.estado).tone} dot>
            {claimStatusMeta(c.estado).label}
          </Badge>
          <p className="mt-1 text-xs text-slate-500">
            {claimResolutionLabel(c.resolucion)}
            {c.notaCredito ? ` · ${c.notaCredito}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button size="sm" variant="secondary" onClick={() => setManaging(c)}>
          Gestionar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reclamos a proveedores"
        description="Faltantes, daños, calidad y costos: qué está en juego, quién responde y cómo se resuelve. Alimenta la evaluación del proveedor."
        action={<Button onClick={() => setCreating(true)}>Nuevo reclamo</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Reclamos abiertos"
          value={String(kpis.open)}
          tone={kpis.open > 0 ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Valor en juego"
          value={formatCurrencyCompact(kpis.openValue)}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
          description="En reclamos abiertos"
        />
        <KpiCard
          title="Resueltos"
          value={String(kpis.resolved)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
        />
        <KpiCard
          title="Recuperado"
          value={formatCurrencyCompact(kpis.recovered)}
          tone="good"
          icon={<IconSuppliers className="w-4 h-4" />}
          description="NC, reposición o descuento"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            { k: "abiertos", label: `Abiertos (${kpis.open})` },
            { k: "resueltos", label: "Resueltos / rechazados" },
            { k: "todos", label: "Todos" },
          ] as const
        ).map((t) => (
          <Chip key={t.k} active={filter === t.k} onClick={() => setFilter(t.k)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(c) => c.id}
          emptyMessage="Sin reclamos con este filtro. Los reclamos se crean desde una diferencia de recepción o con “Nuevo reclamo”."
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{c.productName}</p>
                  <p className="text-xs text-slate-400">
                    {c.poNumber} · {c.supplierName}
                  </p>
                </div>
                <Badge tone={claimStatusMeta(c.estado).tone} dot={false}>
                  {claimStatusMeta(c.estado).label}
                </Badge>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone={claimTypeMeta(c.tipo).tone}>{claimTypeMeta(c.tipo).label}</Badge>
                <span className="text-sm font-semibold text-rose-600">
                  {formatCurrency(c.valorReclamado)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.motivo}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => setManaging(c)}
              >
                Gestionar
              </Button>
            </div>
          )}
        />
      </Card>

      {managing && (
        <ManageClaimModal
          claim={managing}
          onClose={() => setManaging(null)}
          onSave={(patch) => {
            updateClaim(managing.id, patch);
            if (patch.estado && patch.estado !== managing.estado) {
              log({
                actor: "Catalina Saavedra",
                entity: `Reclamo · ${managing.productName}`,
                action: "Actualizó reclamo",
                field: "estado",
                before: managing.estado,
                after: patch.estado,
                reason: patch.notaCredito ? `Nota de crédito ${patch.notaCredito}` : undefined,
              });
            }
            toast.success("Reclamo actualizado");
            setManaging(null);
          }}
        />
      )}

      {creating && (
        <CreateClaimModal
          onClose={() => setCreating(false)}
          onCreate={(claim) => {
            addClaim(claim);
            log({
              actor: claim.responsable,
              entity: `Reclamo · ${claim.productName}`,
              action: "Creó reclamo",
              field: "estado",
              before: "—",
              after: "abierto",
              reason: claim.motivo,
            });
            toast.success("Reclamo creado");
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function ManageClaimModal({
  claim,
  onClose,
  onSave,
}: {
  claim: SupplierClaim;
  onClose: () => void;
  onSave: (patch: Partial<SupplierClaim>) => void;
}) {
  const [estado, setEstado] = useState<ClaimStatus>(claim.estado);
  const [resolucion, setResolucion] = useState<ClaimResolution>(claim.resolucion);
  const [notaCredito, setNotaCredito] = useState(claim.notaCredito ?? "");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Gestionar reclamo · ${claim.productName}`}
      description={`${claim.poNumber} · ${claim.supplierName} · ${formatCurrency(claim.valorReclamado)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                estado,
                resolucion,
                notaCredito: notaCredito.trim() || undefined,
              })
            }
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{claim.motivo}</p>
        <Select
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as ClaimStatus)}
          options={(Object.keys(CLAIM_STATUS) as ClaimStatus[]).map((s) => ({
            value: s,
            label: CLAIM_STATUS[s].label,
          }))}
        />
        <Select
          label="Resolución"
          value={resolucion}
          onChange={(e) => setResolucion(e.target.value as ClaimResolution)}
          options={(Object.keys(CLAIM_RESOLUTION) as ClaimResolution[]).map((r) => ({
            value: r,
            label: CLAIM_RESOLUTION[r],
          }))}
        />
        {resolucion === "nota_credito" && (
          <Input
            label="N° de nota de crédito"
            placeholder="NC-2026-0000"
            value={notaCredito}
            onChange={(e) => setNotaCredito(e.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}

function CreateClaimModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (claim: Omit<SupplierClaim, "id">) => void;
}) {
  const [poNumber, setPoNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [tipo, setTipo] = useState<ClaimType>("faltante");
  const [cantidad, setCantidad] = useState(1);
  const [valor, setValor] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!supplierName.trim() || !productName.trim() || !motivo.trim()) {
      setError("Completa proveedor, producto y motivo.");
      return;
    }
    onCreate({
      poNumber: poNumber.trim() || "—",
      supplierName: supplierName.trim(),
      sku: sku.trim() || "—",
      productName: productName.trim(),
      tipo,
      cantidad,
      valorReclamado: Math.max(0, valor),
      motivo: motivo.trim(),
      responsable: "Catalina Saavedra",
      fecha: new Date().toISOString().slice(0, 10),
      estado: "abierto",
      resolucion: "pendiente",
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo reclamo al proveedor"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Crear reclamo</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Proveedor" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          <Input label="N° OC" placeholder="OC-2026-0000" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
          <Input label="Producto" value={productName} onChange={(e) => setProductName(e.target.value)} />
          <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Select
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as ClaimType)}
            options={(Object.keys(CLAIM_TYPE) as ClaimType[]).map((t) => ({
              value: t,
              label: CLAIM_TYPE[t].label,
            }))}
          />
          <Input
            label="Cantidad"
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
          <Input
            label="Valor reclamado (CLP)"
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Motivo</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Describe la diferencia y su impacto..."
          />
        </div>
      </div>
    </Modal>
  );
}
