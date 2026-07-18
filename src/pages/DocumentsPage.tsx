import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { DataTable, type Column } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { InfoHint } from "../components/business/InfoHint";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../context/ToastContext";
import { useDocuments, type DocumentActionResult } from "../hooks/useDocuments";
import { describePurchaseBffError, type ProcurementDocView } from "../services/purchaseBff";
import { supplierPath } from "../utils/entityLinks";
import { formatDate } from "../utils/formatters";
import { IconOrders } from "../components/ui/icons";

// ============================================================================
//  Repositorio documental (F16) conectado al purchase-bff-service. Los tipos
//  del mock (cotización, contrato, correo…) se reemplazan por los del contrato
//  (oc_pdf, invoice, certificate, customs, price_list, other). Las columnas
//  sin fuente real (tamaño, "Ver"/"Descargar") quedan fuera: aquí solo viven
//  los metadatos y la referencia al DMS — el binario permanece allá.
// ============================================================================

/** Tipos del contrato POST/GET /documents, con etiqueta y tono ES. */
const DOC_KIND_ORDER = ["oc_pdf", "invoice", "certificate", "customs", "price_list", "other"] as const;

const KIND_UI: Record<string, { label: string; tone: BadgeTone }> = {
  oc_pdf: { label: "OC (PDF)", tone: "blue" },
  invoice: { label: "Factura", tone: "green" },
  certificate: { label: "Certificado", tone: "violet" },
  customs: { label: "Aduana", tone: "amber" },
  price_list: { label: "Lista de precios", tone: "slate" },
  other: { label: "Otro", tone: "neutral" },
};

const kindUi = (kind: string) => KIND_UI[kind] ?? { label: kind, tone: "neutral" as BadgeTone };

/** Entidades referenciables; supplier enlaza a la ficha (SUP-…). */
const REF_ENTITY_LABEL: Record<string, string> = {
  purchase_order: "OC",
  supplier: "Proveedor",
  import: "Importación",
};

const TYPE_TABS = [
  { value: "", label: "Todos" },
  ...DOC_KIND_ORDER.map((k) => ({ value: k, label: KIND_UI[k].label })),
];

