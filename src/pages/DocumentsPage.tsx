import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { DataTable, type Column } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { HelpNote } from "../components/business/HelpNote";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";
import { useDatasheets, type Datasheet } from "../context/DatasheetsContext";
import { AttachDatasheetModal } from "../components/business/AttachDatasheetModal";
import { openDataUrl, downloadDataUrl } from "../utils/fileClient";
import { inRange, type IsoRange } from "../utils/dateRange";
import { formatDate } from "../utils/formatters";
import {
  documents,
  documentSuppliers,
  DOC_TYPE_ORDER,
  TYPE_LABELS,
  TYPE_TONES,
  type DocType,
  type ProcurementDoc,
} from "../data/mockDocuments";
import { IconOrders, IconMail, IconDownload, IconEye, IconPaperclip } from "../components/ui/icons";

/** Fila de la tabla: documento del repositorio o ficha adjuntada por el comprador. */
type DocRow = ProcurementDoc & { attached?: Datasheet };

/** Convierte una ficha adjuntada por el comprador en una fila de la tabla. */
function datasheetToRow(d: Datasheet): DocRow {
  return {
    id: d.id,
    nombre: d.fileName,
    tipo: "ficha_tecnica",
    proveedor: d.supplierName,
    fecha: d.uploadedAt.slice(0, 10),
    relacionado: d.ean ? `SKU ${d.sku} · EAN ${d.ean}` : `SKU ${d.sku}`,
    tamano: d.sizeLabel,
    attached: d,
  };
}

/** Pestañas por tipo: "Todos" + cada tipo de documento. */
const TYPE_TABS = [
  { value: "", label: "Todos" },
  ...DOC_TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
];

