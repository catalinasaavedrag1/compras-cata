import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useClaims } from "../../context/ClaimsContext";
import { useToast } from "../../context/ToastContext";
import { usePurchaseOrders } from "../../hooks/usePurchaseOrders";
import {
  describePurchaseBffError,
  listReceptions,
  type ClaimDetailView,
  type ClaimType,
  type ReceptionSummaryView,
} from "../../services/purchaseBff";
import { CLAIM_TYPE_UI } from "./helpers";

// ============================================================================
//  Crear reclamo (POST /claims real, 🔑 idempotente). Dos entradas:
//  - Desde Reclamos: selector de OC (usePurchaseOrders) y, opcionalmente, una
//    recepción con diferencias de esa OC (listReceptions status=discrepancy).
//  - Desde una recepción cerrada (con diferencias o completa): OC + recepción
//    vienen prefijadas (prop `prefill`) y no se consulta nada extra.
// ============================================================================

/** OC + recepción prefijadas al abrir desde el detalle de una recepción. */
export interface ClaimPrefill {
  purchaseOrderId: string;
  poNumber: string | null;
  receptionId: string;
  receptionDisplayId: string | null;
}

const TYPE_OPTIONS = (Object.keys(CLAIM_TYPE_UI) as ClaimType[]).map((t) => ({
  value: t,
  label: CLAIM_TYPE_UI[t].label,
}));

export function CreateClaimModal({
  prefill,
  onClose,
  onCreated,
}: {
  prefill?: ClaimPrefill;
  onClose: () => void;
  onCreated?: (claim: ClaimDetailView) => void;
}) {
  const { create } = useClaims();
  const toast = useToast();
  const navigate = useNavigate();

  const [purchaseOrderId, setPurchaseOrderId] = useState(prefill?.purchaseOrderId ?? "");
  const [poNumber, setPoNumber] = useState<string | null>(prefill?.poNumber ?? null);
  const [receptionId, setReceptionId] = useState(prefill?.receptionId ?? "");
  const [type, setType] = useState<ClaimType>("quantity");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!purchaseOrderId || !description.trim()) {
      setFormError("Selecciona la OC y describe la diferencia y su impacto.");
      return;
    }
    setFormError("");
    setBusy(true);
    const result = await create({
      purchaseOrderId,
      ...(receptionId ? { receptionId } : {}),
      type,
      description: description.trim(),
    });
    setBusy(false);
    if (result.ok) {
      toast.success(
        `Reclamo creado para ${result.claim.poNumber ?? poNumber ?? "la OC"}`,
        // Desde Recepciones, un atajo al módulo donde se gestiona el reclamo.
        prefill ? { label: "Ver reclamos", onClick: () => navigate("/reclamos") } : undefined
      );
      onCreated?.(result.claim);
      onClose();
      return;
    }
    // El dominio responde con mensajes legibles (recepción no cerrada, OC
    // inexistente, etc.); se muestran en el propio modal para poder corregir.
    setFormError(describePurchaseBffError(result.error));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo reclamo al proveedor"
      description={
        prefill
          ? `${prefill.poNumber ?? prefill.purchaseOrderId} · recepción ${prefill.receptionDisplayId ?? prefill.receptionId}`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? "Creando…" : "Crear reclamo"}
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

        {!prefill && (
          <OrderAndReceptionPicker
            purchaseOrderId={purchaseOrderId}
            receptionId={receptionId}
            onOrderChange={(id, number) => {
              setPurchaseOrderId(id);
              setPoNumber(number);
              setReceptionId("");
            }}
            onReceptionChange={setReceptionId}
          />
        )}

        <Select
          label="Tipo de reclamo"
          value={type}
          onChange={(e) => setType(e.target.value as ClaimType)}
          options={TYPE_OPTIONS}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Descripción (obligatoria)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Describe la diferencia y su impacto…"
          />
        </div>
      </div>
    </Modal>
  );
}

/**
 * Selector de OC real y, si la OC tiene recepciones con diferencias, selector
 * opcional de recepción. Vive en un subcomponente para que el fetch de OC solo
 * ocurra cuando el modal se abre sin prefijar (desde el módulo Reclamos).
 */
function OrderAndReceptionPicker({
  purchaseOrderId,
  receptionId,
  onOrderChange,
  onReceptionChange,
}: {
  purchaseOrderId: string;
  receptionId: string;
  onOrderChange: (id: string, number: string | null) => void;
  onReceptionChange: (id: string) => void;
}) {
  const { orders, loading } = usePurchaseOrders();
  const [discrepancies, setDiscrepancies] = useState<ReceptionSummaryView[]>([]);

  useEffect(() => {
    let active = true;
    // Degradación silenciosa: sin recepciones con diferencias, el selector
    // opcional simplemente no aparece (el reclamo directo a la OC sigue vivo).
    listReceptions({ status: "discrepancy", page: 1, pageSize: 100 })
      .then((page) => {
        if (active) setDiscrepancies(page.items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Cualquier OC emitida es reclamable (el dominio solo exige que exista);
  // se excluyen las canceladas, que no representan compra vigente.
  const selectable = orders.filter((o) => o.status !== "cancelled");
  const poReceptions = discrepancies.filter((r) => r.purchaseOrderId === purchaseOrderId);

  return (
    <>
      <Select
        label="Orden de compra"
        value={purchaseOrderId}
        placeholder={loading ? "Cargando OC…" : "Selecciona una OC"}
        onChange={(e) => {
          const order = selectable.find((o) => o.id === e.target.value);
          onOrderChange(e.target.value, order?.number ?? null);
        }}
        options={selectable.map((o) => ({
          value: o.id,
          label: `${o.number} · ${o.supplierId ?? o.sapCardCode ?? "—"}`,
        }))}
      />
      {poReceptions.length > 0 && (
        <Select
          label="Recepción con diferencias (opcional)"
          value={receptionId}
          placeholder="Reclamo directo a la OC"
          onChange={(e) => onReceptionChange(e.target.value)}
          options={poReceptions.map((r) => ({
            value: r.id,
            label: `${r.displayId} · ${r.itemCount} ${r.itemCount === 1 ? "ítem" : "ítems"}`,
          }))}
        />
      )}
    </>
  );
}