const fmtDate = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Celda "Relacionado": link a la ficha cuando la referencia lo permite. */
function RefCell({ doc }: { doc: ProcurementDocView }) {
  if (doc.refEntity === "supplier" && doc.refId) {
    return (
      <Link
        to={supplierPath(doc.refId)}
        className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {doc.refId}
      </Link>
    );
  }
  if (doc.refEntity && doc.refId) {
    // purchase_order y otras entidades sin ficha pública por id: texto plano.
    return (
      <span className="text-xs font-mono text-slate-500">
        {REF_ENTITY_LABEL[doc.refEntity] ?? doc.refEntity} · {doc.refId}
      </span>
    );
  }
  if (doc.supplierId) {
    return (
      <Link
        to={supplierPath(doc.supplierId)}
        className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {doc.supplierId}
      </Link>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

export function DocumentsPage() {
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [registering, setRegistering] = useState(false);

  // kind y q se resuelven en el backend (q con debounce en el hook).
  const { documents, loading, error, configured, refetch, register } = useDocuments({
    kind: tipo,
    q: query,
  });

  // KPIs sobre el resultado vigente (el listado real, con filtros aplicados).
  const kpis = useMemo(() => {
    const countBy = (k: string) => documents.filter((d) => d.kind === k).length;
    return {
      oc: countBy("oc_pdf"),
      invoices: countBy("invoice"),
      certificates: countBy("certificate") + countBy("customs"),
      priceLists: countBy("price_list"),
    };
  }, [documents]);

  const clearFilters = () => {
    setQuery("");
    setTipo("");
  };

  const copyRef = (ref: string) => {
    void navigator.clipboard
      .writeText(ref)
      .then(() => toast.info(`Referencia copiada: ${ref}`))
      .catch(() => toast.error("No se pudo copiar la referencia"));
  };

  const pageTitle = "Documentos centralizados";
  const pageDescription =
    "Órdenes de compra, facturas, certificados y listas de precios referenciados al DMS, en un solo repositorio buscable.";

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
              ver el repositorio documental real del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && documents.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando documentos">
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

  if (error && documents.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar los documentos
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

  const columns: Column<ProcurementDocView>[] = [
    {
      key: "title",
      header: "Documento",
      render: (d) => (
        <div className="flex items-center gap-2.5 min-w-[200px]">
          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
            <IconOrders className="w-4 h-4" />
          </span>
          <span className="font-medium text-slate-800 leading-snug">{d.title}</span>
        </div>
      ),
      sortable: true,
      sortValue: (d) => d.title,
    },
    {
      key: "kind",
      header: "Tipo",
      render: (d) => <Badge tone={kindUi(d.kind).tone}>{kindUi(d.kind).label}</Badge>,
      sortable: true,
      sortValue: (d) => kindUi(d.kind).label,
    },
    {
      key: "ref",
      header: "Relacionado",
      hideOnMobile: true,
      render: (d) => <RefCell doc={d} />,
    },
    {
      key: "dmsRef",
      header: "Ref. DMS",
      hideOnMobile: true,
      render: (d) => (
        <button
          type="button"
          onClick={() => copyRef(d.dmsRef)}
          title="Copiar referencia DMS"
          className="max-w-[180px] truncate rounded text-left text-xs font-mono text-slate-500 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          {d.dmsRef}
        </button>
      ),
      sortable: true,
      sortValue: (d) => d.dmsRef,
    },
    {
      key: "fecha",
      header: "Fecha",
      align: "right",
      render: (d) => <span className="text-slate-600">{fmtDate(d.dateCreated)}</span>,
      sortable: true,
      sortValue: (d) => d.dateCreated,
    },
    {
      key: "uploadedBy",
      header: "Subido por",
      align: "right",
      hideOnMobile: true,
      render: (d) => <span className="text-xs font-mono text-slate-400">{d.uploadedByUserId}</span>,
      sortable: true,
      sortValue: (d) => d.uploadedByUserId,
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        help={
          <InfoHint label="Qué es este repositorio">
            <p>
              Centraliza los <b>documentos del proceso de compra</b> que hoy viven dispersos en
              correos y planillas Excel.
            </p>
            <p>
              Aquí se guardan los metadatos y la <b>referencia al DMS</b>: el archivo binario vive
              en el gestor documental, por eso no hay descarga desde esta pantalla.
            </p>
          </InfoHint>
        }
        action={<Button onClick={() => setRegistering(true)}>Registrar documento…</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Órdenes de compra"
          value={String(kpis.oc)}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
          description="PDF de OC emitidas"
        />
        <KpiCard
          title="Facturas"
          value={String(kpis.invoices)}
          tone="good"
          icon={<IconOrders className="w-4 h-4" />}
          description="Documentos tributarios"
        />
        <KpiCard
          title="Certificados y aduana"
          value={String(kpis.certificates)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
          description="Respaldos de importación"
        />
        <KpiCard
          title="Listas de precios"
          value={String(kpis.priceLists)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
          description="Condiciones de proveedores"
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por título o referencia"
          resultCount={documents.length}
          onClear={clearFilters}
          selects={[
            {
              key: "tipo",
              placeholder: "Tipo",
              value: tipo,
              onChange: setTipo,
              options: DOC_KIND_ORDER.map((k) => ({ value: k, label: KIND_UI[k].label })),
            },
          ]}
        />
      </div>

      <Card>
        <div className="px-3 pt-2 border-b border-slate-100">
          <Tabs tabs={TYPE_TABS} value={tipo} onChange={setTipo} />
        </div>
        <DataTable
          columns={columns}
          data={documents}
          rowKey={(d) => d.id}
          emptyMessage="No hay documentos que coincidan con los filtros. Registra el primero con “Registrar documento…”."
          mobileCard={(d) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                    <IconOrders className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 leading-snug truncate">{d.title}</p>
                    <RefCell doc={d} />
                  </div>
                </div>
                <Badge tone={kindUi(d.kind).tone}>{kindUi(d.kind).label}</Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">
                  {fmtDate(d.dateCreated)} · {d.uploadedByUserId}
                </span>
                <button
                  type="button"
                  onClick={() => copyRef(d.dmsRef)}
                  className="rounded text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  Copiar ref DMS
                </button>
              </div>
            </div>
          )}
        />
        <p className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100">
          Los binarios viven en el DMS corporativo: aquí solo se guardan metadatos y referencias
          (sin visor ni descarga).
        </p>
      </Card>

      {registering && (
        <RegisterDocumentModal onRegister={register} onClose={() => setRegistering(false)} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Registrar documento: POST /documents (título + tipo + dmsRef; referencia a
//  entidad y proveedor opcionales).
// ----------------------------------------------------------------------------

function RegisterDocumentModal({
  onRegister,
  onClose,
}: {
  onRegister: (body: {
    kind: string;
    title: string;
    refEntity?: string;
    refId?: string;
    supplierId?: string;
    dmsRef: string;
  }) => Promise<DocumentActionResult>;
  onClose: () => void;
}) {
  const toast = useToast();

  const [kind, setKind] = useState<string>("oc_pdf");
  const [title, setTitle] = useState("");
  const [refEntity, setRefEntity] = useState("");
  const [refId, setRefId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [dmsRef, setDmsRef] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !dmsRef.trim()) {
      setFormError("El título y la referencia DMS son obligatorios.");
      return;
    }
    if (refEntity && !refId.trim()) {
      setFormError("Indica el id de la entidad referida (o quita la referencia).");
      return;
    }
    setFormError("");
    setBusy(true);
    const result = await onRegister({
      kind,
      title: title.trim(),
      ...(refEntity && refId.trim() ? { refEntity, refId: refId.trim() } : {}),
      ...(supplierId.trim() ? { supplierId: supplierId.trim() } : {}),
      dmsRef: dmsRef.trim(),
    });
    setBusy(false);
    if (result.ok) {
      toast.success(`Documento registrado: ${result.document.title}`);
      onClose();
      return;
    }
    // El dominio responde legible (referencia inválida, proveedor inexistente…):
    // se muestra en el modal para corregir sin perder lo escrito.
    setFormError(describePurchaseBffError(result.error));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar documento"
      description="Se guarda la referencia al DMS: sube primero el archivo al gestor documental."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Registrando…" : "Registrar"}
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
        <Select
          label="Tipo de documento"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={DOC_KIND_ORDER.map((k) => ({ value: k, label: KIND_UI[k].label }))}
        />
        <Input
          label="Título (obligatorio)"
          placeholder="Ej: Factura 12345 · Proveedor…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Entidad referida (opcional)"
            value={refEntity}
            placeholder="Sin referencia"
            onChange={(e) => setRefEntity(e.target.value)}
            options={Object.entries(REF_ENTITY_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Input
            label="Id de la entidad"
            placeholder="po-… / SUP-…"
            value={refId}
            disabled={!refEntity}
            onChange={(e) => setRefId(e.target.value)}
          />
        </div>
        <Input
          label="Proveedor (opcional)"
          placeholder="SUP-001"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        />
        <Input
          label="Referencia DMS (obligatoria)"
          placeholder="dms://carpeta/documento"
          value={dmsRef}
          onChange={(e) => setDmsRef(e.target.value)}
        />
      </div>
    </Modal>
  );
}
