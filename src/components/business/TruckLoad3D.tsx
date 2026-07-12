import { useMemo, type CSSProperties } from "react";
import { cn } from "../../utils/cn";

// ============================================================================
//  Camión de carga en 3D (CSS puro, sin dependencias).
//  Muestra un camión isométrico cuyo compartimento se va llenando de cajas a
//  medida que crece el % de ocupación. Se usa en el borrador de OC (se recalcula
//  al agregar productos) y en el detalle por camión del plan de retiro.
//  Todo el 3D es con transform-style: preserve-3d + transforms; las cajas
//  aparecen con una transición suave (efecto "se va cargando el camión").
// ============================================================================

// --- Geometría (px, en el espacio del modelo) ---------------------------------
const CW = 24; // ancho de caja (x)
const CD = 26; // profundidad de caja (z)
const CH = 18; // alto de caja (y)
const GX = 4; // separación en x
const GZ = 6; // separación en z
const COLS = 4; // cajas a lo largo
const DEPTH = 2; // cajas a lo ancho
const LAYERS = 3; // pisos
const TOTAL = COLS * DEPTH * LAYERS;

const BED_W = COLS * CW + (COLS + 1) * GX; // largo de la plataforma (x)
const BED_D = DEPTH * CD + (DEPTH + 1) * GZ; // ancho de la plataforma (z)
const DECK_H = 8;
const RAIL_H = 13;
const RAIL_T = 5;
const CAB_W = 34;
const CAB_H = 42;
const WHEEL_W = 11;
const WHEEL_H = 15;
const WHEEL_D = 8;

type FaceKey = "top" | "bottom" | "front" | "back" | "left" | "right";
type Faces = Partial<Record<FaceKey, string>>;

/** Un cuboide en el espacio 3D con las caras que se le indiquen. */
function Box3D({
  w,
  h,
  d,
  x = 0,
  y = 0,
  z = 0,
  faces,
  radius = 0,
  style,
}: {
  w: number;
  h: number;
  d: number;
  x?: number;
  y?: number;
  z?: number;
  faces: Faces;
  radius?: number;
  style?: CSSProperties;
}) {
  const faceStyle = (fw: number, fh: number, transform: string, bg: string): CSSProperties => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: fw,
    height: fh,
    background: bg,
    borderRadius: radius,
    transform: `translate(-50%,-50%) ${transform}`,
    backfaceVisibility: "hidden",
    boxShadow: "inset 0 0 0 0.5px rgba(15,23,42,0.12)",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
        ...style,
      }}
    >
      {faces.top && <div style={faceStyle(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, faces.top)} />}
      {faces.bottom && (
        <div style={faceStyle(w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, faces.bottom)} />
      )}
      {faces.front && <div style={faceStyle(w, h, `translateZ(${d / 2}px)`, faces.front)} />}
      {faces.back && (
        <div style={faceStyle(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, faces.back)} />
      )}
      {faces.right && (
        <div style={faceStyle(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, faces.right)} />
      )}
      {faces.left && (
        <div style={faceStyle(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, faces.left)} />
      )}
    </div>
  );
}

// Paletas de caras (dirección de luz consistente: arriba clara, lados oscuros).
const DECK: Faces = { top: "#3f4b60", front: "#2b3547", right: "#232c3c", left: "#2b3547" };
const RAIL: Faces = { top: "#55627a", front: "#3a4559", right: "#313b4d", left: "#3a4559" };
const CAB: Faces = {
  top: "#3f6be0",
  front: "linear-gradient(180deg,#0f172a 0 46%,#254fd0 46% 100%)",
  right: "#1f43b8",
  left: "#254fd0",
};
const WHEEL: Faces = { top: "#374151", front: "#111827", right: "#0b0f1a", left: "#111827", back: "#111827" };

function crateFaces(): Faces {
  return { top: "#e3bd7d", front: "#cc9c5b", right: "#b6864b", left: "#c2925470" };
}

interface Crate {
  key: string;
  x: number;
  y: number;
  z: number;
  order: number; // orden de llenado (piso por piso, de abajo hacia arriba)
}

const CRATES: Crate[] = (() => {
  const list: Crate[] = [];
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let dz = 0; dz < DEPTH; dz++) {
      for (let cx = 0; cx < COLS; cx++) {
        const x = -BED_W / 2 + GX + CW / 2 + cx * (CW + GX);
        const z = -BED_D / 2 + GZ + CD / 2 + dz * (CD + GZ);
        const y = -(CH / 2 + layer * CH); // -y = hacia arriba
        list.push({
          key: `${layer}-${dz}-${cx}`,
          x,
          y,
          z,
          order: layer * (COLS * DEPTH) + dz * COLS + cx,
        });
      }
    }
  }
  return list;
})();

