import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { FilterBar } from "../components/business/FilterBar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Drawer } from "../components/ui/Drawer";
import { Skeleton } from "../components/ui/Skeleton";
import { DataTable, type Column } from "../components/ui/Table";
import { useUrlState } from "../utils/useUrlState";
import { useRole } from "../context/RoleContext";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";

import { uniqueValues } from "../utils/filters";
import { formatDate, formatNumber } from "../utils/formatters";
import { TODAY_ISO } from "../utils/constants";
import { IconAlerts, IconCheck, IconClock, IconPlus, IconBox } from "../components/ui/icons";
import {
  describePurchaseBffError,
  getPurchaseOrder,
  toPurchaseBffError,
  type ReceptionDetailView,
  type ReceptionItemView,
  type ReceptionTransitionAction,
} from "../services/purchaseBff";
import { useReceptions, type ReceptionListRow } from "../hooks/useReceptions";
import {
  IN_PROGRESS_STATUSES,
  ISSUE_STATUSES,
  RECEPTION_NEXT_ACTIONS,
  RECEPTION_STATUS_UI,
  describeReceptionConflict,
  isDelayed,
  lineMissing,
  lineStatus,
} from "./receptions/helpers";
import { ReceptionDetail } from "./receptions/ReceptionDetail";
import { RegisterReceptionDrawer } from "./receptions/RegisterReceptionDrawer";

// ============================================================================
//  Recepciones (flujo 4) conectadas al purchase-bff-service. El mapeo de la
//  máquina real de estados a las etiquetas/badges existentes vive en
//  ./receptions/helpers.ts (RECEPTION_STATUS_UI). "Atrasada" es derivada.
//  La atribución por comprador del mock no viene en el contrato: el servicio
//  acota por credenciales de sesión (igual que en el flujo 3), por lo que el
//  selector de alcance por comprador y el bloque "Responsables de reordenar"
//  quedan para el flujo que conecte el directorio de compradores.
// ============================================================================

/** Nombre legible de cada vista (las KPIs son el selector; esto da contexto). */
const VIEW_LABELS: Record<string, string> = {
  undelivered: "No despachado",
  arriving: "Por llegar",
  delayed: "Atrasadas",
  issues: "Con problemas",
  received: "Recibidas",
  all: "Todas las recepciones",
};

/** Toast por transición aplicada (complete se resuelve según el resultado). */
const TRANSITION_TOAST: Record<Exclude<ReceptionTransitionAction, "complete">, string> = {
  mark_in_transit: "Recepción marcada en tránsito",
  mark_arrived: "Recepción marcada como arribada",
  start_checking: "Revisión iniciada: verifica lo recibido y complétala",
  reject: "Recepción rechazada",
};

interface MissingLine {
  r: ReceptionListRow;
  it: ReceptionItemView;
  missing: number;
}

/** Unidades esperadas/recibidas de una fila (solo si trae items del detalle). */
function unitsOf(r: ReceptionListRow): { expected: number; received: number } | null {
  if (!r.items || r.items.length === 0) return null;
  return {
    expected: r.items.reduce((sum, it) => sum + (it.qtyExpected ?? 0), 0),
    received: r.items.reduce((sum, it) => sum + (it.qtyReceived ?? 0), 0),
  };
}

/** Fecha de referencia para filtros y orden (la esperada del contrato). */
const refDate = (r: ReceptionListRow) => r.expectedDate?.slice(0, 10) ?? "";

/** ¿Atrasada? (derivado: aún no llega y venció su fecha esperada). */
const delayed = (r: ReceptionListRow) => isDelayed(r.status, r.expectedDate, TODAY_ISO);

