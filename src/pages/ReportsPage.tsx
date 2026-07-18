import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { DataTable, type Column } from "../components/ui/Table";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import { IconDownload } from "../components/ui/icons";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumber } from "../utils/formatters";
import {
  describePurchaseBffError,
  getExport,
  toPurchaseBffError,
  type ExportJobStatus,
  type ExportJobView,
} from "../services/purchaseBff";
import {
  downloadExportCsv,
  useExportCatalog,
  useExportJobs,
  useLaunchExport,
  type ExportLaunchState,
} from "../hooks/useExports";

// ============================================================================
//  #24 Reportes — conectado a Exportaciones E13 del purchase-bff.
//  Las tarjetas salen del catálogo real (GET /exports/catalog); "Generar CSV"
//  encola un job (202) que el runner del backend procesa: la UI pollea y avisa
//  honesto si el job sigue en cola (runner apagado en dev). El CSV se descarga
//  al terminar; "Exportaciones recientes" permite rebajar los ya generados.
//  Los reportes del prototipo sin fuente real quedan listados aparte, sin
//  botón de descarga: no se finge data.
// ============================================================================

/** Descripción corta local por reportId (el título viene del backend). */
const REPORT_DESCRIPTIONS: Record<string, string> = {
  recommendations: "Bandeja de reposición pendiente del motor",
  "purchase-orders": "Órdenes de compra emitidas",
  receptions: "Recepciones y cumplimiento",
  claims: "Reclamos a proveedor",
  suppliers: "Relación y métricas de proveedores",
  decisions: "Historial de decisiones y resultado E8",
};

/** Estado del job en la lista de recientes → chip. */
const JOB_STATUS_UI: Record<ExportJobStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "En cola", tone: "amber" },
  running: { label: "Generando", tone: "blue" },
  done: { label: "Listo", tone: "green" },
  failed: { label: "Falló", tone: "red" },
};

/** Vistas del prototipo aún sin fuente en el servicio de compras. */
const UPCOMING_REPORTS = [
  "Compras por categoría",
  "Compras por comprador",
  "Rotación y días de inventario",
  "Margen por categoría y canal",
  "Productos sin venta / críticos",
];

const fmtDate = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

