import { useMemo } from "react";
import { useUrlState } from "../utils/useUrlState";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { FilterBar } from "../components/business/FilterBar";
import { InfoHint } from "../components/business/InfoHint";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { OUTCOME_META, type DecisionOutcome } from "../data/mockDecisions";
import { usePurchaseFlow } from "../context/PurchaseFlowContext";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import { supplierPath } from "../utils/entityLinks";
import { IconBulb, IconCheck, IconAlerts } from "../components/ui/icons";
import { formatNumber } from "../utils/formatters";

export function DecisionsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { decisions } = usePurchaseFlow();
  const { buyer } = useBuyer();
  const { role } = useRole();
  const [query, setQuery] = useUrlState("q");
  const [outcome, setOutcome] = useUrlState("resultado");

  // Cada comprador ve su propio historial; el líder ve el de todo el equipo.
  const all = role === "lider" ? decisions : decisions.filter((d) => d.buyerName === buyer);

  const filtered = all.filter((d) => {
    if (
      query.trim() &&
      !`${d.productName} ${d.sku} ${d.buyerName} ${d.supplierName}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      return false;
    if (outcome && d.outcome !== outcome) return false;
    return true;
  });

  const countOf = (o: DecisionOutcome) => all.filter((d) => d.outcome === o).length;
  const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

  const selects = useMemo(
    () => [
      {
        key: "outcome",
        placeholder: "Resultado",
        value: outcome,
        onChange: setOutcome,
        options: (Object.keys(OUTCOME_META) as DecisionOutcome[]).map((o) => ({
          value: o,
          label: OUTCOME_META[o].label,
        })),
      },
    ],
    [outcome, setOutcome]
  );

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Historial de decisiones"
          description="Auditoría de compras: qué sugería el sistema, qué se compró, por qué se cambió y cómo resultó. Sin historial, los errores se repiten."
          help={
            <InfoHint label="Qué guarda cada decisión">
              <p>
                Cada decisión guarda el <b>sugerido original</b> vs <b>lo comprado</b>, el{" "}
                <b>motivo del desvío</b>, quién compró y aprobó, el <b>resultado posterior</b> y el{" "}
                <b>aprendizaje</b>.
              </p>
              <p>
                Separar la causa importa: a veces el quiebre fue por el proveedor (no despachó), no
                por la decisión del comprador.
              </p>
            </InfoHint>
          }
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Decisiones registradas"
          value={formatNumber(all.length)}
          tone="neutral"
          icon={<IconBulb className="w-4 h-4" />}
        />
        <KpiCard
          title="Compró bien"
          value={formatNumber(countOf("bueno"))}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
        />
        <KpiCard
          title="Sobrecompras"
          value={formatNumber(countOf("sobrestock"))}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Compras cortas"
          value={formatNumber(countOf("corto"))}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar producto, comprador o proveedor"
          resultCount={filtered.length}
          summary={`${filtered.length} decisión${filtered.length === 1 ? "" : "es"}`}
          onClear={() => {
            setQuery("");
            setOutcome("");
          }}
          selects={selects}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Sin decisiones"
              description="No hay decisiones que coincidan con los filtros."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const diff = d.purchasedQty - d.suggestedQty;
            const diffPct = d.suggestedQty > 0 ? Math.round((diff / d.suggestedQty) * 100) : 0;
            return (
              <Card key={d.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          to={`/productos/${d.sku}`}
                          className="text-sm font-semibold text-slate-900 hover:text-brand-700 truncate"
                        >
                          {d.productName}
                        </Link>
                        <Badge tone={OUTCOME_META[d.outcome].tone}>
                          {OUTCOME_META[d.outcome].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        {fmtDate(d.date)} · {d.buyerName}
                        {d.approvedBy !== "—" && <> · aprobó {d.approvedBy}</>} ·{" "}
                        <Link
                          to={supplierPath(d.supplierName)}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {d.supplierName}
                        </Link>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 mb-3">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Sugerido</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {formatNumber(d.suggestedQty)} u.
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Comprado</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {formatNumber(d.purchasedQty)} u.
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Desvío</p>
                      <p
                        className={`text-sm font-semibold ${diff === 0 ? "text-slate-500" : diff > 0 ? "text-violet-600" : "text-rose-600"}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatNumber(diff)} u.{" "}
                        {diff !== 0 && (
                          <span className="text-xs font-normal">
                            ({diffPct > 0 ? "+" : ""}
                            {diffPct}%)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <p className="text-slate-700">
                      <span className="text-slate-400">Motivo:</span> {d.reason}
                    </p>
                    <p className="text-slate-700">
                      <span className="text-slate-400">
                        Resultado{d.resultDays > 0 ? ` (${d.resultDays}d)` : ""}:
                      </span>{" "}
                      {d.resultText}
                    </p>
                    {d.learning !== "—" && (
                      <p className="text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 mt-1">
                        <span className="font-semibold">Aprendizaje:</span> {d.learning}
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
