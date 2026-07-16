import type { PurchaseDecision } from "../data/mockDecisions";

// ============================================================================
//  Evaluación de la compra realizada (sección 20).
//  No basta con "llegó": compara lo previsto con lo real y responde si la
//  decisión fue correcta, para que el sistema y el comprador aprendan.
// ============================================================================

export interface DecisionCheck {
  label: string;
  ok: boolean;
}

export interface DecisionEvaluation {
  measured: boolean;
  qtyDeviation: number; // comprado − sugerido
  qtyDeviationPct: number;
  forecastErrorPct: number | null; // (real − proyectado) / proyectado
  overstockValue: number; // capital inmovilizado por remanente (CLP)
  marginDelta: number | null; // real − previsto (pts)
  checks: DecisionCheck[];
  ruleToChange: string | null;
}

export function evaluateDecision(d: PurchaseDecision): DecisionEvaluation {
  const qtyDeviation = d.purchasedQty - d.suggestedQty;
  const qtyDeviationPct = d.suggestedQty > 0 ? Math.round((qtyDeviation / d.suggestedQty) * 100) : 0;

  const measured =
    d.outcome !== "pendiente" && d.demandActual !== undefined && d.demandForecast !== undefined;

  if (!measured) {
    return {
      measured: false,
      qtyDeviation,
      qtyDeviationPct,
      forecastErrorPct: null,
      overstockValue: 0,
      marginDelta: null,
      checks: [],
      ruleToChange: null,
    };
  }

  const forecast = d.demandForecast ?? 0;
  const actual = d.demandActual ?? 0;
  const forecastErrorPct = forecast > 0 ? Math.round(((actual - forecast) / forecast) * 100) : 0;
  const overstockValue = Math.round((d.remainingUnits ?? 0) * d.unitCost);
  const marginDelta =
    d.marginActual !== undefined && d.marginPlanned !== undefined
      ? d.marginActual - d.marginPlanned
      : null;

  const soldAsExpected = Math.abs(forecastErrorPct) <= 12;
  const noOverstock = (d.remainingUnits ?? 0) <= Math.max(2, actual * 0.1);
  const supplierMet = d.onTime !== false;
  const forecastOk = Math.abs(forecastErrorPct) <= 15;
  const buyerAdjustedOk = Math.abs(qtyDeviationPct) < 25;
  const noStockout = d.outcome !== "corto";

  const checks: DecisionCheck[] = [
    { label: "Llegó a tiempo / completo", ok: supplierMet },
    { label: "Se vendió lo esperado", ok: soldAsExpected },
    { label: "No generó sobrestock", ok: noOverstock },
    { label: "No hubo quiebre", ok: noStockout },
    { label: "Pronóstico acertado", ok: forecastOk },
    { label: "Ajuste vs sugerido razonable", ok: buyerAdjustedOk },
  ];

  // Regla a ajustar según el patrón de error.
  let ruleToChange: string | null = null;
  if (!supplierMet) {
    ruleToChange = "Subir el nivel de servicio exigido al proveedor o habilitar alternativa.";
  } else if (qtyDeviationPct >= 25 && overstockValue > 0) {
    ruleToChange = "El comprador subió muy por sobre el sugerido: revisar el gatillo de compra por volumen.";
  } else if (qtyDeviationPct <= -25 && d.outcome === "corto") {
    ruleToChange = "Recortar bajo el sugerido causó quiebre: proteger SKU de alta rotación.";
  } else if (forecastErrorPct >= 15) {
    ruleToChange = "El pronóstico subestimó la demanda: subir la cobertura objetivo o el factor estacional.";
  } else if (forecastErrorPct <= -15) {
    ruleToChange = "El pronóstico sobreestimó la demanda: bajar la cobertura objetivo de la categoría.";
  }

  return {
    measured: true,
    qtyDeviation,
    qtyDeviationPct,
    forecastErrorPct,
    overstockValue,
    marginDelta,
    checks,
    ruleToChange,
  };
}
