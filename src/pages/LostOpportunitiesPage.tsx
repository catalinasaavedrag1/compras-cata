import { useMemo } from "react";
import { useUrlState } from "../utils/useUrlState";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { FilterBar } from "../components/business/FilterBar";
import { InfoHint } from "../components/business/InfoHint";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { productPath } from "../utils/entityLinks";
import { IconBulb } from "../components/ui/icons";
import { formatDate, formatNumber } from "../utils/formatters";
import { useCampaignOpportunities } from "../hooks/useCampaigns";
import { evidenceSummary, kindLabel, opportunityRefText } from "./campaignsHelpers";
import type { CampaignOpportunityView } from "../services/purchaseBff";

// ============================================================================
//  Oportunidades perdidas reales (F18): oportunidades de campaña con estado
//  'dismissed' (descartadas con motivo) y 'closed' sin campañas creadas (la
//  ventana terminó sin activar nada). No existe fuente real de venta perdida
//  por oportunidad: toda métrica monetaria degrada a "—" sin inventar números.
// ============================================================================

type Motivo = "Descartada" | "Cerrada sin campaña";

interface LostRow {
  opp: CampaignOpportunityView;
  motivo: Motivo;
}

const fmtDate = (iso: string) => (iso ? formatDate(iso.slice(0, 10)) : "—");

export function LostOpportunitiesPage() {
  const { opportunities, configured, loading, error, refetch } = useCampaignOpportunities();
  const [query, setQuery] = useUrlState("q");
  const [motivo, setMotivo] = useUrlState("motivo");

  // Perdidas = descartadas + cerradas que nunca tuvieron campaña.
  const all = useMemo<LostRow[]>(() => {
    const rows: LostRow[] = [];
    for (const o of opportunities) {
      if (o.status === "dismissed") rows.push({ opp: o, motivo: "Descartada" });
      else if (o.status === "closed" && o.campaignCount === 0)
        rows.push({ opp: o, motivo: "Cerrada sin campaña" });
    }
    return rows.sort((a, b) => (a.opp.dateModified < b.opp.dateModified ? 1 : -1));
  }, [opportunities]);

  const motivos = useMemo(() => [...new Set(all.map((r) => r.motivo))], [all]);

  const filtered = all.filter((r) => {
    const o = r.opp;
    if (query.trim()) {
      const hay = `${o.sku ?? ""} ${o.categoryId ?? ""} ${o.channelRef ?? ""} ${o.kind} ${kindLabel(o.kind)}`;
      if (!hay.toLowerCase().includes(query.toLowerCase())) return false;
    }
    if (motivo && r.motivo !== motivo) return false;
    return true;
  });

  const dismissedCount = all.filter((r) => r.motivo === "Descartada").length;

  const pageTitle = "Oportunidades perdidas";
  const pageDescription =
    "Oportunidades de campaña que se descartaron con motivo o cuya ventana se cerró sin crear ninguna campaña. Sirve para aprender qué se dejó pasar y por qué.";

  const header = (
    <PageHeader
      title={pageTitle}
      description={pageDescription}
      help={
        <InfoHint label="Qué es una oportunidad perdida">
          <p>
            Una oportunidad detectada que <b>se descartó</b> (con motivo auditable) o que{" "}
            <b>se cerró sin campañas</b>: la ventana comercial pasó y no se activó nada.
          </p>
          <p>
            La venta perdida estimada estará disponible cuando exista la fuente de venta por
            campaña; aquí no se inventan números.
          </p>
        </InfoHint>
      }
    />
  );

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        {header}
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver las oportunidades perdidas reales del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && opportunities.length === 0) {
    return (
      <div>
        {header}
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

  if (error && opportunities.length === 0) {
    return (
      <div>
        {header}
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las oportunidades
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
      {header}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <KpiCard
          title="Oportunidades perdidas"
          value={formatNumber(all.length)}
          tone="warn"
          icon={<IconBulb className="w-4 h-4" />}
        />
        <KpiCard
          title="Descartadas con motivo"
          value={formatNumber(dismissedCount)}
          tone="bad"
          icon={<IconBulb className="w-4 h-4" />}
        />
        <KpiCard
          title="Venta perdida estimada"
          value="—"
          tone="neutral"
          icon={<IconBulb className="w-4 h-4" />}
          description="Disponible cuando exista la fuente de venta por campaña"
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por SKU, categoría, canal o tipo"
          resultCount={filtered.length}
          summary={`${filtered.length} oportunidad${filtered.length === 1 ? "" : "es"} perdida${filtered.length === 1 ? "" : "s"}`}
          onClear={() => {
            setQuery("");
            setMotivo("");
          }}
          selects={[
            {
              key: "motivo",
              placeholder: "Motivo",
              value: motivo,
              onChange: setMotivo,
              options: motivos.map((m) => ({ value: m, label: m })),
            },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Sin oportunidades perdidas"
              description="No hay oportunidades descartadas ni cerradas sin campaña con los filtros actuales."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(({ opp: o, motivo: m }) => (
            <Card key={o.id}>
              <CardBody>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {o.sku ? (
                        <Link
                          to={productPath(o.sku)}
                          className="text-sm font-semibold text-slate-900 hover:text-brand-700 truncate"
                        >
                          {o.sku}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {opportunityRefText(o)}
                        </span>
                      )}
                      <Badge tone={m === "Descartada" ? "red" : "neutral"}>{m}</Badge>
                      <Badge tone="blue">{kindLabel(o.kind)}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Ventana {fmtDate(o.windowFrom)} → {fmtDate(o.windowTo)}
                      {o.categoryId ? ` · Categoría ${o.categoryId}` : ""}
                      {o.channelRef ? ` · Canal ${o.channelRef}` : ""}
                      {` · actualizada ${fmtDate(o.dateModified)}`}
                    </p>
                    {evidenceSummary(o.evidence) !== "—" && (
                      <p className="text-xs text-slate-500 mt-1">{evidenceSummary(o.evidence)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Venta perdida</p>
                      <p className="text-base font-semibold text-slate-400">—</p>
                      <p className="text-[11px] text-slate-400">Sin fuente de venta por campaña</p>
                    </div>
                    {o.sku && (
                      <Link
                        to={productPath(o.sku)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap"
                      >
                        Ver producto
                      </Link>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
