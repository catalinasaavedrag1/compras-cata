import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/EmptyState";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { useToast } from "../../context/ToastContext";
import { TODAY_ISO } from "../../utils/constants";
import { formatCurrency, formatCurrencyCompact, formatDate } from "../../utils/formatters";
import {
  NEGOTIATION_LEVER,
  NEGOTIATION_BENEFIT,
  NEGOTIATION_STATUS,
  negotiationsForSupplier,
} from "../../data/mockNegotiations";
import type {
  NegotiationBenefit,
  NegotiationLever,
  NegotiationRound,
  NegotiationStatus,
  Supplier,
} from "../../types/purchasing";

const leverMeta = (l: NegotiationLever) => NEGOTIATION_LEVER[l] ?? l;
const benefitMeta = (b: NegotiationBenefit) =>
  NEGOTIATION_BENEFIT[b] ?? { label: b, tone: "slate" as const, real: false };
const statusMeta = (s: NegotiationStatus) =>
  NEGOTIATION_STATUS[s] ?? { label: s, tone: "neutral" as const };

/** Registro estructurado de negociación: rondas + diferenciación del beneficio. */
export function SupplierNegotiationRecord({ supplier }: { supplier: Supplier }) {
  const toast = useToast();
  const [rounds, setRounds] = useLocalStorage<NegotiationRound[]>(
    `compras:negotiations:${supplier.id}`,
    negotiationsForSupplier(supplier.id)
  );
  const [creating, setCreating] = useState(false);

  const summary = useMemo(() => {
    const agreed = rounds.filter((r) => r.status === "acordado");
    const byBenefit: Record<NegotiationBenefit, number> = {
      ahorro_real: 0,
      bonificacion: 0,
      plazo: 0,
      logistico: 0,
      promo: 0,
    };
    agreed.forEach((r) => {
      byBenefit[r.benefit] = (byBenefit[r.benefit] ?? 0) + r.valueClp;
    });
    const real = byBenefit.ahorro_real;
    const others =
      byBenefit.bonificacion + byBenefit.plazo + byBenefit.logistico + byBenefit.promo;
    return { byBenefit, real, others, total: real + others };
  }, [rounds]);

  return (
    <Card>
      <CardHeader
        title="Registro de negociación"
        description="Rondas, condición final y tipo de beneficio (no todo es un solo porcentaje)"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            Registrar ronda
          </Button>
        }
      />
      <CardBody>
        {/* Resumen: diferencia ahorro real de los demás beneficios */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <p className="text-[11px] font-medium text-emerald-700">Ahorro real / año</p>
            <p className="text-base font-semibold text-emerald-800">
              {formatCurrencyCompact(summary.real)}
            </p>
          </div>
          {(
            [
              ["bonificacion", "Bonificación"],
              ["plazo", "Plazo"],
              ["logistico", "Logístico"],
              ["promo", "Promo"],
            ] as [NegotiationBenefit, string][]
          ).map(([k, label]) => (
            <div key={k} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
              <p className="text-base font-semibold text-slate-800">
                {formatCurrencyCompact(summary.byBenefit[k])}
              </p>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">Total beneficios</p>
            <p className="text-base font-semibold text-slate-900">
              {formatCurrencyCompact(summary.total)}
            </p>
          </div>
        </div>

        {rounds.length === 0 ? (
          <EmptyState
            title="Sin rondas registradas"
            description="Registra la condición inicial, el objetivo, la oferta del proveedor y lo acordado."
          />
        ) : (
          <div className="space-y-2">
            {rounds.map((r) => {
              const b = benefitMeta(r.benefit);
              const st = statusMeta(r.status);
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{leverMeta(r.lever)}</span>
                    <Badge tone={b.tone}>{b.label}</Badge>
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                    <span className="ml-auto text-sm font-semibold text-slate-900">
                      {formatCurrency(r.valueClp)}/año
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="text-slate-400">Inicial:</span>
                    <span className="text-slate-600">{r.initial}</span>
                    <span className="text-slate-300">→</span>
                    <span className="text-slate-400">Objetivo:</span>
                    <span className="text-slate-600">{r.target}</span>
                    <span className="text-slate-300">→</span>
                    <span className="text-slate-400">Proveedor:</span>
                    <span className="text-slate-600">{r.supplierOffer}</span>
                    <span className="text-slate-300">→</span>
                    <span className="text-slate-400">Final:</span>
                    <span className="font-medium text-slate-800">{r.final}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatDate(r.date)} · {r.responsible}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>

      {creating && (
        <NewRoundModal
          onClose={() => setCreating(false)}
          onCreate={(round) => {
            setRounds((prev) => [{ ...round, id: `NEG-${Date.now()}` }, ...prev]);
            toast.success("Ronda registrada");
            setCreating(false);
          }}
        />
      )}
    </Card>
  );
}

function NewRoundModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (round: Omit<NegotiationRound, "id">) => void;
}) {
  const [lever, setLever] = useState<NegotiationLever>("descuento");
  const [benefit, setBenefit] = useState<NegotiationBenefit>("ahorro_real");
  const [status, setStatus] = useState<NegotiationStatus>("en_curso");
  const [initial, setInitial] = useState("");
  const [target, setTarget] = useState("");
  const [supplierOffer, setSupplierOffer] = useState("");
  const [final, setFinal] = useState("");
  const [valueClp, setValueClp] = useState(0);
  const [error, setError] = useState("");

  const submit = () => {
    if (!target.trim() || !final.trim()) {
      setError("Completa al menos el objetivo y la condición final.");
      return;
    }
    onCreate({
      date: TODAY_ISO,
      lever,
      initial: initial.trim() || "—",
      target: target.trim(),
      supplierOffer: supplierOffer.trim() || "—",
      final: final.trim(),
      benefit,
      valueClp: Math.max(0, valueClp),
      status,
      responsible: "Catalina Saavedra",
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar ronda de negociación"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Registrar</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Palanca"
            value={lever}
            onChange={(e) => setLever(e.target.value as NegotiationLever)}
            options={(Object.keys(NEGOTIATION_LEVER) as NegotiationLever[]).map((k) => ({
              value: k,
              label: NEGOTIATION_LEVER[k],
            }))}
          />
          <Select
            label="Tipo de beneficio"
            value={benefit}
            onChange={(e) => setBenefit(e.target.value as NegotiationBenefit)}
            options={(Object.keys(NEGOTIATION_BENEFIT) as NegotiationBenefit[]).map((k) => ({
              value: k,
              label: NEGOTIATION_BENEFIT[k].label,
            }))}
          />
          <Input label="Condición inicial" value={initial} onChange={(e) => setInitial(e.target.value)} />
          <Input label="Objetivo" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Input
            label="Propuesta del proveedor"
            value={supplierOffer}
            onChange={(e) => setSupplierOffer(e.target.value)}
          />
          <Input label="Condición final" value={final} onChange={(e) => setFinal(e.target.value)} />
          <Select
            label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as NegotiationStatus)}
            options={(Object.keys(NEGOTIATION_STATUS) as NegotiationStatus[]).map((k) => ({
              value: k,
              label: NEGOTIATION_STATUS[k].label,
            }))}
          />
          <Input
            label="Valor estimado (CLP/año)"
            type="number"
            min={0}
            value={valueClp}
            onChange={(e) => setValueClp(Number(e.target.value))}
          />
        </div>
      </div>
    </Modal>
  );
}
