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

export function buyerAttribution(buyer: Buyer): BuyerAttribution {
  const total = buyer.stockouts;
  const h = hashStr(buyer.id);
  const h2 = hashStr(buyer.id + "x");

  // Participaciones deterministas (proveedor 25-55%, demanda 10-30%, resto comprador)
  const provShare = 0.25 + (h % 31) / 100;
  const demShare = 0.1 + (h2 % 21) / 100;
  const proveedor = Math.round(total * provShare);
  const demanda = Math.round(total * demShare);
  const comprador = Math.max(0, total - proveedor - demanda);

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const slices: CauseSlice[] = [
    { key: "comprador", label: "Tu decisión", count: comprador, pct: pct(comprador), tone: "red", desc: "Compró poco, tarde o no repuso a tiempo" },
    { key: "proveedor", label: "Proveedor", count: proveedor, pct: pct(proveedor), tone: "amber", desc: "No despachó, entregó parcial o subió el costo" },
    { key: "demanda", label: "Demanda", count: demanda, pct: pct(demanda), tone: "blue", desc: "Venta inesperada, campaña o licitación no planificada" },
  ];

  const externos = proveedor + demanda;
  const scoreAdjust = Math.round(externos * 0.8);
  const fairNote =
    externos > 0
      ? `De tus ${total} quiebres, ${externos} fueron por causas externas (${proveedor} del proveedor, ${demanda} por demanda no planificada): no deberían penalizar tu gestión. Solo ${comprador} dependieron de tu decisión.`
      : `Tus ${total} quiebres dependieron de tu decisión de compra. Foco en reponer antes y ajustar el sugerido.`;

  return { total, slices, fairNote, scoreAdjust };
}
