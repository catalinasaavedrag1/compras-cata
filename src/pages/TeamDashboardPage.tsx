import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { DataTable, type Column } from "../components/ui/Table";
import { useToast } from "../context/ToastContext";
import { useCategoriesPanel } from "../hooks/useCategoriesPanel";
import {
  buyerInitials,
  buyerLabel,
  totalOpenItems,
  useReassignCategory,
  useTeamWorkload,
} from "../hooks/useTeam";
import { describePurchaseBffError, type BuyerWorkloadRow } from "../services/purchaseBff";
import { categoryPath } from "../utils/entityLinks";
import { PILL_TONE } from "../utils/tone";
import { formatDate, formatNumber } from "../utils/formatters";
import { IconAlerts, IconChevronRight } from "../components/ui/icons";

// ============================================================================
//  Panel del equipo (líder) conectado al purchase-bff-service (F15):
//  GET /team/workload alimenta los KPIs (sumas de los contadores reales), las
//  excepciones y la tabla por comprador. Las secciones sin fuente en el
//  contrato (score, ranking, metas, venta) quedan como estados vacíos honestos
//  hasta que llegue el flujo de desempeño. "Reasignar categoría" ejecuta el
//  C18 real (PUT /team/assignments) con el reintento por 409 de useTeam.
// ============================================================================

const AVATAR_TONES = ["blue", "violet", "green", "amber", "red"];

const fmtAsOf = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Excepción derivada de los contadores reales del workload (sin mocks). */
interface TeamException {
  key: string;
  title: string;
  detail: string;
  tone: "red" | "amber";
  to: string;
}

function exceptionsOf(rows: BuyerWorkloadRow[]): TeamException[] {
  const out: TeamException[] = [];
  for (const row of rows) {
    const name = buyerLabel(row);
    if (row.counts.criticalPending > 0) {
      out.push({
        key: `${row.buyerId}-critical`,
        title: `${formatNumber(row.counts.criticalPending)} recomendaciones críticas sin resolver`,
        detail: `${name} · quiebres inminentes en su cartera`,
        tone: "red",
        to: "/equipo/carga",
      });
    }
    if (row.counts.alertsActive > 0) {
      out.push({
        key: `${row.buyerId}-alerts`,
        title: `${formatNumber(row.counts.alertsActive)} alertas activas`,
        detail: `${name} · revisar en alertas del equipo`,
        tone: "amber",
        to: "/equipo/alertas",
      });
    }
    if (row.counts.claimsOpen > 0) {
      out.push({
        key: `${row.buyerId}-claims`,
        title: `${formatNumber(row.counts.claimsOpen)} reclamos abiertos`,
        detail: `${name} · seguimiento con proveedores`,
        tone: "amber",
        to: "/reclamos",
      });
    }
  }
  // Rojas primero; corte en 4 para mantener el foco de la vista original.
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "red" ? -1 : 1)).slice(0, 4);
}