export function ReceptionsPage() {
  const navigate = useNavigate();
  const { role } = useRole();
  const isLeader = role === "lider";
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();
  // El líder aterriza en "No despachado" (su vista accionable: qué proveedores
  // no cumplieron); el comprador, en lo que viene en camino.
  const [tab, setTab] = useUrlState("tab", isLeader ? "undelivered" : "arriving");
  const [query, setQuery] = useUrlState("q");
  const [supplier, setSupplier] = useUrlState("prov");
  const [from, setFrom] = useUrlState("desde");
  const [to, setTo] = useUrlState("hasta");

  const {
    receptions,
    loading,
    error: listError,
    configured,
    refetch,
    fetchDetail,
    fetchByRid,
    applyTransition,
    register,
  } = useReceptions();

  const [detail, setDetail] = useState<ReceptionDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [reorderBusySku, setReorderBusySku] = useState<string | null>(null);

  // Deep-link: /recepciones?rid=<id|displayId> abre el detalle vía la API.
  const [searchParams, setSearchParams] = useSearchParams();
  const ridParam = searchParams.get("rid");
  useEffect(() => {
    if (!ridParam || !configured) return;
    let active = true;
    setDetailLoading(true);
    void fetchByRid(ridParam).then((result) => {
      if (!active) return;
      setDetailLoading(false);
      if (result.ok) setDetail(result.reception);
      else toast.warning(describePurchaseBffError(result.error));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ridParam, configured]);

  const closeDetail = () => {
    setDetail(null);
    setDetailLoading(false);
    setRejectOpen(false);
    if (ridParam) {
      searchParams.delete("rid");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    const result = await fetchDetail(id);
    setDetailLoading(false);
    if (result.ok) setDetail(result.reception);
    else toast.error(describePurchaseBffError(result.error));
  };

  const byFilters = useMemo(
    () =>
      receptions.filter((r) => {
        if (
          query.trim() &&
          !`${r.displayId} ${r.poNumber ?? ""} ${r.supplierRef ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
          return false;
        if (supplier && r.supplierRef !== supplier) return false;
        if (from && (refDate(r) === "" || refDate(r) < from)) return false;
        if (to && (refDate(r) === "" || refDate(r) > to)) return false;
        return true;
      }),
    [receptions, query, supplier, from, to]
  );

  // Líneas con faltante de las recepciones con diferencias (items del detalle).
  const undeliveredLines = useMemo<MissingLine[]>(
    () =>
      byFilters
        .filter((r) => r.status === "discrepancy")
        .flatMap((r) =>
          (r.items ?? [])
            .filter((it) => lineMissing(it) > 0)
            .map((it) => ({ r, it, missing: lineMissing(it) }))
        )
        .sort((a, b) => b.missing - a.missing),
    [byFilters]
  );

  // Agrupado por proveedor (quién no cumple). El contrato entrega la
  // referencia del proveedor (supplierRef); el nombre llega al conectar proveedores.
  const bySupplier = useMemo(() => {
    const m = new Map<string, MissingLine[]>();
    undeliveredLines.forEach((l) => {
      const key = l.r.supplierRef ?? "Sin proveedor";
      const arr = m.get(key) ?? [];
      arr.push(l);
      m.set(key, arr);
    });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [undeliveredLines]);

  const counts = {
    arriving: byFilters.filter((r) => IN_PROGRESS_STATUSES.includes(r.status)).length,
    received: byFilters.filter((r) => r.status === "completed").length,
    issues: byFilters.filter((r) => ISSUE_STATUSES.includes(r.status)).length,
    delayed: byFilters.filter(delayed).length,
    undelivered: undeliveredLines.length,
    all: byFilters.length,
  };

  const filtered = useMemo(() => {
    let base = byFilters;
    if (tab === "arriving") base = base.filter((r) => IN_PROGRESS_STATUSES.includes(r.status));
    else if (tab === "received") base = base.filter((r) => r.status === "completed");
    else if (tab === "issues") base = base.filter((r) => ISSUE_STATUSES.includes(r.status));
    else if (tab === "delayed") base = base.filter(delayed);
    return [...base].sort((a, b) => {
      const da = refDate(a) || "9999-12-31";
      const db = refDate(b) || "9999-12-31";
      return da < db ? -1 : 1;
    });
  }, [byFilters, tab]);

  const resultCount = tab === "undelivered" ? counts.undelivered : filtered.length;

  // --------------------------------------------------------------------------
  //  Reordenar lo no despachado: la línea de la OC de origen trae el snapshot
  //  real (proveedor/categoría/costo) que exige el borrador de propuesta.
  // --------------------------------------------------------------------------
  const reorderLine = async (
    ctx: { purchaseOrderId: string; supplierRef: string | null },
    it: ReceptionItemView
  ) => {
    const sku = it.sku;
    const missing = lineMissing(it);
    if (!sku || missing <= 0) return;
    const name = it.skuName ?? sku;
    if (hasItem(sku)) {
      toast.info(`${name} ya está en el borrador de OC`);
      return;
    }
    setReorderBusySku(sku);
    try {
      const po = await getPurchaseOrder(ctx.purchaseOrderId);
      const line = po.lines?.find((l) => l.lineId === it.purchaseOrderLineId);
      const added = addItem({
        sku,
        productName: name,
        supplierName: ctx.supplierRef ?? po.supplierId ?? "Sin proveedor",
        quantity: missing,
        unitCost: line?.unitCostClp ?? 0,
        supplierId: po.supplierId ?? undefined,
        categoryId: line?.categoryId ?? undefined,
      });
      if (added) {
        toast.success(`${name}: ${formatNumber(missing)} u. agregadas al borrador de OC`, {
          label: "Ver borrador OC",
          onClick: () => navigate("/comprar/seguimiento"),
        });
      }
    } catch (err) {
      toast.error(describePurchaseBffError(toPurchaseBffError(err)));
    } finally {
      setReorderBusySku(null);
    }
  };

  // --------------------------------------------------------------------------
  //  Transiciones C21 (If-Match). VERSION_CONFLICT → aviso + recarga; 409 de
  //  estado inválido → mensaje legible con {current, allowed}.
  // --------------------------------------------------------------------------
  const runTransition = async (action: ReceptionTransitionAction, reason?: string) => {
    if (!detail) return;
    setActionBusy(true);
    const result = await applyTransition(detail.id, detail.version, action, reason);
    setActionBusy(false);
    if (result.ok) {
      setDetail(result.reception);
      setRejectOpen(false);
      if (action === "complete") {
        if (result.reception.status === "discrepancy") {
          toast.warning(
            "Recepción completada con diferencias — la OC quedó actualizada con lo recibido"
          );
        } else {
          toast.success("Recepción completada conforme — la OC quedó actualizada");
        }
      } else {
        toast.success(TRANSITION_TOAST[action]);
      }
      return;
    }
    const info = result.error;
    if (info.code === "VERSION_CONFLICT") {
      toast.warning("La recepción cambió en otra sesión; se recargaron los datos");
    } else if (info.code === "CONFLICT") {
      toast.error(describeReceptionConflict(info) ?? describePurchaseBffError(info));
    } else {
      toast.error(describePurchaseBffError(info));
      return;
    }
    // Estado o versión obsoletos: refrescar el detalle abierto.
    const fresh = await fetchDetail(detail.id);
    if (fresh.ok) setDetail(fresh.reception);
    setRejectOpen(false);
  };

  const detailMissing = (detail?.items ?? []).filter((it) => lineMissing(it) > 0);
  const detailActions = detail ? (RECEPTION_NEXT_ACTIONS[detail.status] ?? []) : [];

  // --------------------------------------------------------------------------
  //  Tabla
  // --------------------------------------------------------------------------
  const columns: Column<ReceptionListRow>[] = [
    {
      key: "po",
      header: "Orden / Proveedor",
      render: (r) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-slate-800">{r.poNumber ?? r.displayId}</p>
          <p
            className="text-xs text-slate-500"
            title="Ficha de proveedor disponible al conectar proveedores"
          >
            {r.supplierRef ?? "—"}
          </p>
          <p className="text-xs text-slate-400">
            {r.displayId} · {r.warehouseId}
          </p>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Esperada / Recibida",
      hideOnMobile: true,
      render: (r) => (
        <div className="text-sm">
          <p className="text-slate-700">{refDate(r) ? formatDate(refDate(r)) : "—"}</p>
          <p className="text-xs text-slate-400">
            {r.status === "completed"
              ? "recibida"
              : r.status === "discrepancy"
                ? "con diferencias"
                : r.status === "rejected"
                  ? "rechazada"
                  : "pendiente"}
          </p>
        </div>
      ),
    },
    {
      key: "recepcion",
      header: "Recepción",
      align: "right",
      render: (r) => {
        const units = unitsOf(r);
        if (!units) {
          return (
            <span className="text-sm text-slate-600">
              {formatNumber(r.itemCount)} {r.itemCount === 1 ? "ítem" : "ítems"}
            </span>
          );
        }
        const p = units.expected > 0 ? Math.round((units.received / units.expected) * 100) : 0;
        const missCount = (r.items ?? []).filter((it) => lineMissing(it) > 0).length;
        return (
          <div className="text-sm min-w-[110px]">
            <p className="font-medium text-slate-800">
              {formatNumber(units.received)}/{formatNumber(units.expected)} u.
            </p>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : p > 0 ? "bg-amber-500" : "bg-slate-300"}`}
                style={{ width: `${Math.max(3, p)}%` }}
              />
            </div>
            {missCount > 0 && (
              <p className="text-[11px] text-rose-600 mt-1">
                {missCount} SKU{missCount === 1 ? "" : "s"} sin despachar
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "quality",
      header: "Calidad",
      render: (r) =>
        r.status === "completed" ? (
          <Badge tone="green" dot>
            Conforme
          </Badge>
        ) : r.hasDiscrepancy ? (
          <Badge tone="red" dot>
            Con diferencias
          </Badge>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <div>
          <Badge tone={RECEPTION_STATUS_UI[r.status].tone} dot>
            {RECEPTION_STATUS_UI[r.status].label}
          </Badge>
          {delayed(r) && <p className="text-[11px] text-rose-600 mt-0.5">atrasada</p>}
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      render: () => <span className="text-xs font-medium text-brand-600">Ver detalle →</span>,
    },
  ];

  const connectionState = !configured
    ? "not-configured"
    : loading && receptions.length === 0
      ? "loading"
      : listError && receptions.length === 0
        ? "error"
        : null;

  return (
    <div>
      <PageHeader
        title="Recepciones"
        description={
          isLeader
            ? "Qué llegó, qué SKUs no despachó cada proveedor y qué debe reordenarse. Visión del equipo."
            : "Qué viene en camino, qué llegó y qué SKUs el proveedor no despachó para que no se queden sin reponer."
        }
        action={
          <Button
            onClick={() => setRegisterOpen(true)}
            icon={<IconPlus className="w-4 h-4" />}
            disabled={!configured}
          >
            Registrar recepción
          </Button>
        }
      />

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar recepción, OC o proveedor"
          resultCount={resultCount}
          summary={`${counts.undelivered} SKUs sin despachar · ${counts.arriving} por llegar · ${counts.delayed} atrasadas`}
          onClear={() => {
            setQuery("");
            setSupplier("");
            setFrom("");
            setTo("");
          }}
          dateRange={{
            value: { from, to },
            onChange: (r) => {
              setFrom(r.from);
              setTo(r.to);
            },
            label: "Fecha esperada",
          }}
          selects={[
            {
              key: "prov",
              placeholder: "Proveedor",
              value: supplier,
              onChange: setSupplier,
              options: uniqueValues(
                receptions.filter((r) => r.supplierRef),
                (r) => r.supplierRef ?? ""
              ).map((s) => ({ value: s, label: s })),
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard
          title="No despachado"
          value={formatNumber(counts.undelivered)}
          tone="bad"
          icon={<IconBox className="w-4 h-4" />}
          description="SKUs que el proveedor no envió"
          active={tab === "undelivered"}
          onClick={() => setTab("undelivered")}
        />
        <KpiCard
          title="Por llegar"
          value={formatNumber(counts.arriving)}
          tone="info"
          icon={<IconClock className="w-4 h-4" />}
          description="En camino o en revisión"
          active={tab === "arriving"}
          onClick={() => setTab("arriving")}
        />
        <KpiCard
          title="Atrasadas"
          value={formatNumber(counts.delayed)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Debieron llegar"
          active={tab === "delayed"}
          onClick={() => setTab("delayed")}
        />
        <KpiCard
          title="Con problemas"
          value={formatNumber(counts.issues)}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Con diferencias o rechazadas"
          active={tab === "issues"}
          onClick={() => setTab("issues")}
        />
        <KpiCard
          title="Recibidas"
          value={formatNumber(counts.received)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
          description="Conformes"
          active={tab === "received"}
          onClick={() => setTab("received")}
        />
      </div>

      {/* Vista activa: las KPIs de arriba son el selector. Esta línea da contexto
          (qué estás viendo y cuántos) y la salida a "Todas" — sin duplicar la navegación. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 text-sm">
        <span className="text-slate-500">Mostrando</span>
        <span className="font-semibold text-slate-800">
          {VIEW_LABELS[tab] ?? "Todas las recepciones"}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">
          {formatNumber(resultCount)}{" "}
          {tab === "undelivered"
            ? resultCount === 1
              ? "SKU sin despachar"
              : "SKUs sin despachar"
            : resultCount === 1
              ? "recepción"
              : "recepciones"}
        </span>
        {tab !== "all" && (
          <button
            onClick={() => setTab("all")}
            className="ml-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Ver todas
          </button>
        )}
      </div>

      {connectionState === "not-configured" ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver las recepciones reales y registrar recepciones contra OC.
            </p>
          </div>
        </Card>
      ) : connectionState === "loading" ? (
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando recepciones">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      ) : connectionState === "error" ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las recepciones
            </p>
            <p className="mt-1 text-sm text-slate-500">{listError?.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : tab === "undelivered" ? (
        <>
          <HelpNote className="mb-4">
            Lo que <b>pediste pero el proveedor no despachó</b> (recepciones completadas con
            diferencias). Reordénalo aquí para que no quede como "ya comprado" y termine en quiebre.
          </HelpNote>

          {undeliveredLines.length === 0 ? (
            <Card>
              <div className="p-8 text-center text-sm text-slate-500">
                {byFilters.length === 0
                  ? "Sin recepciones para los filtros."
                  : "Sin SKUs pendientes por despachar. 🎉"}
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {bySupplier.map(([sup, lines]) => (
                <Card key={sup}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 border-b border-slate-100">
                    <p
                      className="text-sm font-semibold text-slate-800"
                      title="Ficha de proveedor disponible al conectar proveedores"
                    >
                      {sup}
                    </p>
                    <span
                      className="text-xs text-slate-400"
                      title="Disponible al conectar proveedores"
                    >
                      Despacho <b>—</b> · A tiempo <b>—</b>
                    </span>
                    <span className="flex-1" />
                    <span className="text-xs font-semibold text-rose-600">
                      {lines.length} SKU{lines.length === 1 ? "" : "s"} sin despachar
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {lines.map(({ r, it, missing }) => {
                      const st = lineStatus(it);
                      const sku = it.sku ?? "";
                      return (
                        <div key={`${r.id}-${it.itemId}`} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-slate-400">{sku || "—"}</span>
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </div>
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {it.skuName ?? sku ?? "—"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.poNumber ?? "—"} · {r.displayId}
                            </p>
                          </div>
                          <div className="text-right text-sm flex-shrink-0">
                            <p className="text-slate-700">
                              {formatNumber(it.qtyReceived ?? 0)}/{formatNumber(it.qtyExpected ?? 0)}{" "}
                              u.
                            </p>
                            <p className="text-xs font-semibold text-rose-600">
                              faltan {formatNumber(missing)}
                            </p>
                          </div>
                          {sku.length > 0 && (
                            <Button
                              size="sm"
                              variant={hasItem(sku) ? "secondary" : "primary"}
                              disabled={hasItem(sku) || reorderBusySku === sku}
                              icon={<IconPlus className="w-3.5 h-3.5" />}
                              onClick={() =>
                                void reorderLine(
                                  { purchaseOrderId: r.purchaseOrderId, supplierRef: r.supplierRef },
                                  it
                                )
                              }
                            >
                              {hasItem(sku)
                                ? "En OC"
                                : reorderBusySku === sku
                                  ? "Agregando…"
                                  : "Reordenar"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <HelpNote className="mb-4">
            La barra de <b>recepción</b> muestra cuánto llegó vs lo pedido cuando la recepción tiene
            diferencias. Toca una recepción para ver el <b>detalle por producto</b>, avanzar su
            estado y reordenar lo no despachado.
          </HelpNote>
          <Card>
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => void openDetail(r.id)}
              rowClassName={(r) =>
                ISSUE_STATUSES.includes(r.status) || delayed(r) ? "bg-rose-50/40" : undefined
              }
              emptyMessage="Sin recepciones para los filtros."
              mobileCard={(r) => {
                const units = unitsOf(r);
                return (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">{r.poNumber ?? r.displayId}</p>
                        <p className="text-xs text-slate-500">
                          {r.supplierRef ?? "—"} · {r.warehouseId}
                        </p>
                      </div>
                      <Badge tone={RECEPTION_STATUS_UI[r.status].tone} dot>
                        {RECEPTION_STATUS_UI[r.status].label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Esperada</p>
                        <p className="text-slate-700">
                          {refDate(r) ? formatDate(refDate(r)) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Recepción</p>
                        <p className="text-slate-700">
                          {units
                            ? `${formatNumber(units.received)}/${formatNumber(units.expected)} u.`
                            : `${formatNumber(r.itemCount)} ítems`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Calidad</p>
                        <p
                          className={
                            r.status === "completed"
                              ? "text-emerald-600"
                              : r.hasDiscrepancy
                                ? "text-rose-600"
                                : "text-slate-400"
                          }
                        >
                          {r.status === "completed"
                            ? "Conforme"
                            : r.hasDiscrepancy
                              ? "Con diferencias"
                              : "—"}
                        </p>
                      </div>
                    </div>
                    {delayed(r) && (
                      <p className="text-xs text-rose-600 mt-1.5 font-medium">
                        Atrasada · debió llegar {formatDate(refDate(r))}
                      </p>
                    )}
                  </div>
                );
              }}
            />
          </Card>
        </>
      )}

      {/* Detalle de recepción (datos reales bajo demanda) */}
      <Drawer
        open={detail !== null || detailLoading}
        onClose={closeDetail}
        title={detail ? (detail.purchaseOrder?.number ?? detail.displayId) : "Cargando recepción…"}
        description={
          detail
            ? `${detail.displayId} · ${detail.purchaseOrder?.supplierRef ?? "—"} · bodega ${detail.warehouseId}`
            : ""
        }
        footer={
          detail && (detailActions.length > 0 || detailMissing.length > 0) ? (
            <>
              {detail.status === "discrepancy" && detailMissing.length > 0 && (
                <Button
                  variant="secondary"
                  icon={<IconPlus className="w-4 h-4" />}
                  disabled={reorderBusySku !== null}
                  onClick={async () => {
                    for (const it of detailMissing) {
                      await reorderLine(
                        {
                          purchaseOrderId: detail.purchaseOrderId,
                          supplierRef: detail.purchaseOrder?.supplierRef ?? null,
                        },
                        it
                      );
                    }
                  }}
                >
                  Reordenar todo lo no despachado
                </Button>
              )}
              {detailActions.map(({ action, label }) => (
                <Button
                  key={action}
                  variant={action === "reject" ? "secondary" : "primary"}
                  disabled={actionBusy}
                  onClick={() =>
                    action === "reject" ? setRejectOpen(true) : void runTransition(action)
                  }
                >
                  {actionBusy ? "Aplicando…" : label}
                </Button>
              ))}
            </>
          ) : undefined
        }
      >
        {detail ? (
          <ReceptionDetail
            detail={detail}
            hasItem={hasItem}
            reorderBusySku={reorderBusySku}
            reorder={(it) =>
              void reorderLine(
                {
                  purchaseOrderId: detail.purchaseOrderId,
                  supplierRef: detail.purchaseOrder?.supplierRef ?? null,
                },
                it
              )
            }
          />
        ) : (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando recepción">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </Drawer>

      {/* Rechazo: el motivo es obligatorio (auditable en el dominio) */}
      {detail && rejectOpen && (
        <RejectReceptionModal
          receptionLabel={detail.purchaseOrder?.number ?? detail.displayId}
          busy={actionBusy}
          onClose={() => setRejectOpen(false)}
          onConfirm={(reason) => void runTransition("reject", reason)}
        />
      )}

      {/* Registro manual de recepción contra una OC real (C21) */}
      {registerOpen && (
        <RegisterReceptionDrawer
          onClose={() => setRegisterOpen(false)}
          onRegister={register}
          onRegistered={(reception) => {
            setRegisterOpen(false);
            setDetail(reception);
          }}
        />
      )}
    </div>
  );
}

/** Modal mínimo de rechazo de recepción: el motivo es obligatorio. */
function RejectReceptionModal({
  receptionLabel,
  busy,
  onClose,
  onConfirm,
}: {
  receptionLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Rechazar recepción"
      description={receptionLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button disabled={!trimmed || busy} onClick={() => onConfirm(trimmed)}>
            {busy ? "Rechazando…" : "Rechazar recepción"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          La recepción queda rechazada y no descarga cantidades en la OC. Esta acción queda trazada
          con su motivo.
        </p>
        <Input
          label="Motivo (obligatorio)"
          placeholder="Ej: mercadería en mal estado, pedido equivocado…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}
