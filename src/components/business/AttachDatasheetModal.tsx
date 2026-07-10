import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { IconSearch, IconPaperclip, IconCheck, IconClose } from "../ui/icons";
import { products } from "../../data/mockProducts";
import { useDatasheets } from "../../context/DatasheetsContext";
import { useBuyer } from "../../context/BuyerContext";
import { useToast } from "../../context/ToastContext";
import { readFileAsDataUrl, formatBytes } from "../../utils/fileClient";
import type { Product } from "../../types/purchasing";

/** Tamaño máximo por archivo (se guarda en la sesión, sin backend). */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Si viene, el mapeo queda fijo a ese producto (desde la ficha del SKU). */
  product?: Product;
}

/**
 * Modal para adjuntar una ficha técnica / manual entregado por el proveedor y
 * dejarlo MAPEADO al producto por su SKU o EAN. Lee el archivo en el navegador
 * (sin backend) para poder verlo y descargarlo después dentro de la sesión.
 */
export function AttachDatasheetModal({ open, onClose, product }: Props) {
  const datasheets = useDatasheets();
  const { buyer } = useBuyer();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | undefined>(product);
  const [eanManual, setEanManual] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reinicia el estado cada vez que se abre (respetando el producto fijo).
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(product);
      setEanManual("");
      setFile(null);
      setDataUrl(undefined);
      setNote("");
      setBusy(false);
    }
  }, [open, product]);

  // Coincidencias por SKU, EAN (código de barras) o nombre.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          (p.codigoBarras ?? "").toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query]);

  const ean = selected?.codigoBarras ?? (eanManual.trim() || undefined);

  // Pista de coincidencia: el nombre del archivo contiene el SKU o el EAN.
  const fileMatchesCode = useMemo(() => {
    if (!file || !selected) return false;
    const n = file.name.toLowerCase();
    return (
      n.includes(selected.sku.toLowerCase()) ||
      (!!selected.codigoBarras && n.includes(selected.codigoBarras))
    );
  }, [file, selected]);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.warning(`El archivo supera ${formatBytes(MAX_BYTES)}. Elige uno más liviano.`);
      return;
    }
    setFile(f);
    try {
      setDataUrl(await readFileAsDataUrl(f));
    } catch {
      toast.error("No se pudo leer el archivo.");
      setFile(null);
      setDataUrl(undefined);
    }
  };

  const canSave = !!selected && !!file;

  const handleSave = () => {
    if (!selected || !file) return;
    setBusy(true);
    datasheets.add({
      sku: selected.sku,
      ean,
      productName: selected.name,
      supplierName: selected.supplierName,
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      sizeLabel: formatBytes(file.size),
      dataUrl,
      note: note.trim() || undefined,
      uploadedBy: buyer,
    });
    toast.success(
      `Ficha técnica adjuntada y mapeada al SKU ${selected.sku}${ean ? ` · EAN ${ean}` : ""}`
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjuntar ficha técnica o manual"
      description="Queda mapeada al producto por su SKU o código EAN. Solo tú y tu equipo la ven."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            loading={busy}
            icon={<IconCheck className="w-4 h-4" />}
          >
            Adjuntar ficha
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Paso 1: producto (mapeo por SKU / EAN) */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            1. ¿A qué producto corresponde?
          </p>

          {selected ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{selected.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                    SKU {selected.sku}
                  </span>
                  {selected.codigoBarras ? (
                    <span className="text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                      EAN {selected.codigoBarras}
                    </span>
                  ) : (
                    <Badge tone="amber">Sin EAN en catálogo</Badge>
                  )}
                  <span className="text-xs text-slate-500">{selected.supplierName}</span>
                </div>
              </div>
              {!product && (
                <button
                  onClick={() => setSelected(undefined)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-white flex-shrink-0"
                  aria-label="Cambiar producto"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <>
              <Input
                icon={<IconSearch className="w-4 h-4" />}
                placeholder="Escanea o escribe el SKU, el código EAN o el nombre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar producto por SKU, EAN o nombre"
                autoFocus
              />
              {query.trim() && (
                <div className="mt-2 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {matches.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-400">
                      Ningún producto coincide con “{query}”.
                    </p>
                  ) : (
                    matches.map((p) => (
                      <button
                        key={p.sku}
                        onClick={() => {
                          setSelected(p);
                          setQuery("");
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-brand-50/50 flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-800 truncate">
                            {p.name}
                          </span>
                          <span className="block text-xs text-slate-500 font-mono">
                            SKU {p.sku}
                            {p.codigoBarras ? ` · EAN ${p.codigoBarras}` : ""}
                          </span>
                        </span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {p.supplierName}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          {/* EAN a mano cuando el catálogo no lo tiene */}
          {selected && !selected.codigoBarras && (
            <div className="mt-2">
              <Input
                label="Código EAN de la ficha (opcional)"
                placeholder="Ej. 7801234500011"
                inputMode="numeric"
                value={eanManual}
                onChange={(e) => setEanManual(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">
                Si el proveedor entrega la ficha mapeada por EAN, regístralo aquí para encontrarla
                por ese código.
              </p>
            </div>
          )}
        </div>

        {/* Paso 2: archivo */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            2. Archivo de la ficha o manual
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="rounded-xl border border-slate-200 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                    <IconPaperclip className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    setDataUrl(undefined);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Quitar
                </Button>
              </div>
              {selected && (
                <div className="mt-2">
                  {fileMatchesCode ? (
                    <Badge tone="green" dot>
                      El nombre del archivo coincide con el SKU/EAN
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Verifica que sea la ficha de este producto</Badge>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
            >
              <span className="mx-auto mb-2 w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                <IconPaperclip className="w-5 h-5" />
              </span>
              <span className="block text-sm font-medium text-slate-700">
                Selecciona un archivo
              </span>
              <span className="block text-xs text-slate-400 mt-0.5">
                PDF, Word o imagen · hasta {formatBytes(MAX_BYTES)}
              </span>
            </button>
          )}
        </div>

        {/* Paso 3: nota opcional */}
        <div>
          <Input
            label="Nota (opcional)"
            placeholder="Ej. Versión 2026, incluye instructivo de instalación"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
