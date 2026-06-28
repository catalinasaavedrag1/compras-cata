import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Drawer } from "../components/ui/Drawer";
import { Input } from "../components/ui/Input";
import { Tabs } from "../components/ui/Tabs";
import { KpiCard } from "../components/business/KpiCard";
import { useToast } from "../context/ToastContext";
import { purchaseRules as seedRules, specialRules } from "../data/mockRules";
import { products } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import { calculateSuggestedPurchase } from "../utils/calculations";
import { formatCurrency, formatCurrencyCompact, formatDate, formatDays, formatNumber, formatPercent } from "../utils/formatters";
import { IconRules, IconAlerts, IconArrowRight } from "../components/ui/icons";
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
    case "supplier": return products.filter((p) => p.supplierName === r.scopeValue);
    case "brand": return products.filter((p) => p.brand === r.scopeValue);
    case "category": return products.filter((p) => p.category === r.scopeValue);
    default: return products; // global y canal aplican a todo el surtido
  }
}
const affectedCount = (r: PurchaseRule) => affectedProductsOf(r).length;
const affectedPurchase = (r: PurchaseRule) => {
  const skus = new Set(affectedProductsOf(r).map((p) => p.sku));
  return recommendations.filter((rec) => skus.has(rec.sku)).reduce((a, rec) => a + rec.suggestedPurchaseAmount, 0);
};

