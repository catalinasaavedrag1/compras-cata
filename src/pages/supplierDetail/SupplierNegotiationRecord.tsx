import { useState } from "react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToast } from "../../context/ToastContext";
import { formatDate } from "../../utils/formatters";
import {
  createSupplierNegotiation,
  describePurchaseBffError,
  toPurchaseBffError,
  type SupplierNegotiationRow,
} from "../../services/purchaseBff";

// ---------------------------------------------------------------------------
//  Registro de negociación (C15): rondas reales del servicio de compras.
//  Cada ronda se persiste con POST /suppliers/:id/negotiations (tema + minuta
//  obligatorios); tras crear, la ficha se refresca para mostrarla.
// ---------------------------------------------------------------------------

const fmtDate = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Estado de la ronda → chip (tolerante a los valores del dominio). */
const ROUND_STATUS_UI: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: "En curso", tone: "amber" },
  agreed: { label: "Acordada", tone: "green" },
  closed: { label: "Cerrada", tone: "neutral" },
};

function roundStatusUi(status: string | undefined): { label: string; tone: BadgeTone } {
  if (!status) return { label: "Registrada", tone: "neutral" };
  return ROUND_STATUS_UI[status] ?? { label: status, tone: "neutral" };
}

/** Resultado (outcome JSON) → texto plano legible, sin inventar estructura. */
function outcomeText(outcome: Record<string, unknown> | null | undefined): string | null {
  if (!outcome) return null;
  const entries = Object.entries(outcome).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
}

export function SupplierNegotiationRecord({
  supplierId,
  negotiations,
  onCreated,
}: {
  supplierId: string;
  negotiations: SupplierNegotiationRow[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openModal = () => {
    setTopic("");
    setMinutes("");
    setFormError("");
    setCreating(true);
  };

  const submit = async () => {
    if (!topic.trim() || !minutes.trim()) {
      setFormError("El tema y la minuta son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await createSupplierNegotiation(supplierId, {
        topic: topic.trim(),
        minutes: minutes.trim(),
      });
      toast.success("Ronda de negociación registrada");
      setCreating(false);
      onCreated();
    } catch (err) {
      toast.error(describePurchaseBffError(toPurchaseBffError(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Registro de negociación"
        description="Rondas registradas contra el servicio de compras (tema, minuta y resultado)."
        action={
          <Button size="sm" onClick={openModal}>
            Registrar ronda
          </Button>
        }
      />
      <CardBody>
        {negotiations.length === 0 ? (
          <EmptyState
            title="Sin rondas registradas"
            description="Registra el tema tratado y la minuta de la próxima reunión con el proveedor."
          />
        ) : (
          <div className="space-y-2">
            {negotiations.map((n) => {
              const st = roundStatusUi(n.status);
              const outcome = outcomeText(n.outcome);
              return (
                <div key={n.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {n.topic ?? "Ronda de negociación"}
                    </span>
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                    <span className="ml-auto text-[11px] text-slate-400">
                      {fmtDate(n.dateCreated)}
                    </span>
                  </div>
                  {n.minutes && (
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{n.minutes}</p>
                  )}
                  {outcome && (
                    <p className="mt-1 text-xs text-emerald-700">
                      <span className="text-slate-400">Resultado:</span> {outcome}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Registrar ronda de negociación"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Guardando…" : "Registrar"}
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
            label="Tema"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: Revisión de costos 2º semestre"
          />
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Minuta</label>
            <textarea
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              rows={4}
              placeholder="Qué se conversó, qué pidió cada parte y los próximos pasos."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
