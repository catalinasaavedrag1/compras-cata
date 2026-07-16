import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { VALUE_TONE } from "../utils/tone";
import { supplierPath, categoryPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Drawer } from "../components/ui/Drawer";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Input } from "../components/ui/Input";
import { Tabs } from "../components/ui/Tabs";
import { KpiCard } from "../components/business/KpiCard";
import { useToast } from "../context/ToastContext";
import { purchaseRules as seedRules, specialRules } from "../data/mockRules";
import { products } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import {
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconRules, IconAlerts, IconArrowRight, IconCheck } from "../components/ui/icons";
import { cn } from "../utils/cn";
import { ruleParamIssues } from "../utils/paramHealth";
import { TODAY_ISO } from "../utils/constants";
import { useTrace } from "../context/TraceContext";
import type { PurchaseRule } from "../types/purchasing";

type RuleHealth = "ok" | "incoherent" | "high_lead" | "overstock_risk" | "stockout_risk";

const HEALTH: Record<RuleHealth, { label: string; tone: BadgeTone }> = {
  ok: { label: "Correcta", tone: "green" },
  incoherent: { label: "Incoherente", tone: "red" },
  high_lead: { label: "Lead time alto", tone: "amber" },
  overstock_risk: { label: "Riesgo sobrestock", tone: "violet" },
  stockout_risk: { label: "Riesgo de quiebre", tone: "red" },
};

const reasonFor: Record<RuleHealth, string> = {
  ok: "Parámetros dentro de rango.",
  incoherent: "Stock máximo menor que el mínimo. Corregir.",
  high_lead: "Lead time alto: conviene comprar con más anticipación.",
  overstock_risk: "Días objetivo altos: posible sobrestock (sobre todo si es estacional).",
  stockout_risk: "Días objetivo bajos: riesgo de quiebre.",
};

function healthOf(r: PurchaseRule): RuleHealth {
  if (r.maxStock > 0 && r.maxStock < r.minStock) return "incoherent";
  if (r.targetInventoryDays >= 55) return "overstock_risk";
  if (r.targetInventoryDays > 0 && r.targetInventoryDays <= 20) return "stockout_risk";
  if (r.leadTimeDays >= 15) return "high_lead";
  return "ok";
}

const isGlobal = (r: PurchaseRule) => r.scopeType === "global";

const SCOPE_TYPE: Record<PurchaseRule["scopeType"], { label: string; tone: BadgeTone }> = {
  global: { label: "Regla base", tone: "slate" },
  category: { label: "Categoría", tone: "blue" },
  supplier: { label: "Proveedor", tone: "violet" },
  brand: { label: "Marca", tone: "amber" },
  channel: { label: "Canal", tone: "green" },
};

function affectedProductsOf(r: PurchaseRule) {
  switch (r.scopeType) {
    case "supplier":
      return products.filter((p) => p.supplierName === r.scopeValue);
    case "brand":
      return products.filter((p) => p.brand === r.scopeValue);
    case "category":
      return products.filter((p) => p.category === r.scopeValue);
    default:
      return products; // global y canal aplican a todo el surtido
  }
}
const affectedCount = (r: PurchaseRule) => affectedProductsOf(r).length;
const affectedPurchase = (r: PurchaseRule) => {
  const skus = new Set(affectedProductsOf(r).map((p) => p.sku));
  return recommendations
    .filter((rec) => skus.has(rec.sku))
    .reduce((a, rec) => a + rec.suggestedPurchaseAmount, 0);
};

