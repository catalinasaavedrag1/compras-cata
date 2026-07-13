import type { ProductLogistics, VehicleClass } from "../types/purchasing";
import { getProductBySku } from "../data/mockProducts";
import { productLogistics, TRUCKS, EXTRA_CENTER_COST, VEHICLE_LABEL } from "../data/logistics";
import { formatDate } from "./formatters";

// ============================================================================
//  Motor de simulación de retiro
//  ---------------------------------------------------------------------------
//  A partir de las líneas de la compra (SKU + cantidad) estima cómo se retirará
//  físicamente la mercadería: cuántos camiones, de qué tipo, con qué ocupación,
//  desde qué centros y en qué fecha, con qué costo — y qué problemas o mejoras
//  advertir antes de emitir la orden. Todo es una estimación (no un ruteo real).
// ============================================================================

export interface PickupLineInput {
  sku: string;
  productName: string;
  quantity: number;
}

/** Línea de la compra ya resuelta con su ficha logística. */
export interface PickupParcel extends PickupLineInput {
  log: ProductLogistics;
  totalWeightKg: number;
  totalVolumeM3: number;
}

export interface TruckItem {
  sku: string;
  productName: string;
  units: number;
  weightKg: number;
  volumeM3: number;
}

export interface TruckLoad {
  id: number;
  center: string;
  vehicle: VehicleClass;
  vehicleLabel: string;
  items: TruckItem[];
  weightKg: number;
  volumeM3: number;
  capacityKg: number;
  capacityM3: number;
  /** % de ocupación (0-100+) por peso y por volumen. */
  weightPct: number;
  volumePct: number;
  /** Restricción dominante que llena el camión: "peso" | "volumen". */
  limitedBy: "peso" | "volumen";
  requiresPluma: boolean;
  hasOversized: boolean;
}

export type LogisticsAlertLevel = "warning" | "info";

export interface LogisticsAlert {
  level: LogisticsAlertLevel;
  text: string;
}

export interface LogisticsSuggestion {
  text: string;
}

export interface PickupPlan {
  parcels: PickupParcel[];
  trucks: TruckLoad[];
  truckCount: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  centers: string[];
  dates: string[];
  firstDate: string | null;
  lastDate: string | null;
  estimatedCost: number;
  /** Costo logístico por unidad transportada. */
  costPerUnit: number;
  avgFillPct: number;
  alerts: LogisticsAlert[];
  suggestions: LogisticsSuggestion[];
}

export interface ScenarioComparison {
  immediate: PickupPlan;
  consolidated: PickupPlan;
  /** ¿Consolidar (esperar + un solo centro) mejora el plan? */
  worthConsolidating: boolean;
}

// ----------------------------------------------------------------------------
//  Resolución de líneas
// ----------------------------------------------------------------------------

export function resolvePickupLines(lines: PickupLineInput[]): PickupParcel[] {
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const product = getProductBySku(l.sku);
      // Producto sin maestro: ficha logística mínima para no romper el cálculo.
      const log: ProductLogistics = product
        ? productLogistics(product)
        : {
            pesoUnitarioKg: 2,
            volumenM3: 0.01,
            apilable: true,
            fragil: false,
            sobredimensionado: false,
            cargaPesada: false,
            manipulacion: "manual",
            vehiculoMinimo: "camion_3_4",
            centroRetiro: "CD Santiago",
            fechaDisponible: "",
            grupoCarga: "general",
          };
      return {
        ...l,
        log,
        totalWeightKg: l.quantity * log.pesoUnitarioKg,
        totalVolumeM3: l.quantity * log.volumenM3,
      };
    });
}

// ----------------------------------------------------------------------------
//  Empaquetado (bin-packing) por centro / vehículo / compatibilidad
// ----------------------------------------------------------------------------

interface PackTruck {
  center: string;
  bucket: "pluma" | "estandar";
  items: Map<string, TruckItem>;
  parcels: PickupParcel[]; // parcels con carga en este camión (para compatibilidad)
  weightKg: number;
  volumeM3: number;
  capacityKg: number;
  capacityM3: number;
  hasOversized: boolean;
  requiresPluma: boolean;
}

function needsPluma(log: ProductLogistics): boolean {
  return log.manipulacion === "pluma" || log.vehiculoMinimo === "camion_pluma";
}

/** ¿Dos cargas pueden compartir camión? (reglas de compatibilidad por grupo). */
function compatible(a: PickupParcel, b: PickupParcel): boolean {
  const ga = a.log.grupoCarga;
  const gb = b.log.grupoCarga;
  if (ga && b.log.incompatibleCon?.includes(ga)) return false;
  if (gb && a.log.incompatibleCon?.includes(gb)) return false;
  return true;
}