export function TeamDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { rows, asOf, loading, error, configured, refetch } = useTeamWorkload();
  const categoriesPanel = useCategoriesPanel();
  const reassign = useReassignCategory();

  const [reassignOpen, setReassignOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [targetBuyerId, setTargetBuyerId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Nombre legible de cada categoría de la cartera (id → nombre del panel F12).
  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesPanel.rows) map.set(c.categoryId, c.name);
    return map;
  }, [categoriesPanel.rows]);

  const totals = useMemo(() => {
    const sum = (f: (r: BuyerWorkloadRow) => number) => rows.reduce((acc, r) => acc + f(r), 0);
    return {
      recommendationsPending: sum((r) => r.counts.recommendationsPending),
      criticalPending: sum((r) => r.counts.criticalPending),
      proposalsOpen: sum((r) => r.counts.proposalsOpen),
      ordersOpen: sum((r) => r.counts.ordersOpen),
      receptionsPending: sum((r) => r.counts.receptionsPending),
      claimsOpen: sum((r) => r.counts.claimsOpen),
      alertsActive: sum((r) => r.counts.alertsActive),
      signalsOpen: sum((r) => r.counts.signalsOpen),
      decisionsPending: sum((r) => r.counts.decisionsPending),
      activeBuyers: rows.filter((r) => r.active).length,
    };
  }, [rows]);

  const exceptions = useMemo(() => exceptionsOf(rows), [rows]);
  const board = useMemo(
    () => [...rows].sort((a, b) => totalOpenItems(b.counts) - totalOpenItems(a.counts)),
    [rows]
  );

  const pageTitle = "Panel del equipo";
  const pageDescription =
    "Cómo está funcionando el área de compras hoy. Primero las excepciones, luego los indicadores.";

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
              ver la carga real del equipo y gestionar la cartera.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando carga del equipo">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar la carga del equipo
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

  const kpis: {
    title: string;
    value: string;
    sub: string;
    tone: "neutral" | "good" | "warn" | "bad" | "info";
  }[] = [
    {
      title: "Compras pendientes",
      value: formatNumber(totals.recommendationsPending),
      sub: `${formatNumber(totals.criticalPending)} críticas`,
      tone: totals.criticalPending > 0 ? "bad" : "warn",
    },
    {
      title: "Propuestas abiertas",
      value: formatNumber(totals.proposalsOpen),
      sub: "En preparación o revisión",
      tone: "info",
    },
    {
      title: "OC abiertas",
      value: formatNumber(totals.ordersOpen),
      sub: "En curso con proveedores",
      tone: "neutral",
    },
    {
      title: "Recepciones pendientes",
      value: formatNumber(totals.receptionsPending),
      sub: "Por confirmar en bodega",
      tone: "warn",
    },
    {
      title: "Reclamos abiertos",
      value: formatNumber(totals.claimsOpen),
      sub: "En gestión con proveedores",
      tone: totals.claimsOpen > 0 ? "warn" : "neutral",
    },
    {
      title: "Alertas activas",
      value: formatNumber(totals.alertsActive),
      sub: "Del motor comercial",
      tone: totals.alertsActive > 0 ? "bad" : "neutral",
    },
    {
      title: "Señales abiertas",
      value: formatNumber(totals.signalsOpen),
      sub: "Reportadas desde ventas",
      tone: "info",
    },
    {
      title: "Decisiones pendientes",
      value: formatNumber(totals.decisionsPending),
      sub: "Por evaluar resultado",
      tone: "neutral",
    },
  ];

  const toneOf = (i: number) => PILL_TONE[AVATAR_TONES[i % AVATAR_TONES.length]];

  const columns: Column<BuyerWorkloadRow>[] = [
    {
      key: "buyer",
      header: "Comprador",
      render: (r) => {
        const idx = board.findIndex((b) => b.buyerId === r.buyerId);
        return (
          <div className="flex items-center gap-2.5 min-w-[160px]">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${toneOf(idx)}`}
            >
              {buyerInitials(r)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{buyerLabel(r)}</p>
              {!r.active && <Badge tone="neutral">Inactivo</Badge>}
            </div>
          </div>
        );
      },
    },
    {
      key: "categories",
      header: "Cartera",
      render: (r) =>
        r.categories.length === 0 ? (
          <span className="text-xs text-slate-400">Sin categorías asignadas</span>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-w-[280px]">
            {r.categories.map((c) => (
              <Link
                key={c}
                to={categoryPath(c)}
                className="inline-flex items-center border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50/40"
                onClick={(e) => e.stopPropagation()}
              >
                {categoryNames.get(c) ?? c}
              </Link>
            ))}
          </div>
        ),
    },
    {
      key: "pending",
      header: "Pend.",
      align: "right",
      sortable: true,
      sortValue: (r) => r.counts.recommendationsPending,
      render: (r) => (
        <span className="text-sm font-semibold text-slate-700">
          {formatNumber(r.counts.recommendationsPending)}
        </span>
      ),
    },
    {
      key: "critical",
      header: "Crít.",
      align: "right",
      sortable: true,
      sortValue: (r) => r.counts.criticalPending,
      render: (r) => (
        <span
          className={`text-sm font-semibold ${r.counts.criticalPending > 0 ? "text-rose-600" : "text-slate-400"}`}
        >
          {formatNumber(r.counts.criticalPending)}
        </span>
      ),
    },
    {
      key: "proposals",
      header: "Prop.",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatNumber(r.counts.proposalsOpen),
    },
    {
      key: "orders",
      header: "OC",
      align: "right",
      render: (r) => formatNumber(r.counts.ordersOpen),
    },
    {
      key: "receptions",
      header: "Recep.",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatNumber(r.counts.receptionsPending),
    },
    {
      key: "claims",
      header: "Recl.",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatNumber(r.counts.claimsOpen),
    },
    {
      key: "alerts",
      header: "Alertas",
      align: "right",
      render: (r) => (
        <span
          className={`text-sm font-semibold ${r.counts.alertsActive > 0 ? "text-amber-600" : "text-slate-400"}`}
        >
          {formatNumber(r.counts.alertsActive)}
        </span>
      ),
    },
    {
      key: "signals",
      header: "Señales",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatNumber(r.counts.signalsOpen),
    },
    {
      key: "decisions",
      header: "Decis.",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatNumber(r.counts.decisionsPending),
    },
  ];

  const closeReassign = () => {
    setReassignOpen(false);
    setCategoryId("");
    setTargetBuyerId("");
    setReason("");
  };

  const submitReassign = async () => {
    if (!categoryId || !targetBuyerId || saving) return;
    setSaving(true);
    const result = await reassign(categoryId, {
      buyerId: targetBuyerId,
      reason: reason.trim() || undefined,
    });
    setSaving(false);
    if (result.ok) {
      const target = rows.find((r) => r.buyerId === targetBuyerId);
      toast.success(
        `Categoría ${categoryNames.get(categoryId) ?? categoryId} reasignada a ${target ? buyerLabel(target) : targetBuyerId}`
      );
      closeReassign();
      refetch();
      categoriesPanel.refetch();
    } else {
      toast.error(describePurchaseBffError(result.error));
    }
  };

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={<Button onClick={() => setReassignOpen(true)}>Reasignar categoría…</Button>}
      />

      {/* Hero del equipo + excepciones */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 mb-4">
        <div
          className="rounded-2xl p-5 text-white flex flex-col justify-between"
          style={{ background: "linear-gradient(135deg,#1f2a5a,#3b2f7a)" }}
        >
          <div>
            <p className="text-sm text-indigo-200 font-medium">Equipo de compras</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl font-bold tracking-tight">{rows.length}</span>
              <span className="text-base text-indigo-200">compradores</span>
            </div>
            <span className="inline-block mt-1 text-sm font-semibold text-emerald-300">
              {totals.activeBuyers} activos
            </span>
          </div>
          <div className="flex gap-5 mt-5">
            <div>
              <p className="text-[11px] text-indigo-300">Ítems abiertos</p>
              <p className="text-base font-semibold">
                {formatNumber(rows.reduce((acc, r) => acc + totalOpenItems(r.counts), 0))}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-indigo-300">Actualizado</p>
              <p className="text-base font-semibold">{fmtAsOf(asOf)}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Requiere tu atención"
            action={
              <button
                onClick={() => navigate("/equipo/alertas")}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Ver alertas del equipo
              </button>
            }
          />
          <CardBody className="space-y-2">
            {exceptions.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">
                Sin excepciones ahora: nadie tiene pendientes críticos, alertas ni reclamos
                abiertos.
              </p>
            ) : (
              exceptions.map((e) => (
                <button
                  key={e.key}
                  onClick={() => navigate(e.to)}
                  className="flex items-center gap-3 w-full text-left rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: e.tone === "red" ? "#f43f5e" : "#f59e0b",
                  }}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{e.title}</span>
                    <span className="block text-xs text-slate-400 truncate">{e.detail}</span>
                  </span>
                  <Badge tone={e.tone}>{e.tone === "red" ? "Alta" : "Media"}</Badge>
                </button>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* KPIs del equipo = sumas de los contadores reales por comprador */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.title}
            title={k.title}
            value={k.value}
            description={k.sub}
            tone={k.tone}
            icon={<IconAlerts className="w-4 h-4" />}
          />
        ))}
      </div>

      {/* Desempeño: sin fuente en el contrato del BFF → vacío honesto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader title="Mejor desempeño" />
          <CardBody>
            <p className="text-sm text-slate-400">Disponible con el flujo de desempeño.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Necesita apoyo" />
          <CardBody>
            <p className="text-sm text-slate-400">Disponible con el flujo de desempeño.</p>
          </CardBody>
        </Card>
      </div>

      {/* Carga por comprador (contadores reales del workload) */}
      <Card>
        <CardHeader
          title="Carga del equipo"
          action={
            <button
              onClick={() => navigate("/equipo/carga")}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
            >
              Equilibrar carga <IconChevronRight className="w-3 h-3" />
            </button>
          }
        />
        <DataTable
          columns={columns}
          data={board}
          rowKey={(r) => r.buyerId}
          emptyMessage="Aún no hay compradores con carga registrada."
        />
      </Card>

      {/* Modal: reasignar categoría (C18 real, con reintento por 409) */}
      <Modal
        open={reassignOpen}
        onClose={closeReassign}
        title="Reasignar categoría"
        description="Mueve una categoría de la cartera a otro comprador. El cambio queda registrado en el servicio de compras."
        footer={
          <>
            <Button variant="secondary" onClick={closeReassign}>
              Cancelar
            </Button>
            <Button
              onClick={() => void submitReassign()}
              disabled={!categoryId || !targetBuyerId || saving}
            >
              {saving ? "Reasignando…" : "Reasignar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Categoría"
            placeholder={
              categoriesPanel.loading ? "Cargando categorías…" : "Selecciona una categoría"
            }
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categoriesPanel.rows.map((c) => {
              const owner = rows.find((r) => r.buyerId === c.buyerId);
              return {
                value: c.categoryId,
                label: c.buyerId
                  ? `${c.name} — hoy: ${owner ? buyerLabel(owner) : c.buyerId}`
                  : `${c.name} — sin responsable`,
              };
            })}
          />
          {categoriesPanel.error && (
            <p className="text-xs text-rose-600">
              No se pudieron cargar las categorías: {categoriesPanel.error.message}
            </p>
          )}
          <Select
            label="Nuevo comprador responsable"
            placeholder="Selecciona un comprador"
            value={targetBuyerId}
            onChange={(e) => setTargetBuyerId(e.target.value)}
            options={rows
              .filter((r) => r.active)
              .map((r) => ({
                value: r.buyerId,
                label: `${buyerLabel(r)} · ${formatNumber(totalOpenItems(r.counts))} ítems abiertos`,
              }))}
          />
          <Input
            label="Motivo (opcional)"
            placeholder="Ej: equilibrio de carga, vacaciones, especialidad"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
