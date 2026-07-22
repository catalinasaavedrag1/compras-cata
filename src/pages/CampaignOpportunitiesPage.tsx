import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { productPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card } from "../components/ui/Card";
import { DataTable, makeToggleSort, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { ExportButton } from "../components/business/ExportButton";
import { uniqueValues } from "../utils/filters";
import { formatDate, formatNumber } from "../utils/formatters";
import { useToast } from "../context/ToastContext";
import { OPPORTUNITY_TYPE_LABELS } from "../components/business/campaignLabels";
import { IconAlerts, IconCampaign, IconCheck, IconPlus, IconReplenish } from "../components/ui/icons";
import {
  describePurchaseBffError,
  type CampaignOpportunityStatus,
  type CampaignOpportunityView,
  type CampaignStatus,
  type CampaignView,
} from "../services/purchaseBff";
import {
  useCampaignCommands,
  useCampaignOpportunities,
  useCampaignsList,
} from "../hooks/useCampaigns";
import {
  OPPORTUNITY_STATUS_UI,
  daysUntil,
  evidenceSummary,
  kindLabel,
  opportunityRefText,
} from "./campaignsHelpers";
import { CreatedCampaignsView } from "./campaignOpportunities/CreatedCampaignsView";

// ============================================================================
//  Anticipación de campañas conectada al purchase-bff-service (F18).
//  El pipeline visual de 9 etapas del mock se colapsa a la máquina real de
//  5 estados: detected → planned → active → closed | dismissed (descartar
//  exige motivo auditable). Las métricas de stock/venta/margen por SKU del
//  mock no existen en el contrato y se eliminaron sin inventar números; la
//  evidencia libre de cada oportunidad se muestra tal cual.
// ============================================================================

/** Orden de urgencia para la tabla (menor = más urgente). */
const STATUS_ORDER: Record<CampaignOpportunityStatus, number> = {
  detected: 0,
  planned: 1,
  active: 2,
  closed: 3,
  dismissed: 4,
};

const fmtDate = (iso: string) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Texto honesto de la ventana: cuánto falta, en curso o terminada. */
function windowText(o: CampaignOpportunityView): { label: string; urgent: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  if (o.windowTo.slice(0, 10) < today) return { label: "terminó", urgent: false };
  if (o.windowFrom.slice(0, 10) <= today) return { label: "en curso", urgent: true };
  const d = daysUntil(o.windowFrom);
  return { label: `en ${d} d`, urgent: d <= 7 };
}

interface OpportunityForm {
  kind: string;
  sku: string;
  categoryId: string;
  channelRef: string;
  from: string;
  to: string;
  note: string;
}

interface CampaignForm {
  opportunity: CampaignOpportunityView;
  title: string;
  budget: string;
  from: string;
  to: string;
}

export function CampaignOpportunitiesPage() {
  const toast = useToast();
  const opps = useCampaignOpportunities();
  const camps = useCampaignsList();
  const refetchAll = () => {
    opps.refetch();
    camps.refetch();
  };
  const commands = useCampaignCommands({ onConflict: refetchAll });

  const [view, setView] = useState<"oportunidades" | "campanas">("oportunidades");
  const [sort, setSort] = useState<SortState>({ key: null, dir: "desc" });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [oppForm, setOppForm] = useState<OpportunityForm | null>(null);
  const [dismissing, setDismissing] = useState<CampaignOpportunityView | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [campForm, setCampForm] = useState<CampaignForm | null>(null);

  const all = opps.opportunities;

  const filtered = useMemo(() => {
    const result = all.filter((o) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${o.sku ?? ""} ${o.categoryId ?? ""} ${o.channelRef ?? ""} ${o.kind} ${kindLabel(o.kind)}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      if (kind && o.kind !== kind) return false;
      if (status && o.status !== status) return false;
      return true;
    });
    return [...result].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.windowFrom < b.windowFrom ? -1 : 1)
    );
  }, [all, query, kind, status]);

  // KPIs sobre la máquina real de estados.
  const detected = all.filter((o) => o.status === "detected").length;
  const planned = all.filter((o) => o.status === "planned").length;
  const active = all.filter((o) => o.status === "active").length;
  const withCampaigns = all.filter((o) => o.campaignCount > 0).length;

  const countBy = (s: CampaignOpportunityStatus) => all.filter((o) => o.status === s).length;

  // ---- comandos ----
  const transitionOpp = async (
    o: CampaignOpportunityView,
    target: Exclude<CampaignOpportunityStatus, "detected">,
    reason?: string
  ): Promise<boolean> => {
    setBusy(true);
    const res = await commands.transitionOpportunity(o.id, o.version, target, reason);
    setBusy(false);
    if (res.ok) {
      toast.success(
        `${opportunityRefText(o)}: ${OPPORTUNITY_STATUS_UI[target].label.toLowerCase()}`
      );
      opps.refetch();
      return true;
    }
    toast.error(describePurchaseBffError(res.error));
    return false;
  };

  const submitOppForm = async () => {
    if (!oppForm) return;
    const f = oppForm;
    const hasTarget = !!(f.sku.trim() || f.categoryId.trim() || f.channelRef.trim());
    if (!f.kind || !hasTarget || !f.from || !f.to || f.to < f.from) {
      toast.warning("Completa tipo, ventana y al menos SKU, categoría o canal");
      return;
    }
    setBusy(true);
    const res = await commands.createOpportunity({
      kind: f.kind,
      ...(f.sku.trim() ? { sku: f.sku.trim() } : {}),
      ...(f.categoryId.trim() ? { categoryId: f.categoryId.trim() } : {}),
      ...(f.channelRef.trim() ? { channelRef: f.channelRef.trim() } : {}),
      windowFrom: f.from,
      windowTo: f.to,
      evidence: f.note.trim() ? { note: f.note.trim() } : {},
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Oportunidad ${opportunityRefText(res.opportunity)} registrada`);
      setOppForm(null);
      opps.refetch();
    } else {
      // Duplicada viva ⇒ 409 con el mensaje del backend (details.existingId).
      toast.error(describePurchaseBffError(res.error));
    }
  };

  const submitDismiss = async () => {
    if (!dismissing) return;
    if (dismissReason.trim().length < 5) {
      toast.warning("El motivo del descarte debe tener al menos 5 caracteres");
      return;
    }
    const ok = await transitionOpp(dismissing, "dismissed", dismissReason.trim());
    if (ok) {
      setDismissing(null);
      setDismissReason("");
    }
  };

  const openCampaignForm = (o: CampaignOpportunityView) => {
    setCampForm({
      opportunity: o,
      title: "",
      budget: "",
      from: o.windowFrom.slice(0, 10),
      to: o.windowTo.slice(0, 10),
    });
  };

  const submitCampaignForm = async () => {
    if (!campForm) return;
    const f = campForm;
    if (!f.title.trim() || !f.from || !f.to || f.to < f.from) {
      toast.warning("Completa título y fechas de la campaña");
      return;
    }
    const budgetClp = parseInt(f.budget, 10) || 0;
    setBusy(true);
    const res = await commands.createCampaign({
      type: "opportunity",
      title: f.title.trim(),
      opportunityId: f.opportunity.id,
      startsAt: f.from,
      endsAt: f.to,
      ...(budgetClp > 0 ? { budgetClp } : {}),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Campaña "${res.campaign.title}" creada desde la oportunidad`);
      setCampForm(null);
      setView("campanas");
      refetchAll();
    } else {
      toast.error(describePurchaseBffError(res.error));
    }
  };

  const transitionCampaign = async (c: CampaignView, target: Exclude<CampaignStatus, "planned">) => {
    setBusy(true);
    const res = await commands.transitionCampaign(c.id, c.version, target);
    setBusy(false);
    if (res.ok) {
      toast.success(`"${c.title}" actualizada`);
      refetchAll();
    } else {
      toast.error(describePurchaseBffError(res.error));
    }
  };

  const opportunityRefById = (opportunityId: string | null): string | null => {
    if (!opportunityId) return null;
    const o = all.find((x) => x.id === opportunityId);
    return o ? `${kindLabel(o.kind)} · ${opportunityRefText(o)}` : null;
  };

  const openOppForm = () => {
    setOppForm({
      kind: "planned_campaign",
      sku: "",
      categoryId: "",
      channelRef: "",
      from: "",
      to: "",
      note: "",
    });
  };

  const handleSort = makeToggleSort(setSort);

  const clearFilters = () => {
    setQuery("");
    setKind("");
    setStatus("");
  };

  const pageTitle = "Anticipación de campañas";
  const pageDescription =
    "Oportunidades comerciales detectadas por SKU, categoría o canal: decide cuáles planificar, actívalas en su ventana y crea campañas ligadas a cada una.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!opps.configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver las oportunidades de campaña reales y gestionarlas contra el servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (opps.loading && all.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando oportunidades">
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

  if (opps.error && all.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las oportunidades
            </p>
            <p className="mt-1 text-sm text-slate-500">{opps.error.message}</p>
            <Button className="mt-4" onClick={opps.refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const columns: Column<CampaignOpportunityView>[] = [
    {
      key: "ref",
      header: "Referencia",
      sortable: true,
      sortValue: (o) => opportunityRefText(o),
      render: (o) => (
        <div className="min-w-[180px]">
          {o.sku ? (
            <Link
              to={productPath(o.sku)}
              className="font-medium text-slate-800 leading-snug hover:text-brand-700 hover:underline block"
              onClick={(e) => e.stopPropagation()}
            >
              {o.sku}
            </Link>
          ) : (
            <p className="font-medium text-slate-800 leading-snug">{opportunityRefText(o)}</p>
          )}
          <p className="text-xs text-slate-500">
            {[
              o.sku ? "SKU" : null,
              o.categoryId ? `Categoría ${o.categoryId}` : null,
              o.channelRef ? `Canal ${o.channelRef}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Sin referencia"}
          </p>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Oportunidad",
      render: (o) => <Badge tone="blue">{kindLabel(o.kind)}</Badge>,
    },
    {
      key: "window",
      header: "Ventana",
      hideOnMobile: true,
      sortable: true,
      sortValue: (o) => o.windowFrom,
      render: (o) => (
        <div className="text-sm min-w-[140px]">
          <p className="text-slate-700">
            {fmtDate(o.windowFrom)} → {fmtDate(o.windowTo)}
          </p>
          {(() => {
            const w = windowText(o);
            return (
              <p className={`text-xs ${w.urgent ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                {w.label}
              </p>
            );
          })()}
        </div>
      ),
    },
    {
      key: "evidence",
      header: "Evidencia",
      hideOnMobile: true,
      render: (o) => (
        <p className="max-w-xs text-xs text-slate-600 leading-snug">
          {evidenceSummary(o.evidence)}
        </p>
      ),
    },
    {
      key: "campaigns",
      header: "Campañas",
      align: "right",
      sortable: true,
      sortValue: (o) => o.campaignCount,
      render: (o) =>
        o.campaignCount > 0 ? (
          <span className="font-semibold text-slate-800">{formatNumber(o.campaignCount)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      render: (o) => (
        <Badge tone={OPPORTUNITY_STATUS_UI[o.status].tone} dot>
          {OPPORTUNITY_STATUS_UI[o.status].label}
        </Badge>
      ),
    },
    {
      key: "modified",
      header: "Actualizada",
      hideOnMobile: true,
      sortable: true,
      sortValue: (o) => o.dateModified,
      render: (o) => <span className="text-xs text-slate-500">{fmtDate(o.dateModified)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (o) => {
        const buttons: { label: string; primary?: boolean; onClick: () => void }[] = [];
        if (o.status === "detected")
          buttons.push({
            label: "Planificar",
            primary: true,
            onClick: () => void transitionOpp(o, "planned"),
          });
        if (o.status === "planned")
          buttons.push({
            label: "Activar",
            primary: true,
            onClick: () => void transitionOpp(o, "active"),
          });
        if (o.status === "planned" || o.status === "active")
          buttons.push({ label: "Crear campaña", onClick: () => openCampaignForm(o) });
        if (o.status === "active")
          buttons.push({ label: "Cerrar", onClick: () => void transitionOpp(o, "closed") });
        if (o.status === "detected" || o.status === "planned" || o.status === "active")
          buttons.push({ label: "Descartar", onClick: () => setDismissing(o) });
        if (buttons.length === 0) return <span className="text-slate-300 text-xs">—</span>;
        return (
          <div className="flex flex-col gap-1 items-stretch min-w-[140px]">
            {buttons.map((b) => (
              <Button
                key={b.label}
                size="sm"
                variant={b.primary ? "primary" : "secondary"}
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  b.onClick();
                }}
                icon={b.primary ? <IconCheck className="w-3.5 h-3.5" /> : undefined}
              >
                {b.label}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              filename="campanas-oportunidades"
              rows={filtered}
              columns={[
                { label: "ID", value: (o) => o.id },
                { label: "Tipo", value: (o) => kindLabel(o.kind) },
                { label: "SKU", value: (o) => o.sku ?? "" },
                { label: "Categoría", value: (o) => o.categoryId ?? "" },
                { label: "Canal", value: (o) => o.channelRef ?? "" },
                { label: "Ventana desde", value: (o) => o.windowFrom.slice(0, 10) },
                { label: "Ventana hasta", value: (o) => o.windowTo.slice(0, 10) },
                { label: "Estado", value: (o) => OPPORTUNITY_STATUS_UI[o.status].label },
                { label: "Campañas", value: (o) => o.campaignCount },
              ]}
            />
            <Button onClick={openOppForm} icon={<IconPlus className="w-4 h-4" />}>
              Registrar oportunidad
            </Button>
          </div>
        }
      />

      <Tabs
        className="mb-5"
        value={view}
        onChange={(v) => setView(v as typeof view)}
        tabs={[
          { value: "oportunidades", label: "Oportunidades detectadas", count: all.length },
          { value: "campanas", label: "Campañas creadas", count: camps.campaigns.length },
        ]}
      />

      {view === "campanas" ? (
        camps.loading && camps.campaigns.length === 0 ? (
          <Card>
            <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando campañas">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </Card>
        ) : camps.error && camps.campaigns.length === 0 ? (
          <Card>
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-slate-800">
                No se pudieron cargar las campañas
              </p>
              <p className="mt-1 text-sm text-slate-500">{camps.error.message}</p>
              <Button className="mt-4" onClick={camps.refetch}>
                Reintentar
              </Button>
            </div>
          </Card>
        ) : (
          <CreatedCampaignsView
            campaigns={camps.campaigns}
            opportunityRef={opportunityRefById}
            busy={busy}
            onCreate={openOppForm}
            onTransition={transitionCampaign}
          />
        )
      ) : (
        <>
          {/* KPIs compactos (escritorio), cliqueables → filtran por estado real */}
          <div className="hidden md:grid md:grid-cols-4 gap-3 mb-4">
            <KpiCard
              title="Detectadas"
              value={formatNumber(detected)}
              tone="warn"
              icon={<IconAlerts className="w-4 h-4" />}
              description="Por decidir"
              active={status === "detected"}
              onClick={() => setStatus(status === "detected" ? "" : "detected")}
            />
            <KpiCard
              title="Planificadas"
              value={formatNumber(planned)}
              tone="info"
              icon={<IconReplenish className="w-4 h-4" />}
              description="Listas para campaña"
              active={status === "planned"}
              onClick={() => setStatus(status === "planned" ? "" : "planned")}
            />
            <KpiCard
              title="En campaña"
              value={formatNumber(active)}
              tone="good"
              icon={<IconCampaign className="w-4 h-4" />}
              description="Ventana en curso"
              active={status === "active"}
              onClick={() => setStatus(status === "active" ? "" : "active")}
            />
            <KpiCard
              title="Con campañas creadas"
              value={formatNumber(withCampaigns)}
              tone="neutral"
              icon={<IconCheck className="w-4 h-4" />}
              description="Ya tienen campaña asociada"
            />
          </div>

          {/* Foco por estado (máquina real de 5 estados) */}
          <Tabs
            className="mb-4"
            value={status || "all"}
            onChange={(v) => setStatus(v === "all" ? "" : v)}
            tabs={[
              { value: "all", label: "Todas", count: all.length },
              { value: "detected", label: "Detectadas", count: countBy("detected") },
              { value: "planned", label: "Planificadas", count: countBy("planned") },
              { value: "active", label: "En campaña", count: countBy("active") },
              { value: "closed", label: "Cerradas", count: countBy("closed") },
              { value: "dismissed", label: "Descartadas", count: countBy("dismissed") },
            ]}
          />

          {/* Tabla principal */}
          <div id="tabla" className="mb-4">
            <FilterBar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Buscar por SKU, categoría, canal o tipo"
              resultCount={filtered.length}
              onClear={clearFilters}
              selects={[
                {
                  key: "kind",
                  placeholder: "Tipo de oportunidad",
                  value: kind,
                  onChange: setKind,
                  options: uniqueValues(all, (o) => o.kind).map((k) => ({
                    value: k,
                    label: kindLabel(k),
                  })),
                },
                {
                  key: "status",
                  placeholder: "Estado",
                  value: status,
                  onChange: setStatus,
                  options: (
                    Object.keys(OPPORTUNITY_STATUS_UI) as CampaignOpportunityStatus[]
                  ).map((s) => ({ value: s, label: OPPORTUNITY_STATUS_UI[s].label })),
                },
              ]}
            />
          </div>

          <Card>
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(o) => o.id}
              sort={sort}
              onSortChange={handleSort}
              rowClassName={(o) => (o.status === "detected" ? "bg-amber-50/40" : undefined)}
              emptyMessage="No hay oportunidades que coincidan con los filtros."
              mobileCard={(o) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 leading-snug">
                        {opportunityRefText(o)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {kindLabel(o.kind)} · {fmtDate(o.windowFrom)} → {fmtDate(o.windowTo)}
                      </p>
                    </div>
                    <Badge tone={OPPORTUNITY_STATUS_UI[o.status].tone} dot>
                      {OPPORTUNITY_STATUS_UI[o.status].label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Campañas</p>
                      <p className="text-slate-700">
                        {o.campaignCount > 0 ? formatNumber(o.campaignCount) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Ventana</p>
                      <p className="text-slate-700">{windowText(o).label}</p>
                    </div>
                  </div>
                  {evidenceSummary(o.evidence) !== "—" && (
                    <p className="text-xs text-slate-500 mt-1.5">{evidenceSummary(o.evidence)}</p>
                  )}
                </div>
              )}
            />
          </Card>
        </>
      )}

      {/* Modal registrar oportunidad (POST /campaign-opportunities) */}
      <Modal
        open={!!oppForm}
        onClose={() => setOppForm(null)}
        title="Registrar oportunidad"
        description="Exige al menos un SKU, categoría o canal, más la ventana comercial. Una oportunidad viva duplicada es rechazada por el servicio."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOppForm(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void submitOppForm()} disabled={busy}>
              {busy ? "Registrando…" : "Registrar"}
            </Button>
          </>
        }
      >
        {oppForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Tipo de oportunidad
              </label>
              <Select
                value={oppForm.kind}
                onChange={(e) => setOppForm((f) => f && { ...f, kind: e.target.value })}
                options={Object.entries(OPPORTUNITY_TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">SKU</label>
                <Input
                  value={oppForm.sku}
                  onChange={(e) => setOppForm((f) => f && { ...f, sku: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Categoría
                </label>
                <Input
                  value={oppForm.categoryId}
                  onChange={(e) => setOppForm((f) => f && { ...f, categoryId: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Canal</label>
                <Input
                  value={oppForm.channelRef}
                  onChange={(e) => setOppForm((f) => f && { ...f, channelRef: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Ventana desde
                </label>
                <Input
                  type="date"
                  value={oppForm.from}
                  onChange={(e) => setOppForm((f) => f && { ...f, from: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Ventana hasta
                </label>
                <Input
                  type="date"
                  value={oppForm.to}
                  onChange={(e) => setOppForm((f) => f && { ...f, to: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Evidencia (nota)
              </label>
              <textarea
                value={oppForm.note}
                onChange={(e) => setOppForm((f) => f && { ...f, note: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
                placeholder="Por qué es una oportunidad (opcional)"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal descartar con motivo auditable (PATCH dismissed) */}
      <Modal
        open={!!dismissing}
        onClose={() => {
          setDismissing(null);
          setDismissReason("");
        }}
        title="Descartar oportunidad"
        description={
          dismissing
            ? `Vas a descartar ${opportunityRefText(dismissing)} (${kindLabel(dismissing.kind)}). El motivo queda auditado.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDismissing(null);
                setDismissReason("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => void submitDismiss()}
              disabled={busy || dismissReason.trim().length < 5}
            >
              {busy ? "Descartando…" : "Descartar"}
            </Button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Motivo (mínimo 5 caracteres)
          </label>
          <textarea
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
            placeholder="Ej: sin stock del proveedor para la ventana"
          />
        </div>
      </Modal>

      {/* Modal crear campaña desde la oportunidad (POST /campaigns type 'opportunity') */}
      <Modal
        open={!!campForm}
        onClose={() => setCampForm(null)}
        title="Crear campaña desde la oportunidad"
        description={
          campForm
            ? `Ligada a ${opportunityRefText(campForm.opportunity)} (${kindLabel(campForm.opportunity.kind)}).`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setCampForm(null)}>
              Cancelar
            </Button>
            <Button
              icon={<IconPlus className="w-4 h-4" />}
              onClick={() => void submitCampaignForm()}
              disabled={busy}
            >
              {busy ? "Creando…" : "Crear campaña"}
            </Button>
          </>
        }
      >
        {campForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Título</label>
              <Input
                value={campForm.title}
                onChange={(e) => setCampForm((f) => f && { ...f, title: e.target.value })}
                placeholder="Ej: Cyber herramientas"
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Desde</label>
                <Input
                  type="date"
                  value={campForm.from}
                  onChange={(e) => setCampForm((f) => f && { ...f, from: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hasta</label>
                <Input
                  type="date"
                  value={campForm.to}
                  onChange={(e) => setCampForm((f) => f && { ...f, to: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Presupuesto (CLP, opcional)
              </label>
              <div className="max-w-[240px]">
                <Input
                  inputMode="numeric"
                  value={campForm.budget}
                  onChange={(e) =>
                    setCampForm((f) => f && { ...f, budget: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