/** ¿Cuántas unidades del parcel caben en el espacio restante del camión? */
function unitsThatFit(truck: PackTruck, p: PickupParcel): number {
  const remW = truck.capacityKg - truck.weightKg;
  const remV = truck.capacityM3 - truck.volumeM3;
  const byW = p.log.pesoUnitarioKg > 0 ? Math.floor(remW / p.log.pesoUnitarioKg) : Infinity;
  const byV = p.log.volumenM3 > 0 ? Math.floor(remV / p.log.volumenM3) : Infinity;
  const fit = Math.min(byW, byV);
  return Number.isFinite(fit) ? Math.max(0, fit) : p.quantity;
}

function addToTruck(truck: PackTruck, p: PickupParcel, units: number) {
  const w = units * p.log.pesoUnitarioKg;
  const v = units * p.log.volumenM3;
  const prev = truck.items.get(p.sku);
  if (prev) {
    prev.units += units;
    prev.weightKg += w;
    prev.volumeM3 += v;
  } else {
    truck.items.set(p.sku, {
      sku: p.sku,
      productName: p.productName,
      units,
      weightKg: w,
      volumeM3: v,
    });
    truck.parcels.push(p);
  }
  truck.weightKg += w;
  truck.volumeM3 += v;
  if (p.log.sobredimensionado) truck.hasOversized = true;
  if (needsPluma(p.log)) truck.requiresPluma = true;
}

function newPackTruck(center: string, bucket: "pluma" | "estandar"): PackTruck {
  const type = bucket === "pluma" ? TRUCKS.camion_pluma : TRUCKS.camion_rampla;
  return {
    center,
    bucket,
    items: new Map(),
    parcels: [],
    weightKg: 0,
    volumeM3: 0,
    capacityKg: type.capacityKg,
    capacityM3: type.capacityM3,
    hasOversized: false,
    requiresPluma: bucket === "pluma",
  };
}

/** Elige el vehículo más económico que admita el contenido del camión. */
function pickVehicle(truck: PackTruck): VehicleClass {
  if (truck.bucket === "pluma" || truck.requiresPluma) return "camion_pluma";
  // Los sobredimensionados exigen al menos rampla.
  const order: VehicleClass[] = truck.hasOversized
    ? ["camion_rampla"]
    : ["camion_3_4", "camion_simple", "camion_rampla"];
  for (const cls of order) {
    const t = TRUCKS[cls];
    if (truck.weightKg <= t.capacityKg && truck.volumeM3 <= t.capacityM3) return cls;
  }
  return "camion_rampla";
}

// ----------------------------------------------------------------------------
//  Plan de retiro
// ----------------------------------------------------------------------------

export interface PlanOptions {
  /** Forzar un único centro (consolidación). */
  singleCenter?: string;
  /** Forzar una única fecha (esperar a que todo esté disponible). */
  singleDate?: string;
}

