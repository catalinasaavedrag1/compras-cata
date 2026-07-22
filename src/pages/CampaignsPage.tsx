import { useMemo, useState } from "react";
import { CampaignPerformance } from "./CampaignPerformance";
import {
  CampaignSummaryCard,
  AdSpacesHeader,
  ChannelFilterChips,
  AdSpacesView,
} from "./CampaignsSections";
import { CreateCampaignModal, EditCampaignModal } from "./CampaignsModals";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { HelpNote } from "../components/business/HelpNote";
import { IconPlus, IconCampaign } from "../components/ui/icons";
import { useToast } from "../context/ToastContext";
import { useCampaignsList, useCampaignCommands } from "../hooks/useCampaigns";
import { describePurchaseBffError, type CampaignStatus, type CampaignView } from "../services/purchaseBff";
import { daysUntil, CAMPAIGN_STATUS_UI } from "./campaignsHelpers";

// ============================================================================
//  Campañas conectadas al purchase-bff-service (F18): GET/POST /campaigns y
//  PATCH con If-Match para el ciclo planned → active → closed | cancelled.
//  Los "espacios publicitarios" del mock se modelan como campañas reales
//  type 'ad_space' con channelRef. Los planes por producto, cupos por
//  placement y el reparto de presupuesto por canal no existen en el contrato
//  y se eliminaron (sin números inventados).
// ============================================================================

export function CampaignsPage() {
  const toast = useToast();
  const { campaigns, configured, loading, error, refetch } = useCampaignsList();
  const commands = useCampaignCommands({ onConflict: refetch });

  const [selId, setSelId] = useState<string | null>(null);
  const [tab, setTab] = useState<"plan" | "perf">("plan");
  const [spaceView, setSpaceView] = useState<"grid" | "list">("grid");
  const [chFilter, setChFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignView | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1)),
    [campaigns]
  );
  const camp = sorted.find((c) => c.id === selId) ?? sorted[0];

  // Espacios publicitarios: campañas reales type 'ad_space'.
  const adSpaces = useMemo(() => sorted.filter((c) => c.type === "ad_space"), [sorted]);
  const channels = useMemo(
    () => [...new Set(adSpaces.map((c) => c.channelRef ?? "sin-canal"))],
    [adSpaces]
  );
  const chips = [
    { id: "all", label: "Todos" },
    ...channels.map((ch) => ({ id: ch, label: ch === "sin-canal" ? "Sin canal" : ch })),
  ];
  const countByKey = (k: string) =>
    adSpaces.filter((c) => k === "all" || (c.channelRef ?? "sin-canal") === k).length;
  const spaces = adSpaces.filter(
    (c) => chFilter === "all" || (c.channelRef ?? "sin-canal") === chFilter
  );

  const transition = async (target: CampaignView, status: Exclude<CampaignStatus, "planned">) => {
    setBusy(true);
    const res = await commands.transitionCampaign(target.id, target.version, status);
    setBusy(false);
    if (res.ok) {
      toast.success(`"${target.title}" → ${CAMPAIGN_STATUS_UI[status].label.toLowerCase()}`);
      refetch();
    } else {
      toast.error(describePurchaseBffError(res.error));
    }
  };

  const create = async (input: Parameters<typeof commands.createCampaign>[0]) => {
    setBusy(true);
    const res = await commands.createCampaign(input);
    setBusy(false);
    if (res.ok) {
      toast.success(`Campaña "${res.campaign.title}" creada`);
      setCreateOpen(false);
      setSelId(res.campaign.id);
      refetch();
    } else {
      toast.error(describePurchaseBffError(res.error));
    }
  };

  const saveEdit = async (body: { budgetClp?: number; endsAt?: string }) => {
    if (!editing) return;
    setBusy(true);
    const res = await commands.updateCampaign(editing.id, editing.version, body);
    setBusy(false);
    if (res.ok) {
      toast.success(`Cambios guardados en "${editing.title}"`);
      setEditing(null);
      refetch();
    } else {
      toast.error(describePurchaseBffError(res.error));
    }
  };

  const pageTitle = "Campañas y descuentos";
  const pageDescription =
    "Gestiona cada campaña real: título, canal, presupuesto, vigencia y ciclo de vida. Los espacios publicitarios se administran como campañas por canal.";

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
              ver las campañas reales y gestionarlas contra el servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && campaigns.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando campañas">
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

  if (error && campaigns.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las campañas
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
        action={
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            Crear campaña
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<IconCampaign className="w-6 h-6" />}
              title="Aún no hay campañas"
              description="Crea la primera campaña: un espacio publicitario por canal con su vigencia y presupuesto. Las campañas ligadas a oportunidades se crean desde Anticipación de campañas."
              action={
                <Button onClick={() => setCreateOpen(true)} icon={<IconPlus className="w-4 h-4" />}>
                  Crear campaña
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* selector de campañas */}
          <div className="flex flex-wrap gap-2.5 mb-4">
            {sorted.map((c) => {
              const active = camp && c.id === camp.id;
              const du = daysUntil(c.startsAt);
              const st = CAMPAIGN_STATUS_UI[c.status];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelId(c.id)}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-2.5 min-w-[140px] ${active ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <span
                    className={`text-sm font-semibold ${active ? "text-brand-700" : "text-slate-700"}`}
                  >
                    {c.title}
                  </span>
                  <span className={`text-xs ${active ? "text-brand-500" : "text-slate-400"}`}>
                    {c.status === "planned" && du > 0 ? `en ${du} d` : st.label.toLowerCase()}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setCreateOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 min-w-[130px] text-brand-600 hover:border-brand-400 hover:bg-brand-50/40"
            >
              <IconPlus className="w-4 h-4" />
              <span className="text-xs font-semibold">Crear campaña</span>
            </button>
          </div>

          {/* resumen de la campaña seleccionada */}
          {camp && (
            <CampaignSummaryCard
              camp={camp}
              busy={busy}
              onTransition={(status) => transition(camp, status)}
              onEdit={() => setEditing(camp)}
            />
          )}

          {/* tabs: planificación vs rendimiento */}
          <Tabs
            className="mb-5"
            value={tab}
            onChange={(v) => setTab(v as "plan" | "perf")}
            tabs={[
              { value: "plan", label: "Espacios publicitarios", count: adSpaces.length },
              { value: "perf", label: "Rendimiento" },
            ]}
          />

          {tab === "plan" ? (
            <>
              <HelpNote className="mb-4">
                El detalle por producto en descuento, los cupos por ubicación y el reparto de
                presupuesto por canal no tienen fuente en el servicio de compras todavía; aquí se
                gestionan los espacios publicitarios reales (campañas por canal).
              </HelpNote>

              <AdSpacesHeader
                total={adSpaces.length}
                active={adSpaces.filter((c) => c.status === "active").length}
                spaceView={spaceView}
                onSpaceViewChange={setSpaceView}
              />

              <ChannelFilterChips
                chips={chips}
                chFilter={chFilter}
                onChange={setChFilter}
                countByKey={countByKey}
              />

              <AdSpacesView
                spaces={spaces}
                spaceView={spaceView}
                busy={busy}
                onTransition={transition}
                onCreate={() => setCreateOpen(true)}
              />
            </>
          ) : (
            camp && <CampaignPerformance camp={camp} />
          )}
        </>
      )}

      {/* Modal crear espacio publicitario (type 'ad_space') */}
      <CreateCampaignModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={create}
        busy={busy}
      />

      {/* Modal editar presupuesto / fecha fin */}
      <EditCampaignModal
        camp={editing}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        busy={busy}
      />
    </div>
  );
}
