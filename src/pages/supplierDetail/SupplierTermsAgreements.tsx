import { useState } from "react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../context/ToastContext";
import { formatDate, formatPercent } from "../../utils/formatters";
import {
  createSupplierAgreement,
  describePurchaseBffError,
  toPurchaseBffError,
  type SupplierAgreementRow,
  type SupplierTermsVersion,
} from "../../services/purchaseBff";

// ---------------------------------------------------------------------------
//  Condiciones comerciales (historia append-only, vigente primero) y acuerdos
//  reales del proveedor. Los acuerdos se registran con
//  POST /suppliers/:id/agreements (título, tipo y vigencia).
// ---------------------------------------------------------------------------

const fmtDate = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Tipos de acuerdo sugeridos (el contrato acepta un string libre). */
const AGREEMENT_KINDS = [
  { value: "descuento", label: "Descuento" },
  { value: "rebate", label: "Rebate / bonificación" },
  { value: "marketing", label: "Apoyo de marketing" },
  { value: "logistica", label: "Logística / despacho" },
  { value: "otro", label: "Otro" },
];

const AGREEMENT_KIND_LABEL: Record<string, string> = Object.fromEntries(
  AGREEMENT_KINDS.map((k) => [k.value, k.label])
);

export function SupplierTermsAgreements({
  supplierId,
  terms,
  agreements,
  onCreated,
}: {
  supplierId: string;
  terms: SupplierTermsVersion[];
  agreements: SupplierAgreementRow[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("descuento");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openModal = () => {
    setTitle("");
    setKind("descuento");
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo("");
    setFormError("");
    setCreating(true);
  };

  const submit = async () => {
    if (!title.trim() || !validFrom) {
      setFormError("Indica al menos el título y la fecha de inicio.");
      return;
    }
    setSaving(true);
    try {
      await createSupplierAgreement(supplierId, {
        title: title.trim(),
        kind,
        validFrom,
        ...(validTo ? { validTo } : {}),
      });
      toast.success("Acuerdo registrado");
      setCreating(false);
      onCreated();
    } catch (err) {
      toast.error(describePurchaseBffError(toPurchaseBffError(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Historia de condiciones comerciales */}
      <Card>
        <CardHeader
          title="Condiciones comerciales"
          description="Historia de versiones (la más reciente es la vigente)."
        />
        <CardBody>
          {terms.length === 0 ? (
            <p className="text-sm text-slate-400">Sin condiciones registradas todavía.</p>
          ) : (
            <div className="space-y-2.5">
              {terms.map((t, i) => (
                <div key={t.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      desde {fmtDate(t.validFrom)}
                    </span>
                    {i === 0 && <Badge tone="green">Vigente</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">Condición de pago</span>
                      <span className="text-sm font-medium text-slate-800">
                        {t.paymentTermRef ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">Descuento base</span>
                      <span className="text-sm font-medium text-slate-800">
                        {t.discountPct != null ? formatPercent(t.discountPct, 1) : "—"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">Flete</span>
                      <span className="text-sm font-medium text-slate-800">
                        {t.freightPolicy ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400">Notas</span>
                      <span className="text-sm font-medium text-slate-800">{t.notes ?? "—"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Acuerdos comerciales reales */}
      <Card>
        <CardHeader
          title="Acuerdos comerciales"
          description="Acuerdos registrados con su vigencia."
          action={
            <Button size="sm" variant="secondary" onClick={openModal}>
              + Registrar
            </Button>
          }
        />
        <CardBody>
          {agreements.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin acuerdos registrados. Registra lo acordado en la próxima reunión.
            </p>
          ) : (
            <div className="space-y-2.5">
              {agreements.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-800">{a.title ?? "Acuerdo"}</span>
                    {a.kind && (
                      <Badge tone="blue">{AGREEMENT_KIND_LABEL[a.kind] ?? a.kind}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    vigencia {fmtDate(a.validFrom)}
                    {a.validTo ? ` → ${fmtDate(a.validTo)}` : " → sin término"}
                    {a.status && <> · {a.status}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal registrar acuerdo */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Registrar acuerdo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          {formError && (
            <p role="alert" className="text-xs text-rose-600">
              {formError}
            </p>
          )}
          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Rebate 2% por volumen anual"
          />
          <Select
            label="Tipo"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={AGREEMENT_KINDS}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Vigente desde"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
            <Input
              label="Vigente hasta (opcional)"
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