export function planPickup(parcels: PickupParcel[], opts: PlanOptions = {}): PickupPlan {
  const effectiveCenter = (p: PickupParcel) => opts.singleCenter ?? p.log.centroRetiro;

  // Agrupar por centro efectivo + bucket de vehículo.
  const packed: PackTruck[] = [];
  const groups = new Map<string, PickupParcel[]>();
  for (const p of parcels) {
    const bucket = needsPluma(p.log) ? "pluma" : "estandar";
    const key = `${effectiveCenter(p)}::${bucket}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  for (const [key, groupParcels] of groups) {
    const [center, bucket] = key.split("::") as [string, "pluma" | "estandar"];
    const trucks: PackTruck[] = [];
    // Carga más voluminosa primero (first-fit decreasing).
    const sorted = [...groupParcels].sort((a, b) => b.totalVolumeM3 - a.totalVolumeM3);
    for (const parcel of sorted) {
      let remaining = parcel.quantity;
      let guard = 0;
      while (remaining > 0 && guard++ < 1000) {
        // Buscar camión compatible con espacio.
        let target: PackTruck | null = null;
        for (const t of trucks) {
          if (t.parcels.every((q) => compatible(q, parcel)) && unitsThatFit(t, parcel) > 0) {
            target = t;
            break;
          }
        }
        if (!target) {
          target = newPackTruck(center, bucket);
          trucks.push(target);
        }
        let fit = unitsThatFit(target, parcel);
        // Ítem más grande que un camión entero: carga 1 unidad igual (sobredim.).
        if (fit === 0 && target.items.size === 0) fit = 1;
        const put = Math.min(remaining, fit);
        if (put <= 0) {
          // No cabe ni compatibiliza: forzar camión nuevo para no ciclar.
          target = newPackTruck(center, bucket);
          trucks.push(target);
          const one = Math.max(1, Math.min(remaining, unitsThatFit(target, parcel)));
          addToTruck(target, parcel, one);
          remaining -= one;
          continue;
        }
        addToTruck(target, parcel, put);
        remaining -= put;
      }
    }
    packed.push(...trucks);
  }

  // Ordenar camiones por centro y armar el resultado con vehículo y ocupación.
  packed.sort((a, b) => a.center.localeCompare(b.center));
  const trucks: TruckLoad[] = packed.map((t, i) => {
    const vehicle = pickVehicle(t);
    const type = TRUCKS[vehicle];
    const weightPct = Math.round((t.weightKg / type.capacityKg) * 100);
    const volumePct = Math.round((t.volumeM3 / type.capacityM3) * 100);
    return {
      id: i + 1,
      center: t.center,
      vehicle,
      vehicleLabel: VEHICLE_LABEL[vehicle],
      items: [...t.items.values()],
      weightKg: Math.round(t.weightKg),
      volumeM3: Math.round(t.volumeM3 * 10) / 10,
      capacityKg: type.capacityKg,
      capacityM3: type.capacityM3,
      weightPct,
      volumePct,
      limitedBy: weightPct >= volumePct ? "peso" : "volumen",
      requiresPluma: t.requiresPluma,
      hasOversized: t.hasOversized,
    };
  });

  const totalWeightKg = Math.round(parcels.reduce((a, p) => a + p.totalWeightKg, 0));
  const totalVolumeM3 = Math.round(parcels.reduce((a, p) => a + p.totalVolumeM3, 0) * 10) / 10;
  const totalUnits = parcels.reduce((a, p) => a + p.quantity, 0);

  const centers = opts.singleCenter
    ? [opts.singleCenter]
    : [...new Set(parcels.map((p) => p.log.centroRetiro))];
  const rawDates = parcels.map((p) => p.log.fechaDisponible).filter(Boolean);
  const dates = opts.singleDate
    ? [opts.singleDate]
    : [...new Set(rawDates)].sort((a, b) => a.localeCompare(b));
  const firstDate = dates[0] ?? null;
  const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;

  const truckCost = trucks.reduce((a, t) => a + TRUCKS[t.vehicle].baseCost, 0);
  const estimatedCost = truckCost + Math.max(0, centers.length - 1) * EXTRA_CENTER_COST;
  const costPerUnit = totalUnits > 0 ? Math.round(estimatedCost / totalUnits) : 0;

  const avgFillPct =
    trucks.length > 0
      ? Math.round(
          trucks.reduce((a, t) => a + Math.max(t.weightPct, t.volumePct), 0) / trucks.length
        )
      : 0;

  const { alerts, suggestions } = buildAdvice(parcels, trucks, {
    centers,
    dates,
    lastDate,
    consolidated: !!opts.singleCenter || !!opts.singleDate,
  });

  return {
    parcels,
    trucks,
    truckCount: trucks.length,
    totalWeightKg,
    totalVolumeM3,
    centers,
    dates,
    firstDate,
    lastDate,
    estimatedCost,
    costPerUnit,
    avgFillPct,
    alerts,
    suggestions,
  };
}

// ----------------------------------------------------------------------------
//  Economía del flete — convierte el plan en decisión de compra
//  ---------------------------------------------------------------------------
//  El flete se cobra por camión completo, lo llenes o no. Entonces la palanca
//  real al comprar es: aprovechar el camión que YA se paga (agregar carga que
//  entra sin sumar flete) y no cruzar el umbral que dispara un camión extra.
// ----------------------------------------------------------------------------

export interface TruckEconomics {
  truckCount: number;
  committedFreight: number; // flete ya comprometido (todos los camiones)
  costPerUnitNow: number; // flete por unidad hoy
  costPerUnitIfFilled: number; // flete por unidad si se llena el camión marginal
  savingPerUnit: number; // cuánto baja el flete/u. al llenar
  // Camión marginal (el último, el que se está llenando):
  lastFillPct: number; // ocupación de la dimensión que limita (0-100+)
  limitedBy: "peso" | "volumen";
  headroomUnits: number; // ~unidades más que caben sin abrir otro camión
  headroomKg: number;
  headroomM3: number;
  nextTruckCost: number; // costo de flete si se abre otro camión
  verdict: {
    tone: "good" | "tip" | "warn";
    label: string;
    message: string;
  };
  bindingHint: string;
}

export function truckEconomics(plan: PickupPlan): TruckEconomics | null {
  const { trucks, totalWeightKg, totalVolumeM3, estimatedCost } = plan;
  if (trucks.length === 0) return null;
  const totalUnits = plan.parcels.reduce((a, p) => a + p.quantity, 0);
  if (totalUnits === 0) return null;

  const last = trucks[trucks.length - 1];
  const avgUnitKg = totalWeightKg / totalUnits;
  const avgUnitM3 = totalVolumeM3 / totalUnits;
  const remKg = Math.max(0, last.capacityKg - last.weightKg);
  const remM3 = Math.max(0, last.capacityM3 - last.volumeM3);
  const byKg = avgUnitKg > 0 ? remKg / avgUnitKg : Infinity;
  const byM3 = avgUnitM3 > 0 ? remM3 / avgUnitM3 : Infinity;
  const headroomUnits = Math.max(0, Math.floor(Math.min(byKg, byM3)));

  const costPerUnitNow = plan.costPerUnit;
  const costPerUnitIfFilled =
    headroomUnits > 0 ? Math.round(estimatedCost / (totalUnits + headroomUnits)) : costPerUnitNow;
  const savingPerUnit = Math.max(0, costPerUnitNow - costPerUnitIfFilled);
  const nextTruckCost = TRUCKS[last.vehicle].baseCost;
  const lastFillPct = Math.max(last.weightPct, last.volumePct);

  const bindingHint =
    last.limitedBy === "peso"
      ? "Te limita el peso: para llenar sin pasarte, suma productos livianos y voluminosos (aislación, tubos, planchas)."
      : "Te limita el volumen: para llenar el camión, suma productos densos y compactos (fierro, cemento, adhesivos).";

  let verdict: TruckEconomics["verdict"];
  if (lastFillPct >= 85) {
    verdict = {
      tone: "good",
      label: "Camión bien aprovechado",
      message:
        "Usas casi toda la capacidad del camión. El flete por unidad es el mejor posible para este envío: no estás pagando viajes a medio llenar.",
    };
  } else if (trucks.length === 1) {
    verdict = {
      tone: "tip",
      label: "Aprovecha el camión que ya pagas",
      message: `El flete de este camión (${formatCLP(estimatedCost)}) ya está comprometido, vaya lleno o no. Caben ~${headroomUnits} u. más sin sumar flete: aprovecha el viaje para adelantar compra y bajar el flete de ${formatCLP(costPerUnitNow)} a ~${formatCLP(costPerUnitIfFilled)} por unidad.`,
    };
  } else {
    verdict = {
      tone: "warn",
      label: `El ${trucks.length}° camión va al ${lastFillPct}%`,
      message: `Ese camión cuesta ${formatCLP(nextTruckCost)} de flete pero va a medio llenar. Conviene decidir: súbele ~${headroomUnits} u. más para aprovecharlo, o baja del pedido lo que sobró para que todo entre en ${trucks.length - 1} camión${trucks.length - 1 === 1 ? "" : "es"} y ahorrar ese flete.`,
    };
  }

  return {
    truckCount: trucks.length,
    committedFreight: estimatedCost,
    costPerUnitNow,
    costPerUnitIfFilled,
    savingPerUnit,
    lastFillPct,
    limitedBy: last.limitedBy,
    headroomUnits,
    headroomKg: Math.round(remKg),
    headroomM3: Math.round(remM3 * 10) / 10,
    nextTruckCost,
    verdict,
    bindingHint,
  };
}

function formatCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

// ----------------------------------------------------------------------------
//  Alertas y recomendaciones
// ----------------------------------------------------------------------------

function buildAdvice(
  parcels: PickupParcel[],
  trucks: TruckLoad[],
  ctx: { centers: string[]; dates: string[]; lastDate: string | null; consolidated: boolean }
): { alerts: LogisticsAlert[]; suggestions: LogisticsSuggestion[] } {
  const alerts: LogisticsAlert[] = [];
  const suggestions: LogisticsSuggestion[] = [];

  // Camión pluma / grúa.
  const plumaItems = parcels.filter((p) => needsPluma(p.log));
  if (plumaItems.length > 0) {
    alerts.push({
      level: "warning",
      text: `La carga requiere camión pluma: ${plumaItems.map((p) => p.productName).join(", ")}.`,
    });
  }

  // Sobredimensionado (sin pluma).
  const oversized = parcels.filter((p) => p.log.sobredimensionado && !needsPluma(p.log));
  if (oversized.length > 0) {
    alerts.push({
      level: "warning",
      text: `Carga sobredimensionada (${oversized
        .map((p) => p.productName)
        .join(", ")}): requiere camión rampla.`,
    });
  }

  // Incompatibilidades entre productos del borrador.
  const incompatPairs: string[] = [];
  for (let i = 0; i < parcels.length; i++) {
    for (let j = i + 1; j < parcels.length; j++) {
      const a = parcels[i];
      const b = parcels[j];
      if (!compatible(a, b)) incompatPairs.push(`${a.productName} y ${b.productName}`);
    }
  }
  if (incompatPairs.length > 0) {
    alerts.push({
      level: "warning",
      text: `No pueden transportarse juntos: ${incompatPairs.join("; ")}.`,
    });
  }

  // Varios centros de retiro.
  if (ctx.centers.length > 1) {
    alerts.push({
      level: "info",
      text: `La mercadería se retira desde ${ctx.centers.length} centros distintos (${ctx.centers.join(", ")}).`,
    });
  }

  // Distintas fechas de disponibilidad.
  if (ctx.dates.length > 1 && ctx.lastDate) {
    alerts.push({
      level: "info",
      text: `No todo estará disponible el mismo día: primeras cargas ${formatDate(
        ctx.dates[0]
      )}, la última el ${formatDate(ctx.lastDate)}.`,
    });
  }

  // Varios viajes.
  if (trucks.length > 1) {
    alerts.push({
      level: "info",
      text: `Esta combinación necesita ${trucks.length} viajes.`,
    });
  }

  // Camión que se llena por volumen antes que por peso.
  const volumeBound = trucks.find((t) => t.volumePct >= 85 && t.weightPct <= 55);
  if (volumeBound) {
    alerts.push({
      level: "info",
      text: `El camión ${volumeBound.id} se llena por volumen (${volumeBound.volumePct}%) mucho antes que por peso (${volumeBound.weightPct}%).`,
    });
  }

  // -- Recomendaciones ------------------------------------------------------
  if (!ctx.consolidated && ctx.dates.length > 1 && ctx.lastDate) {
    suggestions.push({
      text: `Espera hasta el ${formatDate(
        ctx.lastDate
      )} y retira toda la mercadería junta para evitar un segundo viaje.`,
    });
  }

  if (!ctx.consolidated && ctx.centers.length > 1) {
    suggestions.push({
      text: `Consolida el retiro en un solo centro (${ctx.centers[0]}) y evita el costo de una segunda ubicación.`,
    });
  }

  // Último camión con baja ocupación → completar o reducir.
  const last = trucks[trucks.length - 1];
  if (trucks.length >= 1 && last) {
    const fill = Math.max(last.weightPct, last.volumePct);
    if (trucks.length > 1 && fill < 45) {
      const freeKg = Math.max(0, last.capacityKg - last.weightKg);
      const freeM3 = Math.round((last.capacityM3 - last.volumeM3) * 10) / 10;
      suggestions.push({
        text: `El último camión va al ${fill}%: agrega ~${freeKg.toLocaleString(
          "es-CL"
        )} kg / ${freeM3} m³ para aprovecharlo, o reduce esas líneas para ahorrar un viaje.`,
      });
    } else if (trucks.length === 1 && fill >= 80 && fill < 100) {
      suggestions.push({
        text: `El camión va al ${fill}%: cabe algo más si quieres adelantar reposición y bajar el costo por unidad.`,
      });
    }
  }

  return { alerts, suggestions };
}

// ----------------------------------------------------------------------------
//  Comparador de escenarios
// ----------------------------------------------------------------------------

/** El centro con mayor volumen de carga (candidato natural a consolidar). */
function dominantCenter(parcels: PickupParcel[]): string | undefined {
  const byCenter = new Map<string, number>();
  for (const p of parcels) {
    byCenter.set(p.log.centroRetiro, (byCenter.get(p.log.centroRetiro) ?? 0) + p.totalVolumeM3);
  }
  let best: string | undefined;
  let bestVol = -1;
  for (const [c, v] of byCenter) {
    if (v > bestVol) {
      best = c;
      bestVol = v;
    }
  }
  return best;
}

export function comparePickupScenarios(parcels: PickupParcel[]): ScenarioComparison {
  const immediate = planPickup(parcels);
  const center = dominantCenter(parcels);
  const lastDate = immediate.lastDate ?? undefined;
  const consolidated = planPickup(parcels, { singleCenter: center, singleDate: lastDate });
  const worthConsolidating =
    consolidated.estimatedCost < immediate.estimatedCost ||
    consolidated.truckCount < immediate.truckCount ||
    consolidated.centers.length < immediate.centers.length;
  return { immediate, consolidated, worthConsolidating };
}
