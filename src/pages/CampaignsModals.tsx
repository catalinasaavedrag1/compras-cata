import { useEffect, useState } from "react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { IconPlus } from "../components/ui/icons";
import type { CampaignView } from "../services/purchaseBff";
import type { CreateCampaignInput } from "../hooks/useCampaigns";

// ============================================================================
//  Modales de campañas contra el purchase-bff-service. El formulario de
//  "producto en descuento" del mock desapareció: el contrato real no modela
//  productos por campaña, solo la campaña (título, canal, presupuesto, fechas).
// ============================================================================

/**
 * Modal para crear un espacio publicitario: campaña real type 'ad_space' con
 * channelRef obligatorio. Las campañas desde oportunidad se crean en
 * Anticipación de campañas, ligadas a su oportunidad.
 */
export function CreateCampaignModal({
  open,
  onClose,
  onCreate,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateCampaignInput) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [budget, setBudget] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setChannel("");
      setFrom("");
      setTo("");
      setBudget("");
    }
  }, [open]);

  const budgetClp = parseInt(budget, 10) || 0;
  const valid = title.trim().length > 0 && channel.trim().length > 0 && !!from && !!to && to >= from;

  const submit = () => {
    if (!valid) return;
    onCreate({
      type: "ad_space",
      title: title.trim(),
      channelRef: channel.trim(),
      startsAt: from,
      endsAt: to,
      ...(budgetClp > 0 ? { budgetClp } : {}),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear espacio publicitario"
      description="Reserva un espacio en un canal con su vigencia y presupuesto. Las campañas ligadas a una oportunidad se crean desde Anticipación de campañas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={submit} disabled={!valid || busy}>
            {busy ? "Creando…" : "Crear campaña"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Título de la campaña
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Banner home Cyber"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Canal (channelRef)
          </label>
          <Input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="Ej: web, tienda, marketplace, redes, email"
          />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Desde</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hasta</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Presupuesto (CLP, opcional)
          </label>
          <div className="max-w-[240px]">
            <Input
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Modal para editar lo que el contrato permite cambiar de una campaña:
 * presupuesto y fecha de término (PATCH con If-Match).
 */
export function EditCampaignModal({
  camp,
  onClose,
  onSave,
  busy,
}: {
  camp: CampaignView | null;
  onClose: () => void;
  onSave: (body: { budgetClp?: number; endsAt?: string }) => void;
  busy: boolean;
}) {
  const [budget, setBudget] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (camp) {
      setBudget(camp.budgetClp !== null ? String(camp.budgetClp) : "");
      setEndsAt(camp.endsAt ? camp.endsAt.slice(0, 10) : "");
    }
  }, [camp]);

  const budgetClp = parseInt(budget, 10);
  const body: { budgetClp?: number; endsAt?: string } = {};
  if (!Number.isNaN(budgetClp) && budgetClp >= 0 && budgetClp !== camp?.budgetClp)
    body.budgetClp = budgetClp;
  if (endsAt && endsAt !== (camp?.endsAt ?? "").slice(0, 10)) body.endsAt = endsAt;
  const valid = Object.keys(body).length > 0;

  return (
    <Modal
      open={!!camp}
      onClose={onClose}
      title="Editar campaña"
      description="El contrato permite ajustar el presupuesto y la fecha de término."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => valid && onSave(body)} disabled={!valid || busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      {camp && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 h-10 border border-slate-200 rounded-lg px-3 bg-slate-50">
            <span className="text-sm font-medium text-slate-700 truncate">{camp.title}</span>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Presupuesto (CLP)
              </label>
              <Input
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Termina el
              </label>
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