export function SettingsPage() {
  const toast = useToast();
  const { log } = useTrace();
  const [rules, setRules] = useState<PurchaseRule[]>(seedRules);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [editing, setEditing] = useState<PurchaseRule | null>(null);

  const global = rules.find(isGlobal);
  const withHealth = useMemo(() => rules.map((r) => ({ r, health: healthOf(r) })), [rules]);

  // Diagnóstico de parámetros vs la realidad de los productos del ámbito.
  const paramIssues = useMemo(
    () =>
      rules
        .flatMap((r) => ruleParamIssues(r, affectedProductsOf(r)).map((issue) => ({ r, issue })))
        .sort((a, b) =>
          a.issue.severity === b.issue.severity ? 0 : a.issue.severity === "high" ? -1 : 1
        ),
    [rules]
  );

  const applyFix = (rule: PurchaseRule, fix: Partial<PurchaseRule>, label: string) => {
    setRules((prev) =>
      prev.map((x) =>
        x.id === rule.id ? { ...x, ...fix, updatedAt: TODAY_ISO, updatedBy: "Catalina Saavedra" } : x
      )
    );
    // Registrar cada campo cambiado en la bitácora (antes → después).
    for (const [field, after] of Object.entries(fix)) {
      log({
        actor: "Catalina Saavedra",
        entity: `Regla · ${rule.scope}`,
        action: "Corrigió parámetro",
        field,
        before: String(rule[field as keyof PurchaseRule] ?? "—"),
        after: String(after),
        reason: label,
      });
    }
    toast.success(`Corregido: ${label}`);
  };
  const propias = rules.filter((r) => !isGlobal(r)).length;
  const conAlerta = withHealth.filter((x) => x.health !== "ok").length;
  const leadProm = Math.round(rules.reduce((a, r) => a + r.leadTimeDays, 0) / rules.length);
  const diasProm = Math.round(rules.reduce((a, r) => a + r.targetInventoryDays, 0) / rules.length);

  // ---- Simulador de "días objetivo" -------------------------------------
  // Modelo: la compra del mes escala con la cobertura (lead + días objetivo).
  // Permite ver el impacto en la compra sugerida ANTES de aplicar el cambio.
  const baseTargetDays = global?.targetInventoryDays ?? diasProm;
  const baseByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const rec of recommendations)
      m.set(rec.category, (m.get(rec.category) ?? 0) + rec.suggestedPurchaseAmount);
    return m;
  }, []);
  const leadByCat = useMemo(() => {
    const sum = new Map<string, { t: number; n: number }>();
    for (const p of products) {
      const e = sum.get(p.category) ?? { t: 0, n: 0 };
      e.t += p.supplierLeadTimeDays;
      e.n += 1;
      sum.set(p.category, e);
    }
    const m = new Map<string, number>();
    for (const [cat, { t, n }] of sum) m.set(cat, n ? t / n : leadProm);
    return m;
  }, [leadProm]);
  const simOptions = useMemo(
    () => Array.from(new Set([baseTargetDays, 45, 60, 90])).sort((a, b) => a - b),
    [baseTargetDays]
  );
  const [simDays, setSimDays] = useState<number>(baseTargetDays);
  const projection = useMemo(() => {
    const rows = Array.from(baseByCat.entries())
      .map(([cat, base]) => {
        const lead = leadByCat.get(cat) ?? leadProm;
        const ratio = (lead + simDays) / (lead + baseTargetDays);
        const proj = Math.round(base * ratio);
        return { cat, base, proj, delta: proj - base };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const baseTotal = rows.reduce((a, r) => a + r.base, 0);
    const projTotal = rows.reduce((a, r) => a + r.proj, 0);
    return { rows, baseTotal, projTotal, delta: projTotal - baseTotal };
  }, [simDays, baseByCat, leadByCat, baseTargetDays, leadProm]);

  const visible = withHealth
    .filter((x) => (scopeFilter === "all" ? true : x.r.scopeType === scopeFilter))
    .filter((x) => (onlyAlerts ? x.health !== "ok" : true));
  const alerts = withHealth.filter((x) => x.health !== "ok");
  const scopeCount = (t: string) =>
    t === "all" ? rules.length : rules.filter((r) => r.scopeType === t).length;

  const vsGlobal = (r: PurchaseRule) => {
    if (!global || isGlobal(r)) return null;
    const d = r.targetInventoryDays - global.targetInventoryDays;
    if (d === 0) return null;
    return `${d > 0 ? "+" : ""}${d} d vs global`;
  };

  const columns: Column<{ r: PurchaseRule; health: RuleHealth }>[] = [
    {
      key: "scope",
      header: "Ámbito",
      render: ({ r }) => (
        <div className="min-w-[150px]">
          {r.scopeType === "category" || r.scopeType === "supplier" ? (
            <Link
              to={
                r.scopeType === "category" ? categoryPath(r.scopeValue) : supplierPath(r.scopeValue)
              }
              className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
            >
              {r.scope}
            </Link>
          ) : (
            <p className="font-medium text-slate-800">{r.scope}</p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge tone={SCOPE_TYPE[r.scopeType].tone}>{SCOPE_TYPE[r.scopeType].label}</Badge>
            {vsGlobal(r) && <span className="text-xs text-amber-600">{vsGlobal(r)}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "dias",
      header: "Días obj.",
      align: "right",
      render: ({ r }) => formatDays(r.targetInventoryDays),
    },
    {
      key: "stock",
      header: "Stock mín/máx",
      align: "right",
      hideOnMobile: true,
      render: ({ r }) => `${formatNumber(r.minStock)} / ${formatNumber(r.maxStock)}`,
    },
    {
      key: "margin",
      header: "Margen mín.",
      align: "right",
      hideOnMobile: true,
      render: ({ r }) => formatPercent(r.minMargin, 0),
    },
    {
      key: "lead",
      header: "Lead time",
      align: "right",
      hideOnMobile: true,
      render: ({ r }) => formatDays(r.leadTimeDays),
    },
    {
      key: "impact",
      header: "Impacto",
      align: "right",
      render: ({ r }) => (
        <div className="text-sm">
          <p className="text-slate-700">{affectedCount(r)} SKU</p>
          <p className="text-xs text-slate-400">{formatCurrencyCompact(affectedPurchase(r))}</p>
        </div>
      ),
    },
    {
      key: "updated",
      header: "Modificada",
      align: "right",
      hideOnMobile: true,
      render: ({ r }) => (
        <span className="text-xs text-slate-500">
          {r.updatedAt ? formatDate(r.updatedAt) : "—"}
        </span>
      ),
    },
    {
      key: "health",
      header: "Estado",
      render: ({ health }) => (
        <Badge tone={HEALTH[health].tone} dot>
          {HEALTH[health].label}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "",
      render: ({ r }) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(r);
          }}
        >
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reglas de compra"
        description="Define cómo se calcula la compra sugerida por categoría, proveedor, marca o canal."
      />

      {/* Resumen KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Con regla propia"
          value={formatNumber(propias)}
          tone="info"
          icon={<IconRules className="w-4 h-4" />}
          description={`+ 1 regla global`}
        />
        <KpiCard
          title="Requieren revisión"
          value={formatNumber(conAlerta)}
          tone={conAlerta ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Filtrar"
          active={onlyAlerts}
          onClick={() => setOnlyAlerts((v) => !v)}
        />
        <KpiCard
          title="Días objetivo prom."
          value={formatDays(diasProm)}
          tone="neutral"
          icon={<IconRules className="w-4 h-4" />}
        />
        <KpiCard
          title="Lead time prom."
          value={formatDays(leadProm)}
          tone="neutral"
          icon={<IconRules className="w-4 h-4" />}
        />
      </div>

      {/* Simulador de días objetivo: ve el impacto en la compra sugerida antes de aplicar */}
      <Card className="mb-4">
        <CardHeader
          title="Simular días objetivo de inventario"
          description="Mueve los días objetivo y observa el impacto en la compra sugerida del mes — antes de aplicar el cambio."
        />
        <CardBody>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-400">Días objetivo actual (global)</p>
              <p className="text-lg font-semibold text-slate-800">{formatDays(baseTargetDays)}</p>
            </div>
            <div className="h-9 w-px bg-slate-200 hidden sm:block" />
            <div>
              <p className="text-xs text-slate-400 mb-1">Simular</p>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                {simOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSimDays(d)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                      simDays === d
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {d === baseTargetDays ? `${d} d · actual` : `${d} días`}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-slate-400">Compra sugerida proyectada</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrencyCompact(projection.projTotal)}
              </p>
              <p
                className={cn(
                  "text-xs font-semibold",
                  projection.delta > 0
                    ? "text-rose-600"
                    : projection.delta < 0
                      ? "text-emerald-600"
                      : "text-slate-400"
                )}
              >
                {projection.delta >= 0 ? "+" : ""}
                {formatCurrencyCompact(projection.delta)} vs actual
              </p>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Impacto por categoría
          </p>
          <div className="space-y-1.5">
            {projection.rows.slice(0, 6).map((r) => (
              <div key={r.cat} className="flex items-center gap-2.5 text-sm">
                <span className="w-36 sm:w-44 truncate text-slate-700">{r.cat}</span>
                <span className="text-slate-400 tabular-nums">{formatCurrencyCompact(r.base)}</span>
                <IconArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                <span className="font-medium text-slate-800 tabular-nums">
                  {formatCurrencyCompact(r.proj)}
                </span>
                <span
                  className={cn(
                    "ml-auto text-xs font-semibold tabular-nums",
                    r.delta > 0
                      ? "text-rose-600"
                      : r.delta < 0
                        ? "text-emerald-600"
                        : "text-slate-400"
                  )}
                >
                  {r.delta >= 0 ? "+" : ""}
                  {formatCurrencyCompact(r.delta)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Subir los días objetivo aumenta la cobertura y, con ella, la compra sugerida del mes.
            Revisa el presupuesto antes de aplicar.
          </p>
        </CardBody>
      </Card>

      {/* Alertas de configuración */}
      {alerts.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title="Qué reglas revisar"
            description="Configuraciones que pueden afectar la compra sugerida"
          />
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.map(({ r, health }) => (
              <button
                key={r.id}
                onClick={() => setEditing(r)}
                className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-left hover:border-brand-300"
              >
                <Badge tone={HEALTH[health].tone} dot>
                  {HEALTH[health].label}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{r.scope}</span>
                  <span className="block text-xs text-slate-500">{reasonFor[health]}</span>
                </span>
                <IconArrowRight className="w-4 h-4 text-brand-500 flex-shrink-0" />
              </button>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Diagnóstico: parámetros mal configurados vs la realidad */}
      {paramIssues.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title="Parámetros a corregir"
            description="Detectados comparando la regla con el lead time real, la demanda y la estacionalidad de sus productos"
          />
          <CardBody className="space-y-2">
            {paramIssues.map(({ r, issue }, i) => (
              <div
                key={`${r.id}-${issue.kind}-${i}`}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center",
                  issue.severity === "high"
                    ? "border-rose-200 bg-rose-50/60"
                    : "border-amber-200 bg-amber-50/50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={issue.severity === "high" ? "red" : "amber"} dot>
                      {issue.title}
                    </Badge>
                    <button
                      onClick={() => setEditing(r)}
                      className="text-xs font-semibold text-slate-700 hover:text-brand-700"
                    >
                      {r.scope}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{issue.detail}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    Sugerencia: {issue.suggestion}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  {issue.fix ? (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<IconCheck className="h-3.5 w-3.5" />}
                      onClick={() => applyFix(r, issue.fix!, issue.suggestion)}
                    >
                      Aplicar
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                      Revisar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Filtro por tipo de ámbito */}
      <Tabs
        className="mb-4"
        value={scopeFilter}
        onChange={setScopeFilter}
        tabs={[
          { value: "all", label: "Todas", count: scopeCount("all") },
          { value: "category", label: "Categoría", count: scopeCount("category") },
          { value: "supplier", label: "Proveedor", count: scopeCount("supplier") },
          { value: "brand", label: "Marca", count: scopeCount("brand") },
          { value: "channel", label: "Canal", count: scopeCount("channel") },
          { value: "global", label: "Global", count: scopeCount("global") },
        ]}
      />

      {/* 2 columnas en escritorio: tabla + ayuda/excepciones siempre visibles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Reglas"
              description="Precedencia: proveedor › marca › categoría › global"
            />
            <DataTable
              columns={columns}
              data={visible}
              rowKey={({ r }) => r.id}
              onRowClick={({ r }) => setEditing(r)}
              emptyMessage="No hay reglas con alerta."
              mobileCard={({ r, health }) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{r.scope}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge tone={SCOPE_TYPE[r.scopeType].tone}>
                          {SCOPE_TYPE[r.scopeType].label}
                        </Badge>
                        {vsGlobal(r) && (
                          <span className="text-xs text-amber-600">{vsGlobal(r)}</span>
                        )}
                      </div>
                    </div>
                    <Badge tone={HEALTH[health].tone} dot>
                      {HEALTH[health].label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Días obj.</p>
                      <p className="text-slate-700">{formatDays(r.targetInventoryDays)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Mín/Máx</p>
                      <p className="text-slate-700">
                        {formatNumber(r.minStock)}/{formatNumber(r.maxStock)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Lead</p>
                      <p className="text-slate-700">{formatDays(r.leadTimeDays)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {affectedCount(r)} SKU · {formatCurrencyCompact(affectedPurchase(r))} compra
                    sugerida
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r);
                    }}
                  >
                    Editar regla
                  </Button>
                </div>
              )}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Cómo se calcula" />
            <CardBody>
              <div className="rounded-lg bg-slate-50 p-3 mb-2">
                <p className="text-sm text-slate-700 font-mono leading-snug">
                  Cantidad = venta diaria × (lead time + días objetivo) − stock disponible
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Acotada por stock mín/máx. Se ajusta por margen, temporada, sobrestock, baja
                rotación y proveedor atrasado. Solo se sugiere comprar si hay riesgo de quiebre o
                necesidad real.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Excepciones y reglas especiales" />
            <CardBody className="space-y-2">
              {specialRules.map((s) => (
                <div key={s.title} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <Badge tone="blue" dot>
                      {s.title}
                    </Badge>
                    <Badge tone="green">Activa</Badge>
                  </div>
                  <p className="text-xs text-slate-600">{s.description}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <RuleEditDrawer
        rule={editing}
        onClose={() => setEditing(null)}
        onSave={(updated) => {
          setRules((prev) =>
            prev.map((x) =>
              x.id === updated.id
                ? { ...updated, updatedAt: TODAY_ISO, updatedBy: "Catalina Saavedra" }
                : x
            )
          );
          setEditing(null);
          toast.success(`Regla de ${updated.scope} actualizada`);
        }}
      />
    </div>
  );
}

// Enlace a los productos afectados según el ámbito de la regla (categoría/proveedor/marca).
function affectedProductsLink(r: PurchaseRule): string {
  const v = r.scopeValue ?? r.scope;
  switch (r.scopeType) {
    case "category":
      return `/productos?cat=${encodeURIComponent(v)}`;
    case "supplier":
      return `/productos?prov=${encodeURIComponent(v)}`;
    case "brand":
      return `/productos?marca=${encodeURIComponent(v)}`;
    default:
      return "/productos"; // global y channel: ProductsPage no filtra por canal
  }
}

function RuleEditDrawer({
  rule,
  onClose,
  onSave,
}: {
  rule: PurchaseRule | null;
  onClose: () => void;
  onSave: (r: PurchaseRule) => void;
}) {
  const [draft, setDraft] = useState<PurchaseRule | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (rule && (!draft || draft.id !== rule.id)) setDraft({ ...rule });
  if (!rule || !draft) return null;

  // Guardia de cambios sin guardar: si el borrador difiere, confirmar al cerrar.
  const dirty = JSON.stringify(draft) !== JSON.stringify(rule);
  const guardedClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  const set = (k: keyof PurchaseRule, v: number) => setDraft({ ...draft, [k]: v });
  const errors: string[] = [];
  if (draft.maxStock > 0 && draft.maxStock < draft.minStock)
    errors.push("El stock máximo no puede ser menor que el mínimo.");
  if (draft.targetInventoryDays <= 0) errors.push("Los días objetivo deben ser mayores a 0.");
  if (draft.minMargin < 0 || draft.minMargin > 80)
    errors.push("El margen mínimo debe estar entre 0 y 80%.");

  const warnings: string[] = [];
  if (draft.targetInventoryDays >= 55) warnings.push("Días objetivo altos: riesgo de sobrestock.");
  if (draft.targetInventoryDays > 0 && draft.targetInventoryDays <= 20)
    warnings.push("Días objetivo bajos: riesgo de quiebre.");
  if (draft.leadTimeDays >= 15) warnings.push("Lead time alto: comprar con más anticipación.");

  const affected = affectedCount(draft);
  const deltaPct =
    rule.targetInventoryDays > 0
      ? Math.round((draft.targetInventoryDays / rule.targetInventoryDays - 1) * 100)
      : 0;

  return (
    <>
      <Drawer
        open={!!rule}
        onClose={guardedClose}
        title={`Editar regla · ${rule.scope}`}
        description={
          rule.updatedAt
            ? `Última modificación: ${formatDate(rule.updatedAt)} · ${rule.updatedBy ?? ""}`
            : "Ajusta los parámetros y ve el impacto."
        }
        footer={
          <>
            <Button variant="secondary" onClick={guardedClose}>
              Cancelar
            </Button>
            <Button disabled={errors.length > 0 || !dirty} onClick={() => onSave(draft)}>
              {dirty ? "Guardar cambios" : "Sin cambios"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {errors.length > 0 && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 space-y-0.5">
              {errors.map((e) => (
                <p key={e}>⚠ {e}</p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Días objetivo"
              type="number"
              min={0}
              value={draft.targetInventoryDays}
              onChange={(e) => set("targetInventoryDays", Number(e.target.value))}
            />
            <Input
              label="Lead time (días)"
              type="number"
              min={0}
              value={draft.leadTimeDays}
              onChange={(e) => set("leadTimeDays", Number(e.target.value))}
            />
            <Input
              label="Stock mínimo"
              type="number"
              min={0}
              value={draft.minStock}
              onChange={(e) => set("minStock", Number(e.target.value))}
            />
            <Input
              label="Stock máximo"
              type="number"
              min={0}
              value={draft.maxStock}
              onChange={(e) => set("maxStock", Number(e.target.value))}
            />
            <Input
              label="Margen mínimo (%)"
              type="number"
              min={0}
              value={draft.minMargin}
              onChange={(e) => set("minMargin", Number(e.target.value))}
            />
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 space-y-0.5">
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Impacto estimado
            </p>
            <div className="space-y-1 text-sm">
              <Row label="SKU afectados" value={`${affected}`} />
              <Row
                label="Cambio en compra sugerida"
                value={`${deltaPct >= 0 ? "+" : ""}${deltaPct}%`}
                tone={deltaPct > 0 ? "bad" : deltaPct < 0 ? "good" : undefined}
              />
              <Row
                label="Riesgo"
                value={
                  deltaPct > 15
                    ? "Más capital / sobrestock"
                    : deltaPct < -15
                      ? "Posible quiebre"
                      : "Bajo"
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link
              to={affectedProductsLink(draft)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
              onClick={onClose}
            >
              Ver productos afectados
            </Link>
            <button
              onClick={() => setDraft({ ...seedRules.find((s) => s.id === rule.id)! })}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Restaurar valores
            </button>
          </div>
        </div>
      </Drawer>

      <ConfirmModal
        open={confirmDiscard}
        title="Descartar cambios"
        message="Tienes cambios sin guardar en esta regla. Si sales ahora se perderán."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const cls = tone ? VALUE_TONE[tone] : "text-slate-800";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </div>
  );
}
