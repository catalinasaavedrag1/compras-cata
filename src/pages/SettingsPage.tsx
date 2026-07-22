import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Tabs } from "../components/ui/Tabs";
import { Skeleton } from "../components/ui/Skeleton";
import { KpiCard } from "../components/business/KpiCard";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumber } from "../utils/formatters";
import { IconLock, IconPlus, IconRules } from "../components/ui/icons";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import { RULE_ADMIN_PERMISSION, RULE_KEY_REGEX, useRules } from "../hooks/useRules";
import { useCategoriesPanel } from "../hooks/useCategoriesPanel";
import { useSuppliersPanel } from "../hooks/useSuppliersPanel";
import { describePurchaseBffError, type RuleScopeType, type RuleView } from "../services/purchaseBff";

// ============================================================================
//  Reglas de compra reales (F20): GET /rules del purchase-bff-service.
//  El contrato es genérico clave-valor por alcance (global / categoría /
//  proveedor / comprador) — la antigua tabla rica del mock (min/máx stock,
//  margen, lead time por categoría) no existe como tal: aquí se muestran las
//  reglas reales con su valor, motivo, vigencia y estado, y se crean/editan/
//  desactivan sobre ese modelo. La edición está gateada por
//  purchase:rule:admin (mismo patrón candado que GoalsPage/Aprobaciones); el
//  motivo es SIEMPRE obligatorio porque el backend lo audita.
// ============================================================================

const SCOPE_UI: Record<RuleScopeType, { label: string; tone: BadgeTone }> = {
  global: { label: "Global", tone: "slate" },
  category: { label: "Categoría", tone: "blue" },
  supplier: { label: "Proveedor", tone: "violet" },
  buyer: { label: "Comprador", tone: "amber" },
};

/** Claves hoy en uso por el seed/motor: selector de alta + etiquetas legibles. */
const KNOWN_KEYS: { key: string; label: string; unit: string; description: string }[] = [
  {
    key: "replenishment.target_coverage_days",
    label: "Cobertura objetivo",
    unit: "días",
    description: "Días de inventario que el motor busca cubrir al sugerir compra.",
  },
  {
    key: "replenishment.lead_time_buffer_days",
    label: "Colchón de lead time",
    unit: "días",
    description: "Días extra sobre el lead time del proveedor al calcular la necesidad.",
  },
  {
    key: "approval.high_amount_clp",
    label: "Monto alto de aprobación",
    unit: "CLP",
    description: "Sobre este monto la propuesta exige aprobación del líder.",
  },
  {
    key: "approval.excessive_coverage_days",
    label: "Cobertura excesiva",
    unit: "días",
    description: "Sobre esta cobertura la propuesta queda marcada para aprobación.",
  },
  {
    key: "pricing.price_drift_pct",
    label: "Desvío de precio",
    unit: "%",
    description: "Variación de costo frente a la lista que dispara la alerta de precio.",
  },
];

const knownKey = (key: string) => KNOWN_KEYS.find((k) => k.key === key);

/** Copy explicativo del comportamiento del motor (contenido estático, no datos). */
const SPECIAL_RULES: { title: string; description: string }[] = [
  {
    title: "Productos nuevos",
    description:
      "Sin historial de venta: compra inicial conservadora basada en categoría similar. Revisar a las 4 semanas.",
  },
  {
    title: "Productos de temporada",
    description:
      "Reposición concentrada en pre-temporada. Fuera de temporada se marca 'No comprar' aunque baje el stock.",
  },
  {
    title: "Productos de baja venta",
    description:
      "Si la rotación es menor a 1 vez al año, no se sugiere compra y se evalúa descontinuar.",
  },
  {
    title: "Sobrestock",
    description:
      "Si la cobertura supera el máximo de la categoría, la sugerencia se fija en 0 y se alerta capital inmovilizado.",
  },
  {
    title: "Proveedores atrasados",
    description:
      "Si el cumplimiento del proveedor es menor a 70%, se prioriza buscar proveedor alternativo para SKUs críticos.",
  },
];