function accentFor(pct: number): string {
  if (pct > 100) return "#e11d48";
  if (pct >= 85) return "#d97706";
  return "#059669";
}

/**
 * Camión de carga 3D. `fillPct` (0–100+) define cuántas cajas se muestran.
 * Al aumentar, las cajas nuevas aparecen con una transición (se va cargando).
 */
export function TruckLoad3D({
  fillPct,
  caption,
  className,
  height = 168,
}: {
  fillPct: number;
  caption?: string;
  className?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.round(fillPct));
  const revealed = useMemo(() => Math.round((Math.min(100, pct) / 100) * TOTAL), [pct]);
  const accent = accentFor(pct);
  const crateColors = crateFaces();

  // Chasis: viga bajo la plataforma y la cabina.
  const chassisW = BED_W + CAB_W + 14;
  const chassisX = (CAB_W + 6) / 2;
  const wheelZ = BED_D / 2 + WHEEL_D / 2 - 1;
  const wheelXs = [-BED_W / 2 + 14, BED_W / 2 - 12, BED_W / 2 + CAB_W - 8];

  return (
    <div className={cn("select-none", className)}>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100"
        style={{ height, perspective: 900 }}
      >
        {/* Sombra de piso */}
        <div
          className="absolute left-1/2 top-1/2 rounded-[50%]"
          style={{
            width: BED_W + CAB_W + 40,
            height: 34,
            transform: "translate(-50%, 46px)",
            background: "radial-gradient(closest-side, rgba(15,23,42,0.28), rgba(15,23,42,0))",
            filter: "blur(2px)",
          }}
        />

        {/* Mundo 3D */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transformStyle: "preserve-3d",
            transform: "translate(-50%,-50%) rotateX(-22deg) rotateY(-36deg)",
          }}
        >
          {/* Ruedas */}
          {wheelXs.map((wx) =>
            [-wheelZ, wheelZ].map((wz) => (
              <Box3D
                key={`w${wx}-${wz}`}
                w={WHEEL_W}
                h={WHEEL_H}
                d={WHEEL_D}
                x={wx}
                y={DECK_H + WHEEL_H / 2 - 1}
                z={wz}
                faces={WHEEL}
                radius={3}
              />
            ))
          )}

          {/* Chasis */}
          <Box3D
            w={chassisW}
            h={6}
            d={BED_D - 4}
            x={chassisX}
            y={DECK_H + 4}
            z={0}
            faces={{ top: "#1f2937", front: "#111827", right: "#0b1220", left: "#111827" }}
          />

          {/* Plataforma */}
          <Box3D w={BED_W} h={DECK_H} d={BED_D} x={0} y={DECK_H / 2} z={0} faces={DECK} radius={1} />

          {/* Barandas (3 lados, bajas para que se vean las cajas) */}
          <Box3D w={RAIL_T} h={RAIL_H} d={BED_D} x={-BED_W / 2 + RAIL_T / 2} y={-RAIL_H / 2} z={0} faces={RAIL} />
          <Box3D w={BED_W} h={RAIL_H} d={RAIL_T} x={0} y={-RAIL_H / 2} z={-BED_D / 2 + RAIL_T / 2} faces={RAIL} />
          <Box3D w={BED_W} h={RAIL_H} d={RAIL_T} x={0} y={-RAIL_H / 2} z={BED_D / 2 - RAIL_T / 2} faces={RAIL} />

          {/* Cabina */}
          <Box3D
            w={CAB_W}
            h={CAB_H}
            d={BED_D + 2}
            x={BED_W / 2 + CAB_W / 2 + 3}
            y={-CAB_H / 2 + DECK_H}
            z={0}
            faces={CAB}
            radius={4}
          />

          {/* Cajas (se revelan según el % de ocupación) */}
          {CRATES.map((c) => {
            const show = c.order < revealed;
            return (
              <Box3D
                key={c.key}
                w={CW}
                h={CH}
                d={CD}
                x={c.x}
                y={c.y}
                z={c.z}
                radius={2}
                faces={crateColors}
                style={{
                  transition: "opacity .35s ease, transform .35s ease",
                  transitionDelay: `${(c.order % (COLS * DEPTH)) * 25}ms`,
                  opacity: show ? 1 : 0,
                  transform: `translate3d(${c.x}px, ${show ? c.y : c.y - 26}px, ${c.z}px)`,
                }}
              />
            );
          })}
        </div>

        {/* Indicador de ocupación */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 shadow-sm backdrop-blur">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
            {pct}%
          </span>
        </div>
      </div>
      {caption && <p className="mt-1.5 text-center text-[11px] text-slate-500">{caption}</p>}
    </div>
  );
}