export function ReportsPage() {
  const toast = useToast();
  const catalog = useExportCatalog();
  const jobs = useExportJobs();
  // Al encolar o terminar un job, la lista de recientes se refresca sola.
  const { states, launch } = useLaunchExport({ onJobsChanged: jobs.refetch });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const pageTitle = "Reportes";
  const pageDescription =
    "Exportaciones CSV generadas por el servicio de compras: reposición, órdenes, recepciones, reclamos, proveedores y decisiones.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!catalog.configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              generar y descargar los reportes reales del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (catalog.loading && catalog.items.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          aria-busy="true"
          aria-label="Cargando catálogo de reportes"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <div className="p-4 space-y-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-28" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (catalog.error && catalog.items.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar el catálogo de reportes
            </p>
            <p className="mt-1 text-sm text-slate-500">{catalog.error.message}</p>
            <Button className="mt-4" onClick={catalog.refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  //  Descarga desde "Exportaciones recientes": el CSV solo viaja en el GET
  //  por id, así que se re-consulta el job antes de bajar el archivo.
  // --------------------------------------------------------------------------
  const handleDownload = async (job: ExportJobView) => {
    setDownloadingId(job.id);
    try {
      const full = await getExport(job.id);
      if (full.status === "done" && downloadExportCsv(full)) {
        toast.success(
          `CSV descargado: ${full.title} (${formatNumber(full.rowCount ?? 0)} filas).`
        );
      } else {
        toast.warning("El CSV de este job aún no está disponible. Refresca la lista.");
        jobs.refetch();
      }
    } catch (err) {
      toast.error(describePurchaseBffError(toPurchaseBffError(err)));
    } finally {
      setDownloadingId(null);
    }
  };

  const jobColumns: Column<ExportJobView>[] = [
    {
      key: "title",
      header: "Reporte",
      render: (j) => (
        <div className="min-w-[160px]">
          <p className="text-sm font-medium text-slate-800">{j.title}</p>
          <p className="text-xs text-slate-400 font-mono">{j.reportId}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (j) => (
        <div className="min-w-[110px]">
          <Badge tone={JOB_STATUS_UI[j.status].tone} dot>
            {JOB_STATUS_UI[j.status].label}
          </Badge>
          {j.status === "failed" && j.error && (
            <p className="mt-1 text-xs text-rose-600 max-w-[220px] line-clamp-2" title={j.error}>
              {j.error}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "rows",
      header: "Filas",
      hideOnMobile: true,
      render: (j) => (
        <span className="text-sm text-slate-700">
          {j.rowCount == null ? "—" : formatNumber(j.rowCount)}
        </span>
      ),
    },
    {
      key: "created",
      header: "Creado",
      hideOnMobile: true,
      render: (j) => <span className="text-sm text-slate-700">{fmtDate(j.dateCreated)}</span>,
    },
    {
      key: "expires",
      header: "Expira",
      hideOnMobile: true,
      render: (j) => <span className="text-sm text-slate-500">{fmtDate(j.expiresAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (j) =>
        j.status === "done" ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<IconDownload className="w-4 h-4" />}
            loading={downloadingId === j.id}
            onClick={() => void handleDownload(j)}
          >
            Descargar
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      {/* =================== Catálogo real de reportes =================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {catalog.items.map((item) => {
          const state = states[item.reportId];
          const busy = state?.phase === "queued" || state?.phase === "running";
          return (
            <Card key={item.reportId}>
              <div className="p-4 flex flex-col h-full">
                <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500 flex-1">
                  {REPORT_DESCRIPTIONS[item.reportId] ?? "Exportación del servicio de compras"}
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={busy ? undefined : <IconDownload className="w-4 h-4" />}
                    loading={busy}
                    onClick={() => launch(item.reportId)}
                  >
                    {busy ? (state?.phase === "running" ? "Generando…" : "En cola…") : "Generar CSV"}
                  </Button>
                  <LaunchStatus state={state} />
                </div>
              </div>
            </Card>
          );
        })}
        {catalog.items.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <div className="p-6 text-center text-sm text-slate-500">
              El catálogo del servicio no trae reportes disponibles todavía.
            </div>
          </Card>
        )}
      </div>

      {/* =================== Exportaciones recientes =================== */}
      <Card className="mb-4">
        <CardHeader
          title="Exportaciones recientes"
          description="Jobs generados por el servicio; los CSV listos se pueden volver a descargar hasta que expiren."
          action={
            <Button variant="ghost" size="sm" loading={jobs.loading} onClick={jobs.refetch}>
              Refrescar
            </Button>
          }
        />
        {jobs.error && jobs.items.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500">
              No se pudieron cargar las exportaciones: {jobs.error.message}
            </p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={jobs.refetch}>
              Reintentar
            </Button>
          </div>
        ) : jobs.loading && jobs.items.length === 0 ? (
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando exportaciones">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <DataTable
            columns={jobColumns}
            data={jobs.items}
            rowKey={(j) => j.id}
            emptyMessage="Aún no has generado exportaciones. Lanza un reporte desde las tarjetas de arriba."
          />
        )}
      </Card>

      {/* =================== Próximos reportes (sin fuente real) =================== */}
      <CollapsibleSection
        id="reports:proximos"
        title="Próximos reportes"
        description="Vistas del prototipo que aún no tienen fuente de datos en el servicio de compras."
        hint={`${UPCOMING_REPORTS.length} en espera`}
      >
        <ul className="divide-y divide-slate-100">
          {UPCOMING_REPORTS.map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-slate-600">{name}</span>
              <span className="text-xs text-slate-400">Disponible cuando su fuente exista</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Estado visible del lanzamiento junto al botón de cada tarjeta.
// ----------------------------------------------------------------------------

function LaunchStatus({ state }: { state: ExportLaunchState | undefined }) {
  if (!state) return null;
  switch (state.phase) {
    case "done":
      return (
        <Badge tone="green">
          Descargado ✓ {formatNumber(state.rowCount ?? 0)} filas
        </Badge>
      );
    case "failed":
      return (
        <p className="text-xs text-rose-600 line-clamp-2" title={state.error ?? undefined}>
          Falló: {state.error ?? "error desconocido"}
        </p>
      );
    case "stalled":
      return (
        <p className="text-xs text-amber-600">
          Sigue en cola — reintenta refrescar en “Exportaciones recientes”.
        </p>
      );
    default:
      return null;
  }
}
