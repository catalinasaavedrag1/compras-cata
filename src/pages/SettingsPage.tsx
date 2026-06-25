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
import { formatDays, formatNumber, formatPercent } from "../utils/formatters";
import { IconRules, IconAlerts, IconArrowRight } from "../components/ui/icons";
import type { PurchaseRule } from "../types/purchasing";

type RuleHealth = "ok" | "review" | "incoherent" | "high_lead" | "overstock_risk" | "stockout_risk";

const HEALTH: Record<RuleHealth, { label: string; tone: BadgeTone }> = {
  ok: { label: "Correcta", tone: "green" },
  review: { label: "Requiere revisión", tone: "amber" },
  incoherent: { label: "Incoherente", tone: "red" },
  high_lead: { label: "Lead time alto", tone: "amber" },
  overstock_risk: { label: "Riesgo sobrestock", tone: "violet" },
  stockout_risk: { label: "Riesgo de quiebre", tone: "red" },
};

function healthOf(r: PurchaseRule): RuleHealth {
  if (r.maxStock > 0 && r.maxStock < r.minStock) return "incoherent";
  if (r.targetInventoryDays >= 55) return "overstock_risk";
  if (r.targetInventoryDays > 0 && r.targetInventoryDays <= 20) return "stockout_risk";
  if (r.leadTimeDays >= 15) return "high_lead";
  return "ok";
}

const isGlobal = (r: PurchaseRule) => r.scope.toLowerCase().startsWith("global");

function affectedCount(scope: string): number {
  if (scope.toLowerCase().startsWith("global")) return products.length;
  return products.filter((p) => p.category === scope).length;
}

const reasonFor: Record<RuleHealth, string> = {
  ok: "Parámetros dentro de rango.",
  review: "Revisar parámetros.",
  incoherent: "Stock máximo menor que el mínimo. Corregir.",
  high_lead: "Lead time alto: conviene comprar con más anticipación.",
  overstock_risk: "Días objetivo altos: posible sobrestock, sobre todo si es estacional.",
  stockout_risk: "Días objetivo bajos: riesgo de quiebre.",
};

