import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { purchaseRules as seedRules, specialRules } from "../data/mockRules";
import { formatDays, formatNumber, formatPercent } from "../utils/formatters";
import { IconRules } from "../components/ui/icons";
import type { PurchaseRule } from "../types/purchasing";

const CALC_STEPS = [
  "Se revisa la venta histórica del producto (30, 90 y 180 días).",
  "Se calcula la rotación y los días de inventario actuales.",
  "Se considera el stock disponible (descontando el comprometido).",
  "Se suma el lead time del proveedor a los días objetivo de inventario.",
  "Se respetan el stock mínimo y máximo definidos por categoría.",
  "Se alerta si hay sobrestock o baja rotación (sugerencia = 0).",
  "Se recomienda comprar solo si existe riesgo de quiebre o necesidad real.",
];

export function SettingsPage() {
  const [rules, setRules] = useState<PurchaseRule[]>(seedRules);
  const [edited, setEdited] = useState(false);

  const updateRule = (id: string, field: keyof PurchaseRule, value: number) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setEdited(true);
  };

  const columns: Column<PurchaseRule>[] = [
    {
      key: "scope",
      header: "Ámbito",
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.scope}</p>
          <p className="text-xs text-slate-500 max-w-xs">{r.notes}</p>
        </div>
      ),
    },
    {
      key: "targetDays",
      header: "Días objetivo",
      align: "right",
      render: (r) => (
        <NumberCell value={r.targetInventoryDays} onChange={(v) => updateRule(r.id, "targetInventoryDays", v)} suffix="d" />
      ),
    },
    {
      key: "min",
      header: "Stock mín.",
      align: "right",
      hideOnMobile: true,
      render: (r) => <NumberCell value={r.minStock} onChange={(v) => updateRule(r.id, "minStock", v)} />,
    },
    {
      key: "max",
      header: "Stock máx.",
      align: "right",
      hideOnMobile: true,
      render: (r) => <NumberCell value={r.maxStock} onChange={(v) => updateRule(r.id, "maxStock", v)} />,
    },
    {
      key: "margin",
      header: "Margen mín.",
      align: "right",
      render: (r) => <NumberCell value={r.minMargin} onChange={(v) => updateRule(r.id, "minMargin", v)} suffix="%" />,
    },
    {
      key: "lead",
      header: "Lead time",
      align: "right",
      hideOnMobile: true,
      render: (r) => <NumberCell value={r.leadTimeDays} onChange={(v) => updateRule(r.id, "leadTimeDays", v)} suffix="d" />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reglas de compra"
        description="Parámetros que alimentan el cálculo de la compra sugerida. Ajusta los días objetivo, stock mín/máx, margen mínimo y lead time por categoría."
        action={
          <Button
            disabled={!edited}
            onClick={() => setEdited(false)}
            icon={<IconRules className="w-4 h-4" />}
          >
            {edited ? "Guardar cambios" : "Sin cambios"}
          </Button>
        }
      />

      {edited && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          Tienes cambios sin guardar en las reglas. (En esta demo los cambios no se persisten en un backend.)
        </div>
      )}

      <Card className="mb-5">
        <CardHeader
          title="Reglas por categoría"
          description="Editable. Cada categoría puede sobrescribir la regla global por defecto."
        />
        <DataTable columns={columns} data={rules} rowKey={(r) => r.id} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Cómo se calcula la compra sugerida" description="Lógica paso a paso, en lenguaje simple" />
          <CardBody>
            <ol className="space-y-2.5">
              {CALC_STEPS.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Fórmula simplificada</p>
              <p className="text-sm text-slate-700 font-mono">
                Cantidad = (venta diaria × (lead time + días objetivo)) − stock disponible
              </p>
              <p className="text-xs text-slate-500 mt-1">Acotada por el stock mínimo y máximo de la categoría.</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reglas especiales" description="Casos particulares del surtido" />
          <CardBody className="space-y-3">
            {specialRules.map((r) => (
              <div key={r.title} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="blue" dot>{r.title}</Badge>
                </div>
                <p className="text-sm text-slate-600">{r.description}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Resumen de parámetros activos" />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Summary label="Categorías con regla propia" value={formatNumber(rules.length - 1)} />
            <Summary label="Días objetivo promedio" value={formatDays(Math.round(rules.reduce((a, r) => a + r.targetInventoryDays, 0) / rules.length))} />
            <Summary label="Margen mínimo promedio" value={formatPercent(rules.reduce((a, r) => a + r.minMargin, 0) / rules.length, 0)} />
            <Summary label="Lead time promedio" value={formatDays(Math.round(rules.reduce((a, r) => a + r.leadTimeDays, 0) / rules.length))} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function NumberCell({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-right focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}
