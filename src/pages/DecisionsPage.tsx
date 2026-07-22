import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUrlState } from "../utils/useUrlState";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { FilterBar } from "../components/business/FilterBar";
import { InfoHint } from "../components/business/InfoHint";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useRole } from "../context/RoleContext";
import { useDecisions } from "../hooks/useDecisions";
import { productPath } from "../utils/entityLinks";
import { IconBulb, IconCheck, IconAlerts, IconChevronRight } from "../components/ui/icons";
import { formatNumber, formatCurrencyCompact, formatDate } from "../utils/formatters";
import type { DecisionBffOutcome, DecisionView } from "../services/purchaseBff";

// ============================================================================
//  Historial de decisiones (flujo 14) conectado al purchase-bff-service.
//  Una decisión se registra automáticamente al convertir una propuesta en OC:
//  guarda el resumen y la proyección sugerido-vs-comprado por línea. El batch
//  evaluador la mide a `windowDays` días con el estado fresco del motor:
//    hit   = bandeja sana            → "Compró bien"
//    miss  = algún SKU comprado volvió a quiebre inminente → "Faltó producto"
//    mixed = quedó en stock bajo     → "Resultado mixto"
//    pending = aún dentro de la ventana de evaluación → "En ventana"
//  El "motivo del desvío" del mock no existe como campo: el desvío se ve
//  comparando comprado vs sugerido por línea, y el aprendizaje es el resultado.
// ============================================================================

const OUTCOME_META: Record<DecisionBffOutcome, { label: string; tone: BadgeTone }> = {
  pending: { label: "En ventana", tone: "neutral" },
  hit: { label: "Compró bien", tone: "green" },
  miss: { label: "Faltó producto", tone: "red" },
  mixed: { label: "Resultado mixto", tone: "amber" },
};

const OUTCOMES = Object.keys(OUTCOME_META) as DecisionBffOutcome[];

const fmtDate = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Fecha en que el batch evaluará la decisión: creación + ventana en días. */
function evaluationDate(d: DecisionView): string {
  const base = new Date(d.dateCreated);
  if (Number.isNaN(base.getTime())) return "—";
  base.setDate(base.getDate() + d.windowDays);
  return formatDate(base.toISOString().slice(0, 10));
}