/** Valor de una regla como texto (número u objeto según el contrato). */
function formatRuleValue(rule: RuleView): string {
  const { value } = rule;
  if (typeof value === "number") {
    const unit = knownKey(rule.key)?.unit;
    const num = Number.isInteger(value) ? formatNumber(value) : String(value).replace(".", ",");
    return unit ? `${num} ${unit}` : num;
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Valor editable como texto plano (para prellenar el formulario). */
function ruleValueAsInput(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Interpreta el texto ingresado: número u objeto/array JSON (nada de inventar campos). */
function parseRuleValueInput(
  raw: string
): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "Ingresa un valor." };
  const asNumber = Number(trimmed.replace(",", "."));
  if (Number.isFinite(asNumber) && /^-?[\d.,]+$/.test(trimmed)) {
    return { ok: true, value: asNumber };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, message: "El valor debe ser un número o un objeto JSON válido." };
  }
}

const fmtIsoDate = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "—");

export function SettingsPage() {
  const toast = useToast();
  const { hasPermission } = usePurchaseContext();
  const canAdmin = hasPermission(RULE_ADMIN_PERMISSION);

  const { rules, loading, error, configured, refetch, create, patch } = useRules();

  // Nombres reales de categorías y proveedores (F12) para resolver scopeRef.
  const categoriesPanel = useCategoriesPanel();
  const suppliersPanel = useSuppliersPanel("", "");

  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [editing, setEditing] = useState<RuleView | null>(null);
  const [creating, setCreating] = useState(false);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of categoriesPanel.rows) map.set(row.categoryId, row.name);
    return map;
  }, [categoriesPanel.rows]);

  const supplierNameByRef = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of suppliersPanel.rows) {
      map.set(row.supplierId, row.name);
      if (row.sapCardCode) map.set(row.sapCardCode, row.name);
    }
    return map;
  }, [suppliersPanel.rows]);

  /** Nombre visible del alcance (cae al id crudo si el panel no lo resolvió). */
  const scopeLabel = (rule: RuleView): string => {
    if (rule.scopeType === "global" || !rule.scopeRef) return "Todas las compras";
    if (rule.scopeType === "category") {
      return categoryNameById.get(rule.scopeRef) ?? rule.scopeRef;
    }
    if (rule.scopeType === "supplier") {
      return supplierNameByRef.get(rule.scopeRef) ?? rule.scopeRef;
    }
    return rule.scopeRef; // buyer: el id es la referencia visible
  };

  const visible = useMemo(
    () => (scopeFilter === "all" ? rules : rules.filter((r) => r.scopeType === scopeFilter)),
    [rules, scopeFilter]
  );
  const scopeCount = (t: string) =>
    t === "all" ? rules.length : rules.filter((r) => r.scopeType === t).length;

  const activeCount = rules.filter((r) => r.active).length;
  const overrideCount = rules.filter((r) => r.active && r.scopeType !== "global").length;
  const distinctKeys = new Set(rules.map((r) => r.key)).size;
  const inactiveCount = rules.length - activeCount;

  const pageTitle = "Reglas de compra";
  const pageDescription =
    "Parámetros del motor por alcance: global, categoría, proveedor o comprador. Cada cambio queda auditado con su motivo.";

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
              ver y administrar las reglas reales del motor de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && rules.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando reglas">
            {Array.from({ length: 6 }).map((_, i) => (
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

  if (error && rules.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">No se pudieron cargar las reglas</p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const columns: Column<RuleView>[] = [
    {
      key: "key",
      header: "Regla",
      render: (r) => {
        const known = knownKey(r.key);
        return (
          <div className="min-w-[200px]">
            <p className="font-medium text-slate-800">{known?.label ?? r.key}</p>
            <p className="text-xs font-mono text-slate-400">{r.key}</p>
          </div>
        );
      },
    },
    {
      key: "scope",
      header: "Ámbito",
      render: (r) => (
        <div className="min-w-[140px]">
          <p className="text-sm text-slate-700">{scopeLabel(r)}</p>
          <Badge tone={SCOPE_UI[r.scopeType].tone}>{SCOPE_UI[r.scopeType].label}</Badge>
        </div>
      ),
    },
    {
      key: "value",
      header: "Valor",
      align: "right",
      render: (r) => (
        <span className="font-semibold text-slate-900 tabular-nums">{formatRuleValue(r)}</span>
      ),
    },
    {
      key: "reason",
      header: "Motivo",
      hideOnMobile: true,
      render: (r) => (
        <p className="max-w-[220px] text-xs text-slate-500" title={r.reason}>
          {r.reason || "—"}
        </p>
      ),
    },
    {
      key: "validFrom",
      header: "Vigencia",
      align: "right",
      hideOnMobile: true,
      render: (r) => <span className="text-xs text-slate-500">{fmtIsoDate(r.validFrom)}</span>,
    },
    {
      key: "modified",
      header: "Modificada",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        <div className="text-xs text-slate-500">
          <p>{fmtIsoDate(r.dateModified)}</p>
          <p className="text-slate-400">{r.userModified || "—"}</p>
        </div>
      ),
    },
    {
      key: "active",
      header: "Estado",
      render: (r) => (
        <Badge tone={r.active ? "green" : "neutral"} dot>
          {r.active ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "",
      render: (r) =>
        canAdmin ? (
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
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      {/* Resumen KPI sobre las reglas reales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Reglas activas"
          value={formatNumber(activeCount)}
          tone="info"
          icon={<IconRules className="w-4 h-4" />}
        />
        <KpiCard
          title="Overrides por alcance"
          value={formatNumber(overrideCount)}
          tone="neutral"
          icon={<IconRules className="w-4 h-4" />}
          description="Categoría, proveedor o comprador"
        />
        <KpiCard
          title="Claves distintas"
          value={formatNumber(distinctKeys)}
          tone="neutral"
          icon={<IconRules className="w-4 h-4" />}
        />
        <KpiCard
          title="Inactivas"
          value={formatNumber(inactiveCount)}
          tone={inactiveCount > 0 ? "warn" : "good"}
          icon={<IconRules className="w-4 h-4" />}
        />
      </div>

      {/* Filtro por alcance + alta gateada por permiso */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={scopeFilter}
          onChange={setScopeFilter}
          tabs={[
            { value: "all", label: "Todas", count: scopeCount("all") },
            { value: "global", label: "Global", count: scopeCount("global") },
            { value: "category", label: "Categoría", count: scopeCount("category") },
            { value: "supplier", label: "Proveedor", count: scopeCount("supplier") },
            { value: "buyer", label: "Comprador", count: scopeCount("buyer") },
          ]}
        />
        <span className="flex-1" />
        {canAdmin ? (
          <Button size="sm" icon={<IconPlus className="w-3.5 h-3.5" />} onClick={() => setCreating(true)}>
            Nueva regla
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <IconLock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span>
              Crear o editar reglas requiere el permiso{" "}
              <b className="text-slate-700">{RULE_ADMIN_PERMISSION}</b> en tu sesión.
            </span>
          </div>
        )}
      </div>

      {/* 2 columnas en escritorio: tabla + ayuda siempre visible */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Reglas"
              description="La regla más específica del alcance gana sobre la global."
            />
            {rules.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-semibold text-slate-800">Sin reglas configuradas</p>
                <p className="mt-1 text-sm text-slate-500">
                  El motor opera con sus valores por defecto hasta que se cree la primera regla.
                </p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={visible}
                rowKey={(r) => r.id}
                onRowClick={canAdmin ? (r) => setEditing(r) : undefined}
                emptyMessage="No hay reglas para este alcance."
                mobileCard={(r) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {knownKey(r.key)?.label ?? r.key}
                        </p>
                        <p className="text-xs font-mono text-slate-400">{r.key}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge tone={SCOPE_UI[r.scopeType].tone}>
                            {SCOPE_UI[r.scopeType].label}
                          </Badge>
                          <span className="text-xs text-slate-500">{scopeLabel(r)}</span>
                        </div>
                      </div>
                      <Badge tone={r.active ? "green" : "neutral"} dot>
                        {r.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatRuleValue(r)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.reason || "—"}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Vigente desde {fmtIsoDate(r.validFrom)} · mod. {fmtIsoDate(r.dateModified)}
                    </p>
                    {canAdmin && (
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
                    )}
                  </div>
                )}
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Claves del motor" />
            <CardBody className="space-y-2">
              {KNOWN_KEYS.map((k) => (
                <div key={k.key} className="rounded-lg border border-slate-200 p-2.5">
                  <p className="text-sm font-medium text-slate-800">{k.label}</p>
                  <p className="text-xs font-mono text-slate-400">{k.key}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{k.description}</p>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Excepciones y reglas especiales"
              description="Comportamiento fijo del motor de recomendaciones (no configurable aquí)."
            />
            <CardBody className="space-y-2">
              {SPECIAL_RULES.map((s) => (
                <div key={s.title} className="rounded-lg border border-slate-200 p-2.5">
                  <Badge tone="blue" dot>
                    {s.title}
                  </Badge>
                  <p className="mt-1 text-xs text-slate-600">{s.description}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <RuleEditModal
        rule={editing}
        scopeLabel={editing ? scopeLabel(editing) : ""}
        onClose={() => setEditing(null)}
        onSave={async (id, body) => {
          const result = await patch(id, body);
          if (result.ok) {
            toast.success("Regla actualizada");
            setEditing(null);
          } else {
            toast.error(describePurchaseBffError(result.error));
          }
          return result.ok;
        }}
      />

      {creating && (
        <RuleCreateModal
          categories={categoriesPanel.rows.map((c) => ({ value: c.categoryId, label: c.name }))}
          suppliers={suppliersPanel.rows.map((s) => ({ value: s.supplierId, label: s.name }))}
          onClose={() => setCreating(false)}
          onCreate={async (body) => {
            const result = await create(body);
            if (result.ok) {
              toast.success("Regla creada");
              setCreating(false);
            } else {
              // 409 CONFLICT_ERROR (regla activa duplicada por alcance+clave)
              // y demás errores: mensaje del backend.
              toast.error(describePurchaseBffError(result.error));
            }
            return result.ok;
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Edición: cambiar valor y/o activar-desactivar. El motivo es obligatorio.
// ----------------------------------------------------------------------------
function RuleEditModal({
  rule,
  scopeLabel,
  onClose,
  onSave,
}: {
  rule: RuleView | null;
  scopeLabel: string;
  onClose: () => void;
  onSave: (id: string, body: { value?: unknown; active?: boolean; reason: string }) => Promise<boolean>;
}) {
  const [valueInput, setValueInput] = useState("");
  const [activeInput, setActiveInput] = useState("true");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (rule && loadedFor !== rule.id) {
    setValueInput(ruleValueAsInput(rule.value));
    setActiveInput(rule.active ? "true" : "false");
    setReason("");
    setLoadedFor(rule.id);
  }
  if (!rule) return null;

  const parsed = parseRuleValueInput(valueInput);
  const valueChanged = valueInput.trim() !== ruleValueAsInput(rule.value);
  const activeChanged = (activeInput === "true") !== rule.active;
  const dirty = valueChanged || activeChanged;
  const valueError = valueChanged && !parsed.ok ? parsed.message : null;
  const canSave = dirty && !valueError && reason.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    const body: { value?: unknown; active?: boolean; reason: string } = { reason: reason.trim() };
    if (valueChanged && parsed.ok) body.value = parsed.value;
    if (activeChanged) body.active = activeInput === "true";
    const ok = await onSave(rule.id, body);
    setSaving(false);
    if (ok) setLoadedFor(null);
  };

  const known = knownKey(rule.key);

  return (
    <Modal
      open={!!rule}
      onClose={onClose}
      title={`Editar regla · ${known?.label ?? rule.key}`}
      description={`${SCOPE_UI[rule.scopeType].label}: ${scopeLabel}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={() => void submit()}>
            {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <p>
            Clave <code className="font-mono text-slate-700">{rule.key}</code>
          </p>
          <p className="mt-0.5">
            Vigente desde {fmtIsoDate(rule.validFrom)} · última modificación{" "}
            {fmtIsoDate(rule.dateModified)} ({rule.userModified || "—"})
          </p>
        </div>
        <Input
          label={known ? `Valor (${known.unit})` : "Valor (número u objeto JSON)"}
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
        />
        {valueError && <p className="text-xs text-rose-600">{valueError}</p>}
        <Select
          label="Estado"
          value={activeInput}
          onChange={(e) => setActiveInput(e.target.value)}
          options={[
            { value: "true", label: "Activa" },
            { value: "false", label: "Inactiva" },
          ]}
        />
        <Input
          label="Motivo del cambio (obligatorio)"
          placeholder="Ej: ajuste por quiebres recurrentes en la categoría…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          El motivo queda registrado en la auditoría de la regla.
        </p>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
//  Alta (solo líder): clave conocida o libre, alcance y referencia reales.
// ----------------------------------------------------------------------------
const CUSTOM_KEY = "__custom__";

function RuleCreateModal({
  categories,
  suppliers,
  onClose,
  onCreate,
}: {
  categories: { value: string; label: string }[];
  suppliers: { value: string; label: string }[];
  onClose: () => void;
  onCreate: (body: {
    scopeType: RuleScopeType;
    scopeRef?: string;
    key: string;
    value: unknown;
    reason: string;
  }) => Promise<boolean>;
}) {
  const [keyChoice, setKeyChoice] = useState<string>(KNOWN_KEYS[0].key);
  const [customKey, setCustomKey] = useState("");
  const [scopeType, setScopeType] = useState<RuleScopeType>("global");
  const [scopeRef, setScopeRef] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const key = keyChoice === CUSTOM_KEY ? customKey.trim() : keyChoice;
  const keyValid = RULE_KEY_REGEX.test(key);
  const parsed = parseRuleValueInput(valueInput);
  const needsRef = scopeType !== "global";
  const refValid = !needsRef || scopeRef.trim().length > 0;
  const canSave = keyValid && parsed.ok && refValid && reason.trim().length > 0 && !saving;

  const known = knownKey(key);

  const submit = async () => {
    if (!canSave || !parsed.ok) return;
    setSaving(true);
    await onCreate({
      scopeType,
      scopeRef: needsRef ? scopeRef.trim() : undefined,
      key,
      value: parsed.value,
      reason: reason.trim(),
    });
    setSaving(false);
  };

  const refOptions =
    scopeType === "category" ? categories : scopeType === "supplier" ? suppliers : [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva regla"
      description="Una regla activa por combinación de alcance y clave; si ya existe, el servicio la rechaza."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={() => void submit()}>
            {saving ? "Creando…" : "Crear regla"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Clave"
          value={keyChoice}
          onChange={(e) => setKeyChoice(e.target.value)}
          options={[
            ...KNOWN_KEYS.map((k) => ({ value: k.key, label: `${k.label} · ${k.key}` })),
            { value: CUSTOM_KEY, label: "Otra clave…" },
          ]}
        />
        {keyChoice === CUSTOM_KEY && (
          <div>
            <Input
              label="Clave libre (minúsculas con puntos)"
              placeholder="ej: replenishment.mi_parametro"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
            {customKey.trim().length > 0 && !keyValid && (
              <p className="mt-1 text-xs text-rose-600">
                Formato inválido: usa minúsculas, números y guiones bajos separados por puntos.
              </p>
            )}
          </div>
        )}
        {known && <p className="text-xs text-slate-500">{known.description}</p>}
        <Select
          label="Alcance"
          value={scopeType}
          onChange={(e) => {
            setScopeType(e.target.value as RuleScopeType);
            setScopeRef("");
          }}
          options={[
            { value: "global", label: "Global (todas las compras)" },
            { value: "category", label: "Categoría" },
            { value: "supplier", label: "Proveedor" },
            { value: "buyer", label: "Comprador" },
          ]}
        />
        {(scopeType === "category" || scopeType === "supplier") &&
          (refOptions.length > 0 ? (
            <Select
              label={scopeType === "category" ? "Categoría" : "Proveedor"}
              value={scopeRef}
              onChange={(e) => setScopeRef(e.target.value)}
              placeholder={
                scopeType === "category" ? "Selecciona una categoría" : "Selecciona un proveedor"
              }
              options={refOptions}
            />
          ) : (
            <Input
              label={
                scopeType === "category"
                  ? "ID de categoría (panel no disponible)"
                  : "ID de proveedor (panel no disponible)"
              }
              value={scopeRef}
              onChange={(e) => setScopeRef(e.target.value)}
            />
          ))}
        {scopeType === "buyer" && (
          <Input
            label="ID del comprador"
            placeholder="ej: cata"
            value={scopeRef}
            onChange={(e) => setScopeRef(e.target.value)}
          />
        )}
        <Input
          label={known ? `Valor (${known.unit})` : "Valor (número u objeto JSON)"}
          placeholder={known ? "ej: 45" : 'ej: 45 o {"max": 10}'}
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
        />
        {valueInput.trim().length > 0 && !parsed.ok && (
          <p className="text-xs text-rose-600">{parsed.message}</p>
        )}
        <Input
          label="Motivo (obligatorio)"
          placeholder="Ej: política de cobertura acordada con gerencia…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          El motivo queda registrado en la auditoría de la regla.
        </p>
      </div>
    </Modal>
  );
}