export function SettingsPage() {
  const toast = useToast();
  const [rules, setRules] = useState<PurchaseRule[]>(seedRules);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [editing, setEditing] = useState<PurchaseRule | null>(null);

  const global = rules.find(isGlobal);
  const withHealth = useMemo(() => rules.map((r) => ({ r, health: healthOf(r) })), [rules]);
  const propias = rules.filter((r) => !isGlobal(r)).length;
  const conAlerta = withHealth.filter((x) => x.health !== "ok").length;
  const leadProm = Math.round(rules.reduce((a, r) => a + r.leadTimeDays, 0) / rules.length);
  const diasProm = Math.round(rules.reduce((a, r) => a + r.targetInventoryDays, 0) / rules.length);

  const visible = withHealth
    .filter((x) => (scopeFilter === "all" ? true : x.r.scopeType === scopeFilter))
    .filter((x) => (onlyAlerts ? x.health !== "ok" : true));
  const alerts = withHealth.filter((x) => x.health !== "ok");
  const scopeCount = (t: string) => (t === "all" ? rules.length : rules.filter((r) => r.scopeType === t).length);

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
          <p className="font-medium text-slate-800">{r.scope}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge tone={SCOPE_TYPE[r.scopeType].tone}>{SCOPE_TYPE[r.scopeType].label}</Badge>
            {vsGlobal(r) && <span className="text-xs text-amber-600">{vsGlobal(r)}</span>}
          </div>
        </div>
      ),
    },
    { key: "dias", header: "Días obj.", align: "right", render: ({ r }) => formatDays(r.targetInventoryDays) },
    { key: "stock", header: "Stock mín/máx", align: "right", hideOnMobile: true, render: ({ r }) => `${formatNumber(r.minStock)} / ${formatNumber(r.maxStock)}` },
    { key: "margin", header: "Margen mín.", align: "right", hideOnMobile: true, render: ({ r }) => formatPercent(r.minMargin, 0) },
    { key: "lead", header: "Lead time", align: "right", hideOnMobile: true, render: ({ r }) => formatDays(r.leadTimeDays) },
    {
      key: "impact",
      header: "Impacto",
      align: "right",
      render: ({ r }) => (
        <div className="text-sm">
          <p className="text-slate-700">{affectedCount(r)} SKU</p>
          <p className="text-xs text-slate-500">{formatCurrencyCompact(affectedPurchase(r))}</p>
        </div>
      ),
    },
    { key: "updated", header: "Modificada", align: "right", hideOnMobile: true, render: ({ r }) => <span className="text-xs text-slate-500">{r.updatedAt ? formatDate(r.updatedAt) : "—"}</span> },
    { key: "health", header: "Estado", render: ({ health }) => <Badge tone={HEALTH[health].tone} dot>{HEALTH[health].label}</Badge> },
    { key: "action", header: "", render: ({ r }) => <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Editar</Button> },
  ];

  return (
    <div>
      <PageHeader
        title="Reglas de compra"
        description="Define cómo se calcula la compra sugerida por categoría, proveedor, marca o canal."
      />

      {/* Resumen KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Con regla propia" value={formatNumber(propias)} tone="info" icon={<IconRules className="w-4 h-4" />} description={`+ 1 regla global`} />
        <KpiCard title="Requieren revisión" value={formatNumber(conAlerta)} tone={conAlerta ? "bad" : "good"} icon={<IconAlerts className="w-4 h-4" />} description="Filtrar" active={onlyAlerts} onClick={() => setOnlyAlerts((v) => !v)} />
        <KpiCard title="Días objetivo prom." value={formatDays(diasProm)} tone="neutral" icon={<IconRules className="w-4 h-4" />} />
        <KpiCard title="Lead time prom." value={formatDays(leadProm)} tone="neutral" icon={<IconRules className="w-4 h-4" />} />
      </div>

      {/* Alertas de configuración */}
      {alerts.length > 0 && (
        <Card className="mb-4">
          <CardHeader title="Qué reglas revisar" description="Configuraciones que pueden afectar la compra sugerida" />
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.map(({ r, health }) => (
              <button key={r.id} onClick={() => setEditing(r)} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-left hover:border-brand-300">
                <Badge tone={HEALTH[health].tone} dot>{HEALTH[health].label}</Badge>
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
            <CardHeader title="Reglas" description="Precedencia: proveedor › marca › categoría › global" />
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
                        <Badge tone={SCOPE_TYPE[r.scopeType].tone}>{SCOPE_TYPE[r.scopeType].label}</Badge>
                        {vsGlobal(r) && <span className="text-xs text-amber-600">{vsGlobal(r)}</span>}
                      </div>
                    </div>
                    <Badge tone={HEALTH[health].tone} dot>{HEALTH[health].label}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div><p className="text-xs text-slate-500">Días obj.</p><p className="text-slate-700">{formatDays(r.targetInventoryDays)}</p></div>
                    <div><p className="text-xs text-slate-500">Mín/Máx</p><p className="text-slate-700">{formatNumber(r.minStock)}/{formatNumber(r.maxStock)}</p></div>
                    <div><p className="text-xs text-slate-500">Lead</p><p className="text-slate-700">{formatDays(r.leadTimeDays)}</p></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{affectedCount(r)} SKU · {formatCurrencyCompact(affectedPurchase(r))} compra sugerida</p>
                  <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Editar regla</Button>
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
                <p className="text-sm text-slate-700 font-mono leading-snug">Cantidad = venta diaria × (lead time + días objetivo) − stock disponible</p>
              </div>
              <p className="text-xs text-slate-500">Acotada por stock mín/máx. Se ajusta por margen, temporada, sobrestock, baja rotación y proveedor atrasado. Solo se sugiere comprar si hay riesgo de quiebre o necesidad real.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Excepciones y reglas especiales" />
            <CardBody className="space-y-2">
              {specialRules.map((s) => (
                <div key={s.title} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <Badge tone="blue" dot>{s.title}</Badge>
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
          setRules((prev) => prev.map((x) => (x.id === updated.id ? { ...updated, updatedAt: "2026-06-24", updatedBy: "Catalina Saavedra" } : x)));
          setEditing(null);
          toast.success(`Regla de ${updated.scope} actualizada`);
        }}
      />
    </div>
  );
}

function RuleEditDrawer({ rule, onClose, onSave }: { rule: PurchaseRule | null; onClose: () => void; onSave: (r: PurchaseRule) => void }) {
  const [draft, setDraft] = useState<PurchaseRule | null>(null);
  if (rule && (!draft || draft.id !== rule.id)) setDraft({ ...rule });
  if (!rule || !draft) return null;

  const set = (k: keyof PurchaseRule, v: number) => setDraft({ ...draft, [k]: v });
  const errors: string[] = [];
  if (draft.maxStock > 0 && draft.maxStock < draft.minStock) errors.push("El stock máximo no puede ser menor que el mínimo.");
  if (draft.targetInventoryDays <= 0) errors.push("Los días objetivo deben ser mayores a 0.");
  if (draft.minMargin < 0 || draft.minMargin > 80) errors.push("El margen mínimo debe estar entre 0 y 80%.");

  const warnings: string[] = [];
  if (draft.targetInventoryDays >= 55) warnings.push("Días objetivo altos: riesgo de sobrestock.");
  if (draft.targetInventoryDays > 0 && draft.targetInventoryDays <= 20) warnings.push("Días objetivo bajos: riesgo de quiebre.");
  if (draft.leadTimeDays >= 15) warnings.push("Lead time alto: comprar con más anticipación.");

  const affected = affectedCount(draft);

  // Simulación real: recalcula la compra sugerida de los SKUs afectados con
  // los parámetros actuales de la regla vs. los del borrador, usando la misma
  // fórmula del sistema. Permite ver el impacto antes de aplicar.
  const sim = useMemo(() => {
    const prods = affectedProductsOf(draft);
    const purchaseWith = (p: PurchaseRule) =>
      prods.reduce((sum, prod) => {
        const qty = calculateSuggestedPurchase({
          availableStock: prod.availableStock,
          committedStock: prod.committedStock,
          monthlySales: prod.salesLast30Days,
          leadTimeDays: p.leadTimeDays,
          targetInventoryDays: p.targetInventoryDays,
          // Cota por los mín/máx propios del SKU (más realista que un clamp único).
          minStock: prod.minStock,
          maxStock: prod.maxStock,
        }).suggestedQuantity;
        return sum + qty * prod.cost;
      }, 0);
    const before = purchaseWith(rule);
    const after = purchaseWith(draft);
    const delta = after - before;
    const pct = before > 0 ? Math.round((after / before - 1) * 100) : after > 0 ? 100 : 0;
    return { before, after, delta, pct };
  }, [draft, rule]);
  const deltaPct = sim.pct;

  return (
    <Drawer
      open={!!rule}
      onClose={onClose}
      title={`Editar regla · ${rule.scope}`}
      description={rule.updatedAt ? `Última modificación: ${formatDate(rule.updatedAt)} · ${rule.updatedBy ?? ""}` : "Ajusta los parámetros y ve el impacto."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={errors.length > 0} onClick={() => onSave(draft)}>Guardar cambios</Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.length > 0 && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 space-y-0.5">
            {errors.map((e) => <p key={e}>⚠ {e}</p>)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Días objetivo" type="number" min={0} value={draft.targetInventoryDays} onChange={(e) => set("targetInventoryDays", Number(e.target.value))} />
          <Input label="Lead time (días)" type="number" min={0} value={draft.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value))} />
          <Input label="Stock mínimo" type="number" min={0} value={draft.minStock} onChange={(e) => set("minStock", Number(e.target.value))} />
          <Input label="Stock máximo" type="number" min={0} value={draft.maxStock} onChange={(e) => set("maxStock", Number(e.target.value))} />
          <Input label="Margen mínimo (%)" type="number" min={0} value={draft.minMargin} onChange={(e) => set("minMargin", Number(e.target.value))} />
        </div>

        {warnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 space-y-0.5">
            {warnings.map((w) => <p key={w}>{w}</p>)}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Simulación del impacto</p>
          <div className="space-y-1 text-sm">
            <Row label="SKU afectados" value={`${affected}`} />
            <Row label="Compra sugerida actual" value={formatCurrency(sim.before)} />
            <Row label="Compra sugerida simulada" value={formatCurrency(sim.after)} tone={sim.delta > 0 ? "bad" : sim.delta < 0 ? "good" : undefined} />
            <Row label="Cambio" value={`${sim.delta >= 0 ? "+" : "−"}${formatCurrency(Math.abs(sim.delta))} (${deltaPct >= 0 ? "+" : ""}${deltaPct}%)`} tone={sim.delta > 0 ? "bad" : sim.delta < 0 ? "good" : undefined} />
            <Row label="Riesgo" value={deltaPct > 15 ? "Más capital / sobrestock" : deltaPct < -15 ? "Posible quiebre" : "Bajo"} />
          </div>
          <p className="text-xs text-slate-500 mt-2">Recalculado con la fórmula del sistema sobre los SKU afectados. Aún no se aplica: revisa el impacto y luego guarda.</p>
        </div>

        <div className="flex items-center justify-between">
          <Link to={isGlobal(draft) ? "/productos" : `/productos?cat=${encodeURIComponent(draft.scope)}`} className="text-xs font-medium text-brand-600 hover:text-brand-700" onClick={onClose}>
            Ver productos afectados
          </Link>
          <button onClick={() => setDraft({ ...seedRules.find((s) => s.id === rule.id)! })} className="text-xs text-slate-500 hover:text-slate-700">Restaurar valores</button>
        </div>
      </div>
    </Drawer>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const cls = tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : "text-slate-800";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </div>
  );
}