export function DocumentsPage() {
  const toast = useToast();
  const datasheets = useDatasheets();

  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [proveedor, setProveedor] = useState("");
  const [range, setRange] = useState<IsoRange>({ from: "", to: "" });
  const [attachOpen, setAttachOpen] = useState(false);

  // Fichas adjuntadas por el comprador (mapeadas por SKU/EAN) + repositorio mock.
  const allDocs = useMemo<DocRow[]>(
    () =>
      [...datasheets.items.map(datasheetToRow), ...documents].sort((a, b) =>
        b.fecha.localeCompare(a.fecha)
      ),
    [datasheets.items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDocs.filter((d) => {
      if (
        q &&
        !d.nombre.toLowerCase().includes(q) &&
        !d.proveedor.toLowerCase().includes(q) &&
        !d.relacionado.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (tipo && d.tipo !== tipo) return false;
      if (proveedor && d.proveedor !== proveedor) return false;
      if (!inRange(d.fecha, range)) return false;
      return true;
    });
  }, [allDocs, query, tipo, proveedor, range]);

  // KPIs por tipo mayor (sobre el total, dan la foto del repositorio).
  const countBy = (t: DocType) => documents.filter((d) => d.tipo === t).length;

  const clearFilters = () => {
    setQuery("");
    setTipo("");
    setProveedor("");
    setRange({ from: "", to: "" });
  };

  // Las fichas adjuntadas por el comprador se ven/descargan de verdad; el resto
  // del repositorio es mock y solo muestra un aviso de demo.
  const handleView = (d: DocRow) =>
    d.attached?.dataUrl
      ? openDataUrl(d.attached.dataUrl)
      : d.attached
        ? toast.info("El archivo no está disponible en esta sesión.")
        : toast.info("Demo: documento simulado");

  const handleDownload = (d: DocRow) =>
    d.attached?.dataUrl
      ? downloadDataUrl(d.attached.dataUrl, d.attached.fileName)
      : d.attached
        ? toast.info("El archivo no está disponible en esta sesión.")
        : toast.info("Demo: documento simulado");

  const columns: Column<DocRow>[] = [
    {
      key: "nombre",
      header: "Documento",
      render: (d) => (
        <div className="flex items-center gap-2.5 min-w-[200px]">
          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
            {d.attached ? (
              <IconPaperclip className="w-4 h-4" />
            ) : d.tipo === "correo" ? (
              <IconMail className="w-4 h-4" />
            ) : (
              <IconOrders className="w-4 h-4" />
            )}
          </span>
          <span className="font-medium text-slate-800 leading-snug">{d.nombre}</span>
          {d.attached && <Badge tone="green">Adjuntada</Badge>}
        </div>
      ),
      sortable: true,
      sortValue: (d) => d.nombre,
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (d) => <Badge tone={TYPE_TONES[d.tipo]}>{TYPE_LABELS[d.tipo]}</Badge>,
      sortable: true,
      sortValue: (d) => TYPE_LABELS[d.tipo],
    },
    {
      key: "proveedor",
      header: "Proveedor",
      hideOnMobile: true,
      render: (d) => <span className="text-slate-700">{d.proveedor}</span>,
      sortable: true,
      sortValue: (d) => d.proveedor,
    },
    {
      key: "relacionado",
      header: "Relacionado",
      hideOnMobile: true,
      render: (d) => <span className="text-xs font-mono text-slate-500">{d.relacionado}</span>,
      sortable: true,
      sortValue: (d) => d.relacionado,
    },
    {
      key: "fecha",
      header: "Fecha",
      align: "right",
      render: (d) => <span className="text-slate-600">{formatDate(d.fecha)}</span>,
      sortable: true,
      sortValue: (d) => d.fecha,
    },
    {
      key: "tamano",
      header: "Tamaño",
      align: "right",
      hideOnMobile: true,
      render: (d) => <span className="text-xs text-slate-400">{d.tamano}</span>,
      sortable: true,
      sortValue: (d) => d.tamano,
    },
    {
      key: "actions",
      header: "Acción",
      align: "right",
      render: (d) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={<IconEye className="w-4 h-4" />}
            onClick={() => handleView(d)}
          >
            Ver
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<IconDownload className="w-4 h-4" />}
            onClick={() => handleDownload(d)}
          >
            Descargar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documentos centralizados"
        description="Cotizaciones, órdenes de compra, guías, facturas, contratos y más, en un solo repositorio buscable."
        action={
          <Button icon={<IconPaperclip className="w-4 h-4" />} onClick={() => setAttachOpen(true)}>
            Adjuntar ficha técnica
          </Button>
        }
      />

      <HelpNote className="mb-4">
        Este repositorio <b>centraliza los documentos del proceso de compra</b> que hoy viven
        dispersos en correos y planillas Excel. Busca por nombre, proveedor u orden relacionada,
        filtra por tipo y fecha, y encuentra cualquier respaldo sin perseguir a nadie por mail.{" "}
        <b>Adjunta la ficha técnica o manual del proveedor</b> y queda mapeada al producto por su
        SKU o código EAN.
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Cotizaciones"
          value={String(countBy("cotizacion"))}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
          description="Comparación de precios"
        />
        <KpiCard
          title="Órdenes de compra"
          value={String(countBy("orden_compra"))}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
          description="Compromisos emitidos"
        />
        <KpiCard
          title="Facturas"
          value={String(countBy("factura"))}
          tone="good"
          icon={<IconOrders className="w-4 h-4" />}
          description="Documentos tributarios"
        />
        <KpiCard
          title="Contratos y acuerdos"
          value={String(countBy("contrato") + countBy("acuerdo"))}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
          description="Condiciones vigentes"
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por nombre, proveedor u OC"
          resultCount={filtered.length}
          onClear={clearFilters}
          dateRange={{ value: range, onChange: setRange, label: "Todas las fechas" }}
          selects={[
            {
              key: "tipo",
              placeholder: "Tipo",
              value: tipo,
              onChange: setTipo,
              options: DOC_TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
            },
            {
              key: "prov",
              placeholder: "Proveedor",
              value: proveedor,
              onChange: setProveedor,
              options: documentSuppliers.map((s) => ({ value: s, label: s })),
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
          data={filtered}
          rowKey={(d) => d.id}
          emptyMessage="No hay documentos que coincidan con los filtros. Prueba ampliar el rango de fechas o quitar el tipo."
          mobileCard={(d) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                    {d.attached ? (
                      <IconPaperclip className="w-4 h-4" />
                    ) : d.tipo === "correo" ? (
                      <IconMail className="w-4 h-4" />
                    ) : (
                      <IconOrders className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 leading-snug truncate">{d.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {d.proveedor} · {d.relacionado}
                    </p>
                  </div>
                </div>
                <Badge tone={TYPE_TONES[d.tipo]}>{TYPE_LABELS[d.tipo]}</Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">
                  {formatDate(d.fecha)} · {d.tamano}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<IconEye className="w-4 h-4" />}
                    onClick={() => handleView(d)}
                  >
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconDownload className="w-4 h-4" />}
                    onClick={() => handleDownload(d)}
                  >
                    Descargar
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      </Card>

      <AttachDatasheetModal open={attachOpen} onClose={() => setAttachOpen(false)} />
    </div>
  );
}
