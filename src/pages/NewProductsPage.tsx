import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Chip } from "../components/ui/Chip";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../context/ToastContext";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import { useNpi, type CreateNpiBody, type NpiActionResult, type PatchNpiBody } from "../hooks/useNpi";
import {
  describePurchaseBffError,
  type NpiCandidateView,
  type NpiRisk,
  type NpiStage,
} from "../services/purchaseBff";
import { supplierPath, categoryPath, productPath } from "../utils/entityLinks";
import { formatCurrency, formatNumber, formatPercent, formatDate } from "../utils/formatters";
import { IconBulb, IconCheck, IconLock, IconClock, IconAlerts } from "../components/ui/icons";

// ============================================================================
//  Nuevos productos (NPI, F25) conectado al purchase-bff-service. La máquina
//  real proposed → approved → pilot → evaluation → scaled | rejected se mapea a
//  las etiquetas ES que ya usaba la UI. KPIs = conteos reales por etapa.
//  Aprobar/escalar/rechazar exigen purchase:npi:approve (líder): esos botones se
//  gatean con el contexto de sesión y muestran el candado de Aprobaciones.
//  El margen se calcula (precio sugerido − costo)/precio sugerido cuando ambos
//  existen; si falta alguno, "—" (nada inventado). La pestaña "Salidas del
//  surtido" del mock no tiene fuente en el contrato F25 y se retira.
// ============================================================================

const NPI_APPROVE_PERMISSION = "purchase:npi:approve";

/** Orden del pipeline y etiquetas ES de cada etapa (mapeo del contrato). */
const NPI_STAGE_UI: Record<NpiStage, { label: string; tone: BadgeTone; order: number }> = {
  proposed: { label: "Propuesta", tone: "blue", order: 0 },
  approved: { label: "Aprobada", tone: "violet", order: 1 },
  pilot: { label: "En piloto", tone: "amber", order: 2 },
  evaluation: { label: "En evaluación", tone: "amber", order: 3 },
  scaled: { label: "Escalado", tone: "green", order: 4 },
  rejected: { label: "Rechazada", tone: "neutral", order: 5 },
};

/** Etapas del stepper lineal (rejected es terminal y se muestra aparte). */
const NPI_PIPELINE: NpiStage[] = ["proposed", "approved", "pilot", "evaluation", "scaled"];

const RISK_UI: Record<NpiRisk, { label: string; tone: BadgeTone }> = {
  low: { label: "bajo", tone: "green" },
  medium: { label: "medio", tone: "amber" },
  high: { label: "alto", tone: "red" },
};

const STAGE_FILTERS: { value: NpiStage | ""; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "proposed", label: "Propuesta" },
  { value: "approved", label: "Aprobada" },
  { value: "pilot", label: "En piloto" },
  { value: "evaluation", label: "En evaluación" },
  { value: "scaled", label: "Escalado" },
  { value: "rejected", label: "Rechazada" },
];

/** Margen (%) sobre precio sugerido; null si falta costo o precio sugerido. */
function npiMargin(c: NpiCandidateView): number | null {
  if (c.costClp != null && c.suggestedPriceClp != null && c.suggestedPriceClp > 0) {
    return ((c.suggestedPriceClp - c.costClp) / c.suggestedPriceClp) * 100;
  }
  return null;
}

const marginLabel = (c: NpiCandidateView) => {
  const m = npiMargin(c);
  return m === null ? "—" : formatPercent(m, 0);
};

