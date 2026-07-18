import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Chip } from "../components/ui/Chip";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../context/ToastContext";
import { useImports, type ImportActionResult } from "../hooks/useImports";
import { describePurchaseBffError, type ImportStage, type ImportView } from "../services/purchaseBff";
import { supplierPath } from "../utils/entityLinks";
import { formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";
import { IconTruck, IconClock, IconAlerts, IconSearch, IconBox } from "../components/ui/icons";

// ============================================================================
//  Importaciones (F16) conectadas al purchase-bff-service: pipeline real
//  po → production → shipping → customs → warehouse (solo avanza; retroceder
//  responde 409). Las columnas del mock sin fuente en el contrato (incoterm,
//  costo puesto en bodega, naviera, tipo de cambio…) quedan fuera: la fila
//  muestra OC, proveedor, forwarder, ETA, etapa (con su historia) y documentos.
//  Los documentos son referencias al DMS (kind + dmsRef): el binario vive allá.
// ============================================================================

/** Orden del pipeline y etiquetas ES de cada etapa (locales a esta pantalla). */
const IMPORT_PIPELINE: ImportStage[] = ["po", "production", "shipping", "customs", "warehouse"];

const STAGE_UI: Record<ImportStage, { label: string; tone: BadgeTone }> = {
  po: { label: "OC emitida", tone: "slate" },
  production: { label: "En producción", tone: "blue" },
  shipping: { label: "En tránsito", tone: "violet" },
  customs: { label: "En aduana", tone: "amber" },
  warehouse: { label: "En bodega", tone: "green" },
};

/** Etapa siguiente del pipeline (null en bodega: no hay más avance). */
function nextStage(stage: ImportStage): Exclude<ImportStage, "po"> | null {
  const idx = IMPORT_PIPELINE.indexOf(stage);
  const next = IMPORT_PIPELINE[idx + 1];
  return (next as Exclude<ImportStage, "po">) ?? null;
}

/** Tipos de documento de importación del contrato (POST /imports/:id/docs). */
const IMPORT_DOC_KIND_LABEL: Record<string, string> = {
  bl: "BL (conocimiento de embarque)",
  invoice: "Factura",
  packing_list: "Packing list",
  certificate: "Certificado",
  customs: "Aduana",
  other: "Otro",
};

const DOC_KIND_OPTIONS = Object.entries(IMPORT_DOC_KIND_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const fmtDate = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "—");

const daysToEta = (eta: string, today: string) =>
  Math.round((Date.parse(eta) - Date.parse(today)) / 86_400_000);

const whenEta = (d: number) =>
  d < 0 ? `hace ${-d}d` : d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d}d`;

export function ImportsPage() {
  const [stageFilter, setStageFilter] = useState<ImportStage | "">("");
  const [q, setQ] = useState("");
  const { imports, loading, error, configured, refetch, fetchDetail, create, advance, addDoc } =
    useImports({ stage: stageFilter, q });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const active = imports.filter((i) => i.stage !== "warehouse");
    const withEta = active.filter((i) => i.etaDate);
    const overdue = withEta.filter((i) => daysToEta(i.etaDate as string, today) < 0).length;
    const next = [...withEta].sort((a, b) =>
      (a.etaDate as string) < (b.etaDate as string) ? -1 : 1
    )[0];
    return {
      active: active.length,
      customs: imports.filter((i) => i.stage === "customs").length,
      overdue,
      next,
    };
  }, [imports, today]);

  const detail = detailId ? (imports.find((i) => i.id === detailId) ?? null) : null;

  const pageTitle = "Compras importadas";
  const pageDescription =
    "Torre de control de importaciones: pipeline por etapas, fechas (ETA), forwarder y documentos referenciados al DMS.";

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
              ver el pipeline real de importaciones y gestionarlo contra el servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && imports.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando importaciones">
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

  if (error && imports.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las importaciones
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
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={<Button onClick={() => setCreating(true)}>Abrir seguimiento…</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Importaciones en curso"
          value={String(kpis.active)}
          tone="info"
          icon={<IconTruck className="w-4 h-4" />}
          description="Aún no llegan a bodega"
        />
        <KpiCard
          title="En aduana"
          value={String(kpis.customs)}
          tone={kpis.customs > 0 ? "warn" : "neutral"}
          icon={<IconBox className="w-4 h-4" />}
        />
        <KpiCard
          title="Próxima llegada"
          value={kpis.next?.etaDate ? fmtDate(kpis.next.etaDate) : "—"}
          tone="info"
          icon={<IconClock className="w-4 h-4" />}
          description={kpis.next ? (kpis.next.poNumber ?? kpis.next.forwarderRef ?? undefined) : undefined}
        />
        <KpiCard
          title="ETA vencida"
          value={String(kpis.overdue)}
          tone={kpis.overdue > 0 ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="En curso con fecha pasada"
        />
      </div>

      {/* Filtros: etapa (backend) + búsqueda libre con debounce (backend). */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <Chip active={stageFilter === ""} onClick={() => setStageFilter("")}>
            Todas
          </Chip>
          {IMPORT_PIPELINE.map((s) => (
            <Chip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}>
              {STAGE_UI[s].label}
            </Chip>
          ))}
        </div>
        <div className="sm:ml-auto sm:w-64">
          <Input
            icon={<IconSearch className="w-4 h-4" />}
            placeholder="Buscar por OC o forwarder"
            aria-label="Buscar importaciones"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {imports.length === 0 ? (
        <Card>
          <div className="p-6 text-center text-sm text-slate-500">
            Sin importaciones con este filtro. Abre un seguimiento con “Abrir seguimiento…”.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {imports.map((imp) => {
            const st = STAGE_UI[imp.stage];
            const d = imp.etaDate ? daysToEta(imp.etaDate, today) : null;
            const overdue = d !== null && d < 0 && imp.stage !== "warehouse";
            const docCount = imp.docs?.length ?? 0;
            return (
              <Card key={imp.id}>
                <button
                  type="button"
                  onClick={() => setDetailId(imp.id)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                        <span className="text-xs font-mono text-slate-400">{imp.id}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {imp.poNumber ?? "Sin OC asociada"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {imp.supplierId ? (
                          <Link
                            to={supplierPath(imp.supplierId)}
                            className="text-brand-600 hover:text-brand-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {imp.supplierId}
                          </Link>
                        ) : (
                          "Proveedor —"
                        )}
                        {" · forwarder "}
                        {imp.forwarderRef ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 lg:flex-shrink-0">
                      <div className="text-sm">
                        <p className="text-xs text-slate-400">ETA</p>
                        <p className={cn("font-medium", overdue ? "text-rose-600" : "text-slate-800")}>
                          {fmtDate(imp.etaDate)}
                          {d !== null && (
                            <span
                              className={cn("ml-1 text-xs", overdue ? "text-rose-600" : "text-slate-400")}
                            >
                              ({whenEta(d)})
                            </span>
                          )}
                        </p>
                      </div>
                      {docCount > 0 && (
                        <Badge tone="neutral">
                          {docCount} doc{docCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {detail && (
        <ImportDetailModal
          key={detail.id}
          imp={detail}
          today={today}
          onFetchDetail={fetchDetail}
          onAdvance={advance}
          onAddDoc={addDoc}
          onClose={() => setDetailId(null)}
        />
      )}

      {creating && <CreateImportModal onCreate={create} onClose={() => setCreating(false)} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Detalle: pipeline con historia real (stageHistory), documentos del DMS y
//  comandos "Avanzar etapa" (If-Match) y "Agregar documento…".
// ----------------------------------------------------------------------------

function ImportDetailModal({
  imp,
  today,
  onFetchDetail,
  onAdvance,
  onAddDoc,
  onClose,
}: {
  imp: ImportView;
  today: string;
  onFetchDetail: (id: string) => Promise<ImportActionResult>;
  onAdvance: (
    id: string,
    version: number,
    stage: Exclude<ImportStage, "po">
  ) => Promise<ImportActionResult>;
  onAddDoc: (id: string, body: { kind: string; dmsRef: string }) => Promise<ImportActionResult>;
  onClose: () => void;
}) {
  const toast = useToast();

  const [mode, setMode] = useState<"view" | "addDoc">("view");
  const [docKind, setDocKind] = useState("bl");
  const [dmsRef, setDmsRef] = useState("");
  const [busy, setBusy] = useState(false);

  // La lista puede venir sin docs/historia completa: se pide el detalle fresco
  // al abrir (el hook lo refleja en la fila, y `imp` llega actualizado).
  useEffect(() => {
    void onFetchDetail(imp.id);
  }, [imp.id, onFetchDetail]);

  const next = nextStage(imp.stage);
  const currentIdx = IMPORT_PIPELINE.indexOf(imp.stage);
  const stageDate = (s: ImportStage) => {
    // Última entrada de la historia para esa etapa (fecha real de paso).
    const hit = [...imp.stageHistory].reverse().find((h) => h.stage === s);
    return hit ? fmtDate(hit.at) : null;
  };
  const d = imp.etaDate ? daysToEta(imp.etaDate, today) : null;
  const overdue = d !== null && d < 0 && imp.stage !== "warehouse";

  const submitAdvance = async () => {
    if (!next) return;
    setBusy(true);
    const result = await onAdvance(imp.id, imp.version, next);
    setBusy(false);
    if (result.ok) {
      toast.success(`Importación en “${STAGE_UI[result.import.stage].label}”`);
      return;
    }
    const info = result.error;
    if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
      // El pipeline cambió en otra sesión (solo avanza): el hook ya recargó.
      toast.warning("La importación cambió en otra sesión; se recargaron los datos");
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };

  const submitDoc = async () => {
    if (!dmsRef.trim()) return;
    setBusy(true);
    const result = await onAddDoc(imp.id, { kind: docKind, dmsRef: dmsRef.trim() });
    setBusy(false);
    if (result.ok) {
      toast.success("Documento registrado");
      setDmsRef("");
      setMode("view");
      return;
    }
    toast.error(describePurchaseBffError(result.error));
  };

  const copyRef = (ref: string) => {
    void navigator.clipboard
      .writeText(ref)
      .then(() => toast.info(`Referencia copiada: ${ref}`))
      .catch(() => toast.error("No se pudo copiar la referencia"));
  };

  const footer =
    mode === "addDoc" ? (
      <>
        <Button variant="secondary" disabled={busy} onClick={() => setMode("view")}>
          Volver
        </Button>
        <Button disabled={busy || !dmsRef.trim()} onClick={() => void submitDoc()}>
          {busy ? "Registrando…" : "Registrar documento"}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setMode("addDoc")}>
          Agregar documento…
        </Button>
        {next && (
          <Button disabled={busy} onClick={() => void submitAdvance()}>
            {busy ? "Avanzando…" : `Avanzar a “${STAGE_UI[next].label}”`}
          </Button>
        )}
      </>
    );

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`${imp.poNumber ?? imp.id} · ${STAGE_UI[imp.stage].label}`}
      description={`Forwarder ${imp.forwarderRef ?? "—"} · abierta ${fmtDate(imp.dateCreated)}`}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Pipeline con fecha real de paso por cada etapa (stageHistory). */}
        <div className="flex items-start gap-1 overflow-x-auto pb-1 no-scrollbar">
          {IMPORT_PIPELINE.map((stage, idx) => {
            const done = idx < currentIdx;
            const current = stage === imp.stage;
            const at = stageDate(stage);
            return (
              <div key={stage} className="flex items-start gap-1 flex-shrink-0">
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
                      current
                        ? "bg-brand-600 text-white"
                        : done
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {STAGE_UI[stage].label}
                  </span>
                  <span className="text-[10px] text-slate-400">{at ?? "—"}</span>
                </div>
                {stage !== "warehouse" && <span className="mt-1 text-slate-300">›</span>}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Field label="OC asociada" value={imp.poNumber ?? "—"} />
          <div>
            <p className="text-xs text-slate-400">Proveedor</p>
            {imp.supplierId ? (
              <Link
                to={supplierPath(imp.supplierId)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {imp.supplierId}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-800">—</p>
            )}
          </div>
          <Field label="Forwarder" value={imp.forwarderRef ?? "—"} />
          <div>
            <p className="text-xs text-slate-400">ETA</p>
            <p className={cn("text-sm font-medium", overdue ? "text-rose-600" : "text-slate-800")}>
              {fmtDate(imp.etaDate)}
              {d !== null && <span className="ml-1 text-xs">({whenEta(d)})</span>}
            </p>
          </div>
        </div>

        {mode === "addDoc" ? (
          <div className="space-y-3">
            <Select
              label="Tipo de documento"
              value={docKind}
              onChange={(e) => setDocKind(e.target.value)}
              options={DOC_KIND_OPTIONS}
            />
            <Input
              label="Referencia DMS (obligatoria)"
              placeholder="dms://carpeta/documento"
              value={dmsRef}
              onChange={(e) => setDmsRef(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              El archivo binario vive en el DMS corporativo; aquí solo se registra su referencia.
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Documentación
            </p>
            {imp.docs && imp.docs.length > 0 ? (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {imp.docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-slate-700">
                        {IMPORT_DOC_KIND_LABEL[doc.kind] ?? doc.kind}
                      </p>
                      <p className="truncate text-xs font-mono text-slate-400" title={doc.dmsRef}>
                        {doc.dmsRef}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyRef(doc.dmsRef)}
                      className="flex-shrink-0 rounded text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                    >
                      Copiar ref
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sin documentos registrados todavía.</p>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              Los binarios viven en el DMS: aquí solo se guardan las referencias (sin descarga).
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
//  Abrir seguimiento: POST /imports (todo opcional; nace en "OC emitida").
// ----------------------------------------------------------------------------

function CreateImportModal({
  onCreate,
  onClose,
}: {
  onCreate: (body: {
    purchaseOrderId?: string;
    etaDate?: string;
    forwarderRef?: string;
  }) => Promise<ImportActionResult>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [forwarderRef, setForwarderRef] = useState("");
  const [etaDate, setEtaDate] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError("");
    setBusy(true);
    const result = await onCreate({
      ...(purchaseOrderId.trim() ? { purchaseOrderId: purchaseOrderId.trim() } : {}),
      ...(forwarderRef.trim() ? { forwarderRef: forwarderRef.trim() } : {}),
      ...(etaDate ? { etaDate } : {}),
    });
    setBusy(false);
    if (result.ok) {
      toast.success(
        `Seguimiento abierto${result.import.poNumber ? ` para ${result.import.poNumber}` : ""}`
      );
      onClose();
      return;
    }
    // El dominio responde legible (OC inexistente, fecha inválida…): se
    // muestra en el modal para poder corregir sin perder lo escrito.
    setFormError(describePurchaseBffError(result.error));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Abrir seguimiento de importación"
      description="Nace en “OC emitida”; el pipeline solo avanza hacia bodega."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Abriendo…" : "Abrir seguimiento"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {formError && (
          <p role="alert" className="text-xs text-rose-600">
            {formError}
          </p>
        )}
        <Input
          label="OC asociada (opcional, id interno de la orden)"
          placeholder="po-…"
          value={purchaseOrderId}
          onChange={(e) => setPurchaseOrderId(e.target.value)}
        />
        <Input
          label="Forwarder / referencia (opcional)"
          placeholder="Ej: MSC-2026-1188"
          value={forwarderRef}
          onChange={(e) => setForwarderRef(e.target.value)}
        />
        <Input
          label="ETA estimada (opcional)"
          type="date"
          value={etaDate}
          onChange={(e) => setEtaDate(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