export function DecisionsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { role } = useRole();
  const [query, setQuery] = useUrlState("q");
  const [outcomeParam, setOutcome] = useUrlState("resultado");

  // Solo se envía al backend un outcome válido del contrato.
  const outcome = OUTCOMES.includes(outcomeParam as DecisionBffOutcome)
    ? (outcomeParam as DecisionBffOutcome)
    : "";

  // Cada comprador ve su propio historial; el líder ve el de todo el equipo.
  const scope = role === "lider" ? "all" : "mine";
  const { decisions, meta, loading, error, configured, refetch } = useDecisions({
    outcome,
    q: query,
    scope,
  });

  const countOf = (o: DecisionBffOutcome) => decisions.filter((d) => d.outcome === o).length;

  const selects = useMemo(
    () => [
      {
        key: "outcome",
        placeholder: "Resultado",
        value: outcome,
        onChange: setOutcome,
        options: OUTCOMES.map((o) => ({ value: o, label: OUTCOME_META[o].label })),
      },
    ],
    [outcome, setOutcome]
  );

  const header = !embedded && (
    <PageHeader
      title="Historial de decisiones"
      description="Auditoría de compras: qué sugería el sistema al decidir, qué se compró y cómo resultó días después. Sin historial, los errores se repiten."
      help={
        <InfoHint label="Qué guarda cada decisión">
          <p>
            Al convertir una propuesta en órdenes de compra se registra una decisión con el{" "}
            <b>sugerido del motor</b> vs <b>lo comprado</b> por SKU y la cobertura al decidir.
          </p>
          <p>
            Días después, el evaluador la mide con el estado fresco del motor:{" "}
            <b>compró bien</b> si la bandeja quedó sana, <b>faltó producto</b> si algún SKU volvió
            a quiebre inminente y <b>resultado mixto</b> si quedó en stock bajo.
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
              ver el historial real de decisiones y su evaluación.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && decisions.length === 0) {
    return (
      <div>
        {header}
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando decisiones">
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

  if (error && decisions.length === 0) {
    return (
      <div>
        {header}
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las decisiones
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Decisiones registradas"
          value={formatNumber(meta?.total ?? decisions.length)}
          tone="neutral"
          icon={<IconBulb className="w-4 h-4" />}
        />
        <KpiCard
          title="Compró bien"
          value={formatNumber(countOf("hit"))}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
        />
        <KpiCard
          title="Faltó producto"
          value={formatNumber(countOf("miss"))}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Resultado mixto"
          value={formatNumber(countOf("mixed"))}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por resumen o SKU"
          resultCount={decisions.length}
          summary={`${decisions.length} decisión${decisions.length === 1 ? "" : "es"}`}
          onClear={() => {
            setQuery("");
            setOutcome("");
          }}
          selects={selects}
        />
      </div>

      {decisions.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Sin decisiones"
              description="No hay decisiones que coincidan con los filtros. Se registran automáticamente al convertir propuestas en órdenes de compra."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => (
            <DecisionCard key={d.id} decision={d} showBuyer={role === "lider"} />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Tarjeta de una decisión: resumen + ventana + proyección expandible + result.
// ----------------------------------------------------------------------------

function DecisionCard({ decision: d, showBuyer }: { decision: DecisionView; showBuyer: boolean }) {
  const [open, setOpen] = useState(false);
  const lines = d.projection?.lines ?? [];
  const meta = OUTCOME_META[d.outcome];

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-slate-900 truncate">{d.summary}</p>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <p className="text-xs text-slate-400">
              {fmtDate(d.dateCreated)}
              {showBuyer && <> · comprador {d.buyerId}</>}
              {d.projection?.netTotalClp != null && (
                <> · {formatCurrencyCompact(d.projection.netTotalClp)}</>
              )}
              {" · "}
              {d.outcome === "pending" ? (
                <>
                  ventana de {d.windowDays} días · evalúa el {evaluationDate(d)}
                </>
              ) : (
                <>evaluada el {fmtDate(d.evaluatedAt)}</>
              )}
            </p>
          </div>
        </div>

        {/* Proyección sugerido-vs-comprado por línea (expandible). */}
        {lines.length > 0 && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              aria-expanded={open}
            >
              <IconChevronRight
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
              />
              {open ? "Ocultar proyección" : `Ver proyección (${lines.length} línea${lines.length === 1 ? "" : "s"})`}
            </button>
            {open && (
              <div className="mt-2 space-y-1.5">
                {lines.map((line, i) => {
                  const bought = line.boughtQty ?? 0;
                  const suggested = line.suggestedQtyAtDecision;
                  const diff = suggested != null ? bought - suggested : null;
                  return (
                    <div
                      key={line.sku ?? i}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                    >
                      <Link
                        to={productPath(line.sku)}
                        className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {line.sku ?? "—"}
                      </Link>
                      {line.skuName && (
                        <span className="text-slate-500 truncate max-w-[220px]">{line.skuName}</span>
                      )}
                      <span className="text-slate-600">
                        Comprado <b>{formatNumber(bought)} u.</b>
                        {suggested != null && <> · sugerido {formatNumber(suggested)} u.</>}
                      </span>
                      {diff != null && diff !== 0 && (
                        <span
                          className={`font-semibold ${diff > 0 ? "text-violet-600" : "text-rose-600"}`}
                        >
                          {diff > 0 ? "+" : ""}
                          {formatNumber(diff)} u. vs sugerido
                        </span>
                      )}
                      {line.coverageAtDecision != null && (
                        <span className="text-slate-400">
                          cobertura al decidir: {formatNumber(line.coverageAtDecision)} d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Resultado del evaluador: SKUs de vuelta en crítico / stock bajo. */}
        {d.result && d.outcome !== "pending" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs">
            <p className="mb-1.5 font-semibold uppercase tracking-wide text-slate-500">
              Resultado a {d.windowDays} días
            </p>
            {(d.result.backInCritical?.length ?? 0) === 0 &&
            (d.result.backInLowStock?.length ?? 0) === 0 ? (
              <p className="text-emerald-700">
                Ningún SKU comprado volvió a riesgo: bandeja sana al evaluar.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(d.result.backInCritical ?? []).map((sku) => (
                  <Link
                    key={`crit-${sku}`}
                    to={productPath(sku)}
                    className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 hover:underline"
                  >
                    {sku} · de vuelta en crítico
                  </Link>
                ))}
                {(d.result.backInLowStock ?? []).map((sku) => (
                  <Link
                    key={`low-${sku}`}
                    to={productPath(sku)}
                    className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 hover:underline"
                  >
                    {sku} · en stock bajo
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