export function NewProductsPage() {
  const { candidates, loading, error, configured, refetch, create, patch } = useNpi();
  const { hasPermission } = usePurchaseContext();
  const canApprove = hasPermission(NPI_APPROVE_PERMISSION);

  const [stageFilter, setStageFilter] = useState<NpiStage | "">("");
  const [detail, setDetail] = useState<NpiCandidateView | null>(null);
  const [creating, setCreating] = useState(false);

  const kpis = useMemo(() => {
    const count = (s: NpiStage) => candidates.filter((c) => c.stage === s).length;
    const active = candidates.filter(
      (c) => c.stage !== "scaled" && c.stage !== "rejected"
    ).length;
    return {
      active,
      pilot: count("pilot"),
      evaluation: count("evaluation"),
      scaled: count("scaled"),
    };
  }, [candidates]);

  const rows = useMemo(() => {
    const list = stageFilter ? candidates.filter((c) => c.stage === stageFilter) : candidates;
    return [...list].sort((a, b) => (a.dateModified < b.dateModified ? 1 : -1));
  }, [candidates, stageFilter]);

  // Mantiene el modal sincronizado con la vista fresca del hook tras un comando.
  const detailView = detail ? (candidates.find((c) => c.id === detail.id) ?? detail) : null;

  const pageTitle = "Nuevos productos (NPI)";
  const pageDescription =
    "Incorporación de productos por etapas: propuesta → aprobación → piloto → evaluación → escalado o rechazo.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver los candidatos reales de nuevos productos y gestionarlos contra el servicio de
              compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && candidates.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando candidatos">
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

  if (error && candidates.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar los candidatos
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

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={<Button onClick={() => setCreating(true)}>Proponer producto…</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="En incorporación"
          value={String(kpis.active)}
          tone="info"
          icon={<IconBulb className="w-4 h-4" />}
          description="Aún no escalados ni rechazados"
        />
        <KpiCard
          title="En piloto"
          value={String(kpis.pilot)}
          tone={kpis.pilot > 0 ? "warn" : "neutral"}
          icon={<IconClock className="w-4 h-4" />}
        />
        <KpiCard
          title="En evaluación"
          value={String(kpis.evaluation)}
          tone={kpis.evaluation > 0 ? "warn" : "neutral"}
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Escalados"
          value={String(kpis.scaled)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
          description="Incorporados a la red"
        />
      </div>

      {/* Filtro por etapa (cliente: la lista trae todas las etapas). */}
      <div className="mb-3 flex flex-wrap gap-2">
        {STAGE_FILTERS.map((f) => (
          <Chip
            key={f.value || "all"}
            active={stageFilter === f.value}
            onClick={() => setStageFilter(f.value)}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <div className="p-6 text-center text-sm text-slate-500">
            Sin candidatos con este filtro. Propón uno nuevo con “Proponer producto…”.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const st = NPI_STAGE_UI[c.stage];
            const risk = RISK_UI[c.risk];
            return (
              <Card key={c.id}>
                <button
                  type="button"
                  onClick={() => setDetail(c)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                        <Badge tone={risk.tone}>Riesgo {risk.label}</Badge>
                        <span className="text-xs font-mono text-slate-400">{c.id}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.categoryName ?? "Sin categoría"}
                        {" · "}
                        {c.supplierName ?? c.supplierRef ?? "Proveedor —"}
                        {c.comparableSku ? ` · comparable: ${c.comparableSku}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 lg:flex-shrink-0">
                      <MiniField label="Margen" value={marginLabel(c)} />
                      <MiniField
                        label="Compra inicial"
                        value={c.initialBuyQty != null ? `${formatNumber(c.initialBuyQty)} u.` : "—"}
                      />
                      <MiniField
                        label="Piloto"
                        value={c.pilotStores != null ? `${c.pilotStores} tiendas` : "—"}
                      />
                      <MiniField
                        label="Pronóstico"
                        value={
                          c.initialForecastMonthly != null
                            ? `${formatNumber(c.initialForecastMonthly)}/mes`
                            : "—"
                        }
                      />
                    </div>
                  </div>
                  {c.pilotResult && (
                    <p className="mt-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Piloto:</span> {c.pilotResult}
                    </p>
                  )}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {detailView && (
        <NpiDetailModal
          key={detailView.id}
          candidate={detailView}
          canApprove={canApprove}
          onPatch={patch}
          onClose={() => setDetail(null)}
        />
      )}

      {creating && <CreateNpiModal onCreate={create} onClose={() => setCreating(false)} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Detalle + avance de etapa. Aprobar/escalar/rechazar exigen purchase:npi:approve
//  (candado visual). Rechazar exige motivo (≥5). If-Match: 409 recarga.
// ----------------------------------------------------------------------------

/** Etapas de avance disponibles desde la etapa actual y si están gateadas. */
function transitionsFor(
  stage: NpiStage
): { target: Exclude<NpiStage, "proposed">; label: string; gated: boolean; variant: "primary" | "secondary" }[] {
  switch (stage) {
    case "proposed":
      return [
        { target: "approved", label: "Aprobar", gated: true, variant: "primary" },
        { target: "rejected", label: "Rechazar", gated: true, variant: "secondary" },
      ];
    case "approved":
      return [{ target: "pilot", label: "Iniciar piloto", gated: false, variant: "primary" }];
    case "pilot":
      return [
        { target: "evaluation", label: "Pasar a evaluación", gated: false, variant: "primary" },
      ];
    case "evaluation":
      return [
        { target: "scaled", label: "Escalar", gated: true, variant: "primary" },
        { target: "rejected", label: "Rechazar", gated: true, variant: "secondary" },
      ];
    default:
      return [];
  }
}

function NpiDetailModal({
  candidate,
  canApprove,
  onPatch,
  onClose,
}: {
  candidate: NpiCandidateView;
  canApprove: boolean;
  onPatch: (id: string, version: number, body: PatchNpiBody) => Promise<NpiActionResult>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [reason, setReason] = useState("");
  // Resultado del piloto: opcional al pasar de piloto a evaluación.
  const [pilotResult, setPilotResult] = useState("");
  const [busy, setBusy] = useState(false);

  const transitions = transitionsFor(candidate.stage);
  const hasGatedOnly = transitions.length > 0 && transitions.every((t) => t.gated);

  const run = async (target: Exclude<NpiStage, "proposed">) => {
    setBusy(true);
    const body: PatchNpiBody = { stage: target };
    if (target === "rejected") body.reason = reason.trim();
    if (candidate.stage === "pilot" && target === "evaluation" && pilotResult.trim()) {
      body.pilotResult = pilotResult.trim();
    }
    const result = await onPatch(candidate.id, candidate.version, body);
    setBusy(false);
    if (result.ok) {
      toast.success(`Candidato en “${NPI_STAGE_UI[result.candidate.stage].label}”`);
      onClose();
      return;
    }
    const info = result.error;
    if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
      toast.warning("El candidato cambió en otra sesión; se recargaron los datos");
      onClose();
      return;
    }
    toast.error(describePurchaseBffError(info));
  };

  const st = NPI_STAGE_UI[candidate.stage];
  const risk = RISK_UI[candidate.risk];

  const footer =
    mode === "reject" ? (
      <>
        <Button variant="secondary" disabled={busy} onClick={() => setMode("view")}>
          Volver
        </Button>
        <Button
          disabled={busy || reason.trim().length < 5}
          onClick={() => void run("rejected")}
        >
          {busy ? "Rechazando…" : "Rechazar candidato"}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        {transitions.map((t) => {
          if (t.gated && !canApprove) return null;
          if (t.target === "rejected") {
            return (
              <Button
                key={t.target}
                variant={t.variant}
                disabled={busy}
                onClick={() => setMode("reject")}
              >
                {t.label}
              </Button>
            );
          }
          return (
            <Button
              key={t.target}
              variant={t.variant}
              disabled={busy}
              onClick={() => void run(t.target)}
            >
              {busy ? "Aplicando…" : t.label}
            </Button>
          );
        })}
      </>
    );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={candidate.name}
      description={`${candidate.id} · ${candidate.categoryName ?? "Sin categoría"} · ${
        candidate.supplierName ?? candidate.supplierRef ?? "Proveedor —"
      }`}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Pipeline lineal (rejected es terminal, se marca aparte). */}
        {candidate.stage === "rejected" ? (
          <Badge tone="neutral" dot>
            Rechazada
          </Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {NPI_PIPELINE.map((s, i) => {
              const meta = NPI_STAGE_UI[s];
              const done = meta.order < st.order;
              const current = s === candidate.stage;
              return (
                <div key={s} className="flex items-center gap-1">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      current
                        ? "bg-brand-600 text-white"
                        : done
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {meta.label}
                  </span>
                  {i < NPI_PIPELINE.length - 1 && <span className="text-slate-300">›</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          <DField
            label="Costo"
            value={candidate.costClp != null ? formatCurrency(candidate.costClp) : "—"}
          />
          <DField
            label="Precio sugerido"
            value={
              candidate.suggestedPriceClp != null
                ? formatCurrency(candidate.suggestedPriceClp)
                : "—"
            }
          />
          <DField label="Margen" value={marginLabel(candidate)} />
          <DField
            label="Compra inicial"
            value={candidate.initialBuyQty != null ? `${formatNumber(candidate.initialBuyQty)} u.` : "—"}
          />
          <DField
            label="Tiendas piloto"
            value={candidate.pilotStores != null ? String(candidate.pilotStores) : "—"}
          />
          <DField
            label="Pronóstico inicial"
            value={
              candidate.initialForecastMonthly != null
                ? `${formatNumber(candidate.initialForecastMonthly)}/mes`
                : "—"
            }
          />
          <div>
            <p className="text-xs text-slate-400">Riesgo</p>
            <Badge tone={risk.tone}>{risk.label}</Badge>
          </div>
          <div>
            <p className="text-xs text-slate-400">Proveedor</p>
            {candidate.supplierRef ? (
              <Link
                to={supplierPath(candidate.supplierRef)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {candidate.supplierName ?? candidate.supplierRef}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-800">
                {candidate.supplierName ?? "—"}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400">Comparable</p>
            {candidate.comparableSku ? (
              <Link
                to={productPath(candidate.comparableSku)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {candidate.comparableSku}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-800">—</p>
            )}
          </div>
        </div>

        {candidate.categoryId && (
          <div>
            <Link
              to={categoryPath(candidate.categoryId)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              Ver categoría
            </Link>
          </div>
        )}

        {candidate.targetMarket && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mercado objetivo
            </p>
            <p className="mt-1 text-sm text-slate-700">{candidate.targetMarket}</p>
          </div>
        )}

        {candidate.pilotResult && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resultado del piloto
            </p>
            <p className="mt-1 text-sm text-slate-700">{candidate.pilotResult}</p>
          </div>
        )}

        {candidate.stage === "rejected" && candidate.stageReason && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Motivo del rechazo
            </p>
            <p className="mt-1 text-sm text-slate-700">{candidate.stageReason}</p>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Creado {formatDate(candidate.dateCreated.slice(0, 10))} · actualizado{" "}
          {formatDate(candidate.dateModified.slice(0, 10))}
        </p>

        {mode === "view" && candidate.stage === "pilot" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Resultado del piloto (opcional, se guarda al pasar a evaluación)
            </label>
            <textarea
              value={pilotResult}
              onChange={(e) => setPilotResult(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Ej: 112% del pronóstico en 30 días; buena rotación."
            />
          </div>
        )}

        {mode === "reject" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Motivo del rechazo (obligatorio, mínimo 5 caracteres)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Ej: no supera el pronóstico ni cubre el margen objetivo."
            />
          </div>
        )}

        {mode === "view" && hasGatedOnly && !canApprove && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <IconLock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span>
              Aprobar, escalar o rechazar requiere el permiso{" "}
              <b className="text-slate-700">purchase:npi:approve</b> en tu sesión.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
//  Proponer candidato: POST /npi (nace en "Propuesta"; riesgo obligatorio).
// ----------------------------------------------------------------------------

function CreateNpiModal({
  onCreate,
  onClose,
}: {
  onCreate: (body: CreateNpiBody) => Promise<NpiActionResult>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [risk, setRisk] = useState<NpiRisk>("medium");
  const [categoryName, setCategoryName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [comparableSku, setComparableSku] = useState("");
  const [costClp, setCostClp] = useState("");
  const [suggestedPriceClp, setSuggestedPriceClp] = useState("");
  const [initialBuyQty, setInitialBuyQty] = useState("");
  const [pilotStores, setPilotStores] = useState("");
  const [initialForecastMonthly, setInitialForecastMonthly] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const num = (v: string): number | undefined => {
    const n = Number(v);
    return v.trim() && Number.isFinite(n) ? n : undefined;
  };

  const submit = async () => {
    if (!name.trim()) {
      setFormError("El nombre del producto es obligatorio.");
      return;
    }
    setFormError("");
    setBusy(true);
    const body: CreateNpiBody = {
      name: name.trim(),
      risk,
      ...(categoryName.trim() ? { categoryName: categoryName.trim() } : {}),
      ...(supplierName.trim() ? { supplierName: supplierName.trim() } : {}),
      ...(supplierRef.trim() ? { supplierRef: supplierRef.trim() } : {}),
      ...(comparableSku.trim() ? { comparableSku: comparableSku.trim() } : {}),
      ...(targetMarket.trim() ? { targetMarket: targetMarket.trim() } : {}),
      ...(num(costClp) !== undefined ? { costClp: num(costClp) } : {}),
      ...(num(suggestedPriceClp) !== undefined ? { suggestedPriceClp: num(suggestedPriceClp) } : {}),
      ...(num(initialBuyQty) !== undefined ? { initialBuyQty: num(initialBuyQty) } : {}),
      ...(num(pilotStores) !== undefined ? { pilotStores: num(pilotStores) } : {}),
      ...(num(initialForecastMonthly) !== undefined
        ? { initialForecastMonthly: num(initialForecastMonthly) }
        : {}),
    };
    const result = await onCreate(body);
    setBusy(false);
    if (result.ok) {
      toast.success(`Candidato propuesto: ${result.candidate.name}`);
      onClose();
      return;
    }
    setFormError(describePurchaseBffError(result.error));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Proponer nuevo producto"
      description="Nace en “Propuesta”; el riesgo es obligatorio."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || !name.trim()} onClick={() => void submit()}>
            {busy ? "Proponiendo…" : "Proponer"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {formError && (
          <p role="alert" className="text-xs text-rose-600">
            {formError}
          </p>
        )}
        <Input
          label="Nombre del producto (obligatorio)"
          placeholder="Ej: Taladro inalámbrico brushless 20V"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Riesgo (obligatorio)"
            value={risk}
            onChange={(e) => setRisk(e.target.value as NpiRisk)}
            options={[
              { value: "low", label: "Bajo" },
              { value: "medium", label: "Medio" },
              { value: "high", label: "Alto" },
            ]}
          />
          <Input
            label="Categoría (opcional)"
            placeholder="Ej: Herramientas eléctricas"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <Input
            label="Proveedor (opcional)"
            placeholder="Ej: Herramientas Global"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
          <Input
            label="Ref. proveedor (opcional)"
            placeholder="SUP-…"
            value={supplierRef}
            onChange={(e) => setSupplierRef(e.target.value)}
          />
          <Input
            label="Costo CLP (opcional)"
            type="number"
            placeholder="38900"
            value={costClp}
            onChange={(e) => setCostClp(e.target.value)}
          />
          <Input
            label="Precio sugerido CLP (opcional)"
            type="number"
            placeholder="69990"
            value={suggestedPriceClp}
            onChange={(e) => setSuggestedPriceClp(e.target.value)}
          />
          <Input
            label="Compra inicial (u., opcional)"
            type="number"
            placeholder="120"
            value={initialBuyQty}
            onChange={(e) => setInitialBuyQty(e.target.value)}
          />
          <Input
            label="Tiendas piloto (opcional)"
            type="number"
            placeholder="6"
            value={pilotStores}
            onChange={(e) => setPilotStores(e.target.value)}
          />
          <Input
            label="Pronóstico mensual (u., opcional)"
            type="number"
            placeholder="45"
            value={initialForecastMonthly}
            onChange={(e) => setInitialForecastMonthly(e.target.value)}
          />
          <Input
            label="SKU comparable (opcional)"
            placeholder="001001016"
            value={comparableSku}
            onChange={(e) => setComparableSku(e.target.value)}
          />
        </div>
        <Input
          label="Mercado objetivo (opcional)"
          placeholder="Ej: maestro y profesional; complementa la línea Bosch"
          value={targetMarket}
          onChange={(e) => setTargetMarket(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function DField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
