import { useState } from "react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Input } from "../../components/ui/Input";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { useToast } from "../../context/ToastContext";
import type { Supplier } from "../../types/purchasing";
import { formatDate } from "../../utils/formatters";

interface SupplierTerms {
  paymentDays: number;
  freight: string;
  minOrder: string;
  baseDiscount: number;
  rebate: string;
  returns: string;
  marketing: string;
  account: string;
}

interface Agreement {
  id: string;
  date: string;
  objective: string;
  agreed: string;
  followUp: string;
}

const DEFAULT_TERMS: SupplierTerms = {
  paymentDays: 30,
  freight: "Por pagar (cliente)",
  minOrder: "$500.000",
  baseDiscount: 0,
  rebate: "Sin rebate vigente",
  returns: "Solo por falla · 30 días",
  marketing: "Sin apoyo acordado",
  account: "—",
};

/** Condiciones comerciales (editables) + acuerdos y seguimiento, persistidos por proveedor. */
export function SupplierTermsAgreements({ supplier }: { supplier: Supplier }) {
  const toast = useToast();
  const [terms, setTerms] = useLocalStorage<SupplierTerms>(
    `compras:terms:${supplier.id}`,
    DEFAULT_TERMS
  );
  const [agreements, setAgreements] = useLocalStorage<Agreement[]>(
    `compras:agreements:${supplier.id}`,
    []
  );
  const [editTerms, setEditTerms] = useState(false);
  const [draft, setDraft] = useState<SupplierTerms>(terms);
  const [newAgr, setNewAgr] = useState<Agreement | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const termsDirty = JSON.stringify(draft) !== JSON.stringify(terms);
  const openTerms = () => {
    setDraft(terms);
    setEditTerms(true);
  };
  const closeTerms = () => (termsDirty ? setConfirmDiscard(true) : setEditTerms(false));
  const saveTerms = () => {
    setTerms(draft);
    setEditTerms(false);
    toast.success("Condiciones comerciales actualizadas");
  };

  const openAgr = () =>
    setNewAgr({
      id: `ag${Date.now()}`,
      date: "2026-06-26",
      objective: "",
      agreed: "",
      followUp: "",
    });
  const saveAgr = () => {
    if (!newAgr || !newAgr.objective.trim()) {
      toast.warning("Indica al menos el objetivo");
      return;
    }
    setAgreements((prev) => [newAgr, ...prev]);
    setNewAgr(null);
    toast.success("Acuerdo registrado");
  };

  const termRows: { label: string; value: string }[] = [
    { label: "Plazo de pago", value: `${terms.paymentDays} días` },
    { label: "Descuento base", value: `${terms.baseDiscount}%` },
    { label: "Flete", value: terms.freight },
    { label: "Mínimo de compra", value: terms.minOrder },
    { label: "Rebate / bonificación", value: terms.rebate },
    { label: "Devoluciones", value: terms.returns },
    { label: "Apoyo marketing", value: terms.marketing },
    { label: "Ejecutivo asignado", value: terms.account },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Condiciones comerciales */}
      <Card>
        <CardHeader
          title="Condiciones comerciales"
          description="La foto completa de lo acordado hoy"
          action={
            <button
              onClick={openTerms}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Editar
            </button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {termRows.map((r) => (
              <div key={r.label} className="flex flex-col">
                <span className="text-[11px] text-slate-400">{r.label}</span>
                <span className="text-sm font-medium text-slate-800">{r.value}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Acuerdos y seguimiento */}
      <Card>
        <CardHeader
          title="Acuerdos y seguimiento"
          description="Qué se pidió, qué se acordó y el próximo seguimiento"
          action={
            <Button size="sm" variant="secondary" onClick={openAgr}>
              + Registrar
            </Button>
          }
        />
        <CardBody>
          {agreements.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin acuerdos registrados. Registra lo conversado en la próxima reunión.
            </p>
          ) : (
            <div className="space-y-2.5">
              {agreements.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">
                      {formatDate(a.date)}
                    </span>
                    {a.followUp && <Badge tone="amber">Seguir {formatDate(a.followUp)}</Badge>}
                  </div>
                  <p className="text-sm text-slate-800">
                    <span className="text-slate-400">Objetivo:</span> {a.objective}
                  </p>
                  {a.agreed && (
                    <p className="text-sm text-emerald-700 mt-0.5">
                      <span className="text-slate-400">Acordado:</span> {a.agreed}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal editar condiciones */}
      <Modal
        open={editTerms}
        onClose={closeTerms}
        title="Editar condiciones comerciales"
        description={supplier.name}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeTerms}>
              Cancelar
            </Button>
            <Button onClick={saveTerms} disabled={!termsDirty}>
              {termsDirty ? "Guardar" : "Sin cambios"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Plazo de pago (días)
            </label>
            <Input
              type="number"
              min={0}
              value={draft.paymentDays}
              onChange={(e) => setDraft({ ...draft, paymentDays: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Descuento base (%)
            </label>
            <Input
              type="number"
              min={0}
              value={draft.baseDiscount}
              onChange={(e) => setDraft({ ...draft, baseDiscount: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Flete</label>
            <Input
              value={draft.freight}
              onChange={(e) => setDraft({ ...draft, freight: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Mínimo de compra
            </label>
            <Input
              value={draft.minOrder}
              onChange={(e) => setDraft({ ...draft, minOrder: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Rebate / bonificación
            </label>
            <Input
              value={draft.rebate}
              onChange={(e) => setDraft({ ...draft, rebate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Devoluciones
            </label>
            <Input
              value={draft.returns}
              onChange={(e) => setDraft({ ...draft, returns: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Apoyo marketing
            </label>
            <Input
              value={draft.marketing}
              onChange={(e) => setDraft({ ...draft, marketing: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Ejecutivo asignado
            </label>
            <Input
              value={draft.account}
              onChange={(e) => setDraft({ ...draft, account: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDiscard}
        title="Descartar cambios"
        message="Tienes cambios sin guardar en las condiciones comerciales. Si sales ahora se perderán."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          setEditTerms(false);
        }}
      />

      {/* Modal registrar acuerdo */}
      <Modal
        open={!!newAgr}
        onClose={() => setNewAgr(null)}
        title="Registrar acuerdo"
        description={supplier.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewAgr(null)}>
              Cancelar
            </Button>
            <Button onClick={saveAgr}>Guardar</Button>
          </>
        }
      >
        {newAgr && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha</label>
              <Input
                type="date"
                value={newAgr.date}
                onChange={(e) => setNewAgr({ ...newAgr, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Objetivo / lo pedido
              </label>
              <Input
                value={newAgr.objective}
                onChange={(e) => setNewAgr({ ...newAgr, objective: e.target.value })}
                placeholder="Ej: Bajar costo 5% y fill 95%"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Lo acordado
              </label>
              <Input
                value={newAgr.agreed}
                onChange={(e) => setNewAgr({ ...newAgr, agreed: e.target.value })}
                placeholder="Ej: 3% + despacho semanal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Próximo seguimiento
              </label>
              <Input
                type="date"
                value={newAgr.followUp}
                onChange={(e) => setNewAgr({ ...newAgr, followUp: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Evaluación del proveedor (score 0–100). Cumplimiento de fecha y cantidad
//  usan datos reales; el resto de dimensiones son simuladas (demo) de forma
//  determinista a partir del id del proveedor.
// ---------------------------------------------------------------------------