export function SettingsPage() {
  const toast = useToast();
  const [rules, setRules] = useState<PurchaseRule[]>(seedRules);
  const [tab, setTab] = useState("categorias");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [editing, setEditing] = useState<PurchaseRule | null>(null);

  const withHealth = useMemo(() => rules.map((r) => ({ r, health: healthOf(r) })), [rules]);
  const propias = rules.filter((r) => !isGlobal(r)).length;
  const globales = rules.filter(isGlobal).length;
  const conAlerta = withHealth.filter((x) => x.health !== "ok").length;
  const leadProm = Math.round(rules.reduce((a, r) => a + r.leadTimeDays, 0) / rules.length);
  const diasProm = Math.round(rules.reduce((a, r) => a + r.targetInventoryDays, 0) / rules.length);

  const visible = onlyAlerts ? withHealth.filter((x) => x.health !== "ok") : withHealth;
  const alerts = withHealth.filter((x) => x.health !== "ok" && x.health !== "review");

  const columns: Column<{ r: PurchaseRule; health: RuleHealth }>[] = [
    {
      key: "scope",
      header: "Ámbito",
      render: ({ r }) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-slate-800">{r.scope}</p>
          <Badge tone={isGlobal(r) ? "slate" : "blue"}>{isGlobal(r) ? "Regla base" : "Personalizada"}</Badge>
        </div>
      ),
    },
    { key: "dias", header: "Días obj.", align: "right", render: ({ r }) => formatDays(r.targetInventoryDays) },
    { key: "stock", header: "Stock mín/máx", align: "right", hideOnMobile: true, render: ({ r }) => `${formatNumber(r.minStock)} / ${formatNumber(r.maxStock)}` },
    { key: "margin", header: "Margen mín.", align: "right", hideOnMobile: true, render: ({ r }) => formatPercent(r.minMargin, 0) },
    { key: "lead", header: "Lead time", align: "right", hideOnMobile: true, render: ({ r }) => formatDays(r.leadTimeDays) },
    { key: "impact", header: "Impacto", align: "right", hideOnMobile: true, render: ({ r }) => `${affectedCount(r.scope)} SKU` },
    { key: "health", header: "Estado", render: ({ health }) => <Badge tone={HEALTH[health].tone} dot>{HEALTH[health].label}</Badge> },
    {
      key: "action",
      header: "",
      render: ({ r }) => (
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Editar</Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reglas de compra"
        description="Cómo se calcula la compra sugerida por categoría. Revisa, detecta reglas mal configuradas y ajusta con impacto visible."
      />

      {/* Resumen KPI cliqueable */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard title="Con regla propia" value={formatNumber(propias)} tone="info" icon={<IconRules className="w-4 h-4" />} />
        <KpiCard title="Usan regla global" value={formatNumber(globales)} tone="neutral" icon={<IconRules className="w-4 h-4" />} />
        <KpiCard title="Requieren revisión" value={formatNumber(conAlerta)} tone={conAlerta ? "bad" : "good"} icon={<IconAlerts className="w-4 h-4" />} description="Filtrar" active={onlyAlerts} onClick={() => setOnlyAlerts((v) => !v)} />
        <KpiCard title="Días objetivo prom." value={formatDays(diasProm)} tone="neutral" icon={<IconRules className="w-4 h-4" />} />
        <KpiCard title="Lead time prom." value={formatDays(leadProm)} tone="neutral" icon={<IconRules className="w-4 h-4" />} />
      </div>

      {/* Alertas de configuración */}
      {alerts.length > 0 && (
        <Card className="mb-4">
          <CardHeader title="Qué reglas revisar" description="Configuraciones que pueden afectar la compra sugerida" />
          <CardBody className="space-y-2">
            {alerts.map(({ r, health }) => (
              <button key={r.id} onClick={() => setEditing(r)} className="flex w-full items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-left hover:border-brand-300">
                <Badge tone={HEALTH[health].tone} dot>{HEALTH[health].label}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{r.scope}</span>
                  <span className="block text-xs text-slate-500">{reasonFor[health]}</span>
                </span>
                <span className="text-xs font-medium text-brand-600 inline-flex items-center gap-1 flex-shrink-0">Editar <IconArrowRight className="w-3.5 h-3.5" /></span>
              </button>
            ))}
          </CardBody>
        </Card>
      )}

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "categorias", label: "Reglas por categoría", count: rules.length },
          { value: "excepciones", label: "Excepciones", count: specialRules.length },
          { value: "formula", label: "Cómo se calcula" },
        ]}
      />

      {tab === "categorias" && (
        <Card>
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
                    <Badge tone={isGlobal(r) ? "slate" : "blue"}>{isGlobal(r) ? "Regla base" : "Personalizada"}</Badge>
                  </div>
                  <Badge tone={HEALTH[health].tone} dot>{HEALTH[health].label}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div><p className="text-xs text-slate-400">Días obj.</p><p className="text-slate-700">{formatDays(r.targetInventoryDays)}</p></div>
                  <div><p className="text-xs text-slate-400">Mín/Máx</p><p className="text-slate-700">{formatNumber(r.minStock)}/{formatNumber(r.maxStock)}</p></div>
                  <div><p className="text-xs text-slate-400">Lead</p><p className="text-slate-700">{formatDays(r.leadTimeDays)}</p></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">{affectedCount(r.scope)} SKU afectados</p>
                <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Editar regla</Button>
              </div>
            )}
          />
        </Card>
      )}

      {tab === "excepciones" && (
        <Card>
          <CardHeader title="Excepciones y reglas especiales" description="Casos particulares del surtido" />
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {specialRules.map((s) => (
              <div key={s.title} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge tone="blue" dot>{s.title}</Badge>
                  <Badge tone="green">Activa</Badge>
                </div>
                <p className="text-sm text-slate-600">{s.description}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === "formula" && (
        <Card>
          <CardHeader title="Cómo se calcula la compra sugerida" />
          <CardBody>
            <div className="rounded-lg bg-slate-50 p-3 mb-3">
              <p className="text-sm text-slate-700 font-mono">Cantidad = (venta diaria × (lead time + días objetivo)) − stock disponible</p>
              <p className="text-xs text-slate-500 mt-1">Acotada por stock mínimo y máximo de la categoría.</p>
            </div>
            <p className="text-sm text-slate-600">Luego se ajusta por: margen mínimo, temporada, sobrestock, baja rotación y proveedores atrasados. Solo se recomienda comprar si hay riesgo de quiebre o necesidad real.</p>
          </CardBody>
        </Card>
      )}

      <RuleEditDrawer
        rule={editing}
        onClose={() => setEditing(null)}
        onSave={(updated) => {
          setRules((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          setEditing(null);
          toast.success(`Regla de ${updated.scope} actualizada`);
        }}
      />
    </div>
  );
}

function RuleEditDrawer({ rule, onClose, onSave }: { rule: PurchaseRule | null; onClose: () => void; onSave: (r: PurchaseRule) => void }) {
  const [draft, setDraft] = useState<PurchaseRule | null>(null);
  // Sincroniza el borrador cuando cambia la regla
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

  // Impacto estimado (mock): cambio en días objetivo ≈ cambio en compra sugerida
  const affected = affectedCount(draft.scope);
  const deltaPct = rule.targetInventoryDays > 0 ? Math.round((draft.targetInventoryDays / rule.targetInventoryDays - 1) * 100) : 0;

  return (
    <Drawer
      open={!!rule}
      onClose={onClose}
      title={`Editar regla · ${rule.scope}`}
      description="Ajusta los parámetros. Verás el impacto antes de guardar."
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

        {/* Simulador de impacto */}
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Impacto estimado</p>
          <div className="space-y-1 text-sm">
            <Row label="SKU afectados" value={`${affected}`} />
            <Row label="Cambio en compra sugerida" value={`${deltaPct >= 0 ? "+" : ""}${deltaPct}%`} tone={deltaPct > 0 ? "bad" : deltaPct < 0 ? "good" : undefined} />
            <Row label="Riesgo" value={deltaPct > 15 ? "Más capital / sobrestock" : deltaPct < -15 ? "Posible quiebre" : "Bajo"} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Link to={`/productos?cat=${encodeURIComponent(isGlobal(draft) ? "" : draft.scope)}`} className="text-xs font-medium text-brand-600 hover:text-brand-700" onClick={onClose}>
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
