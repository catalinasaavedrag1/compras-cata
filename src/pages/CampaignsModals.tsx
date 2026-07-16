import type { Dispatch, SetStateAction } from "react";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { IconPlus } from "../components/ui/icons";
import { PLACEMENT_LABELS, type PromoChannelKey, type PlacementKey } from "../data/mockCampaignPlans";
import type { ProductForm } from "./campaignsHelpers";

type RetailPrice = { normal: number; promo: number; name: string; category: string } | null;

/**
 * Modal para agregar o editar un producto en descuento: producto, vigencia,
 * precios (con descuento calculado), canal, ubicación y presupuesto.
 * (Extraído de CampaignsPage.)
 */
export function ProductFormModal({
  form,
  setForm,
  onSubmit,
  onRemove,
  fValid,
  fDiscount,
  retailPrice,
  productOptions,
}: {
  form: ProductForm | null;
  setForm: Dispatch<SetStateAction<ProductForm | null>>;
  onSubmit: () => void;
  onRemove: () => void;
  fValid: boolean;
  fDiscount: number;
  retailPrice: (sku: string) => RetailPrice;
  productOptions: { value: string; label: string }[];
}) {
  return (
    <Modal
      open={!!form}
      onClose={() => setForm(null)}
      title={
        form?.mode === "edit" ? "Editar producto en descuento" : "Agregar producto en descuento"
      }
      description="Define el producto, la vigencia y el precio antes y después."
      size="lg"
      footer={
        <>
          {form?.mode === "edit" && (
            <Button variant="danger" onClick={onRemove}>
              Quitar
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={() => setForm(null)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!fValid}>
            {form?.mode === "edit" ? "Guardar cambios" : "Agregar a la campaña"}
          </Button>
        </>
      }
    >
      {form && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Producto</label>
            {form.mode === "edit" ? (
              <div className="flex items-center gap-2.5 h-10 border border-slate-200 rounded-lg px-3 bg-slate-50">
                <span className="text-[11px] font-mono text-slate-400">{form.sku}</span>
                <span className="text-sm font-medium text-slate-700">{form.name}</span>
              </div>
            ) : (
              <Select
                value={form.sku}
                onChange={(e) => {
                  const sku = e.target.value;
                  const r = retailPrice(sku);
                  setForm(
                    (f) =>
                      f && {
                        ...f,
                        sku,
                        name: r?.name ?? "",
                        category: r?.category ?? "",
                        normal: r ? String(r.normal) : f.normal,
                        promo: r ? String(r.promo) : f.promo,
                      }
                  );
                }}
                options={[{ value: "", label: "Selecciona un producto…" }, ...productOptions]}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Descuento desde
              </label>
              <Input
                type="date"
                value={form.from}
                onChange={(e) => setForm((f) => f && { ...f, from: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Descuento hasta
              </label>
              <Input
                type="date"
                value={form.to}
                onChange={(e) => setForm((f) => f && { ...f, to: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3.5 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Precio antes
              </label>
              <Input
                inputMode="numeric"
                value={form.normal}
                onChange={(e) =>
                  setForm((f) => f && { ...f, normal: e.target.value.replace(/[^0-9]/g, "") })
                }
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Precio con descuento
              </label>
              <Input
                inputMode="numeric"
                value={form.promo}
                onChange={(e) =>
                  setForm((f) => f && { ...f, promo: e.target.value.replace(/[^0-9]/g, "") })
                }
                placeholder="0"
              />
            </div>
            <div className="text-center pb-0.5">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descuento</label>
              <span
                className={`inline-flex items-center justify-center min-w-[62px] h-10 rounded-lg bg-rose-50 text-base font-bold ${fDiscount > 0 ? "text-rose-600" : "text-slate-300"}`}
              >
                {fDiscount > 0 ? `-${fDiscount}%` : "—"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Canal</label>
              <Select
                value={form.channel}
                onChange={(e) =>
                  setForm((f) => f && { ...f, channel: e.target.value as PromoChannelKey })
                }
                options={[
                  { value: "redes", label: "Redes Sociales" },
                  { value: "ml", label: "Mercado Libre" },
                  { value: "web", label: "Web / Banner" },
                  { value: "tienda", label: "Tienda física" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Ubicación / exhibición
              </label>
              <Select
                value={form.placement}
                onChange={(e) =>
                  setForm((f) => f && { ...f, placement: e.target.value as PlacementKey })
                }
                options={(Object.keys(PLACEMENT_LABELS) as PlacementKey[]).map((k) => ({
                  value: k,
                  label: PLACEMENT_LABELS[k],
                }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Presupuesto de publicidad
            </label>
            <div className="max-w-[220px]">
              <Input
                inputMode="numeric"
                value={form.budget}
                onChange={(e) =>
                  setForm((f) => f && { ...f, budget: e.target.value.replace(/[^0-9]/g, "") })
                }
                placeholder="0"
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Modal para crear una campaña: nombre, rango de fechas y presupuesto total
 * (que se reparte automáticamente por canal). (Extraído de CampaignsPage.)
 */
export function CreateCampaignModal({
  open,
  onClose,
  cmName,
  setCmName,
  cmFrom,
  setCmFrom,
  cmTo,
  setCmTo,
  cmBudget,
  setCmBudget,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  cmName: string;
  setCmName: (value: string) => void;
  cmFrom: string;
  setCmFrom: (value: string) => void;
  cmTo: string;
  setCmTo: (value: string) => void;
  cmBudget: string;
  setCmBudget: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear campaña"
      description="Define el evento y su presupuesto. Luego agrega los productos en descuento."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={onCreate}>
            Crear campaña
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Nombre de la campaña
          </label>
          <Input
            value={cmName}
            onChange={(e) => setCmName(e.target.value)}
            placeholder="Ej: Cyber Septiembre"
          />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Desde</label>
            <Input type="date" value={cmFrom} onChange={(e) => setCmFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hasta</label>
            <Input type="date" value={cmTo} onChange={(e) => setCmTo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Presupuesto total de la campaña
          </label>
          <div className="max-w-[240px]">
            <Input
              inputMode="numeric"
              value={cmBudget}
              onChange={(e) => setCmBudget(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Se reparte automáticamente: 40% Redes, 30% Mercado Libre, 20% Web, 10% Tienda. Lo puedes
            ajustar después.
          </p>
        </div>
      </div>
    </Modal>
  );
}
