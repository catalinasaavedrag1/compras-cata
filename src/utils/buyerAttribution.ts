import type { Buyer } from "../types/team";

// ============================================================================
//  Atribución de causa de los problemas del comprador (sección 14 del spec).
//  Medir injustamente desmotiva: si el proveedor no despachó, el quiebre no es
//  culpa del comprador. Separa los quiebres en causa comprador / proveedor /
//  demanda de forma determinista (frontend) para una evaluación justa.
// ============================================================================

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface CauseSlice {
  key: "comprador" | "proveedor" | "demanda";
  label: string;
  count: number;
  pct: number;
  tone: "red" | "amber" | "blue";
  desc: string;
}

export interface BuyerAttribution {
  total: number;
  slices: CauseSlice[];
  fairNote: string;
  scoreAdjust: number; // pts que el score "debería" devolver por causas externas
}

const SLICE_META = {
  comprador: { label: "Tu decisión", tone: "red" as const, desc: "Compró poco, tarde o no repuso a tiempo" },
  proveedor: { label: "Proveedor", tone: "amber" as const, desc: "No despachó, entregó parcial o subió el costo" },
  demanda: { label: "Demanda", tone: "blue" as const, desc: "Venta inesperada, campaña o licitación no planificada" },
};

export function buyerAttribution(buyer: Buyer): BuyerAttribution {
  const total = buyer.stockouts;

  // Caso sin quiebres: nada que atribuir, mensaje positivo.
  if (total <= 0) {
    const slices: CauseSlice[] = (["comprador", "proveedor", "demanda"] as const).map((key) => ({
      key,
      ...SLICE_META[key],
      count: 0,
      pct: 0,
    }));
    return {
      total: 0,
      slices,
      fairNote: "Sin quiebres este período. Excelente disponibilidad — mantén el ritmo de reposición.",
      scoreAdjust: 0,
    };
  }

  const h = hashStr(buyer.id);
  const h2 = hashStr(buyer.id + "x");

  // Participaciones deterministas (proveedor 25-55%, demanda 10-30%, resto comprador)
  const provShare = 0.25 + (h % 31) / 100;
  const demShare = 0.1 + (h2 % 21) / 100;
  const proveedor = Math.round(total * provShare);
  const demanda = Math.round(total * demShare);
  const comprador = Math.max(0, total - proveedor - demanda);

  // Porcentajes con método del resto mayor (Hamilton) para que sumen 100.
  const counts = { comprador, proveedor, demanda };
  const raw = { comprador: (comprador / total) * 100, proveedor: (proveedor / total) * 100, demanda: (demanda / total) * 100 };
  const floors = { comprador: Math.floor(raw.comprador), proveedor: Math.floor(raw.proveedor), demanda: Math.floor(raw.demanda) };
  let remainder = 100 - (floors.comprador + floors.proveedor + floors.demanda);
  const byFrac = (Object.keys(raw) as (keyof typeof raw)[]).sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));
  const pctMap = { ...floors };
  for (const k of byFrac) {
    if (remainder <= 0) break;
    pctMap[k] += 1;
    remainder--;
  }

  const slices: CauseSlice[] = (["comprador", "proveedor", "demanda"] as const).map((key) => ({
    key,
    ...SLICE_META[key],
    count: counts[key],
    pct: pctMap[key],
  }));

  const externos = proveedor + demanda;
  const scoreAdjust = Math.round(externos * 0.8);
  const fairNote =
    externos > 0
      ? `De tus ${total} quiebres, ${externos} fueron por causas externas (${proveedor} del proveedor, ${demanda} por demanda no planificada): no deberían penalizar tu gestión. Solo ${comprador} dependieron de tu decisión.`
      : `Tus ${total} quiebres dependieron de tu decisión de compra. Foco en reponer antes y ajustar el sugerido.`;

  return { total, slices, fairNote, scoreAdjust };
}
