import { useMemo, type CSSProperties } from "react";
import { cn } from "../../utils/cn";

// ============================================================================
//  Camión de carga en 3D (CSS puro, sin dependencias).
//  Un camión de furgón isométrico cuya caja de carga es un "contenedor de
//  vidrio" que representa la CAPACIDAD TOTAL del camión. La carga se apila de
//  abajo hacia arriba según el % de ocupación, así el espacio vacío del
//  contenedor se lee como "capacidad disponible". Al subir el %, aparecen más
//  cajas con una transición suave (efecto "se va cargando el camión").
// ============================================================================

// --- Geometría (px, en el espacio del modelo) ---------------------------------
const CW = 22; // ancho de caja (x)
const CD = 24; // profundidad de caja (z)
const CH = 14; // alto de caja (y)
const GX = 4;
const GZ = 5;
const COLS = 4;
const DEPTH = 2;
const LAYERS = 4;
const TOTAL = COLS * DEPTH * LAYERS;

const BED_W = COLS * CW + (COLS + 1) * GX; // 108
const BED_D = DEPTH * CD + (DEPTH + 1) * GZ; // 63
const STACK_H = LAYERS * CH; // 56
const MARGIN = 4;
const BOX_W = BED_W + 2 * MARGIN;
const BOX_D = BED_D + 2 * MARGIN;
const BOX_H = STACK_H + 8; // capacidad total (alto del contenedor)
const DECK_H = 7;
const CAB_W = 30;
const CAB_H = 36;
const WHEEL_W = 11;
const WHEEL_H = 14;
const WHEEL_D = 8;

type FaceKey = "top" | "bottom" | "front" | "back" | "left" | "right";
type Faces = Partial<Record<FaceKey, string>>;

/** Un cuboide en el espacio 3D con las caras y el borde que se le indiquen. */
function Box3D({
  w,
  h,
  d,
  x = 0,
  y = 0,
  z = 0,
  faces,
  radius = 0,
  edge,
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
  edge?: string;
  style?: CSSProperties;
}) {
  const shadow = edge ? `inset 0 0 0 1px ${edge}` : "inset 0 0 0 0.5px rgba(15,23,42,0.12)";
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
    boxShadow: shadow,
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

// Paletas de caras (luz consistente: arriba clara, lados oscuros).
const CAB: Faces = {
  top: "#4471e4",
  front: "linear-gradient(180deg,#0f172a 0 42%,#2551d4 42% 100%)",
  right: "#1f43b8",
  left: "#2551d4",
};
const WHEEL: Faces = { top: "#374151", front: "#111827", right: "#0b0f1a", left: "#111827" };
const CRATE: Faces = { top: "#e7c281", front: "#d0a05e", right: "#b9884c", left: "#c99a58" };

interface Crate {
  key: string;
  x: number;
  y: number;
  z: number;
  order: number;
}

const CRATES: Crate[] = (() => {
  const list: Crate[] = [];
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let dz = 0; dz < DEPTH; dz++) {
      for (let cx = 0; cx < COLS; cx++) {
        list.push({
          key: `${layer}-${dz}-${cx}`,
          x: -BED_W / 2 + GX + CW / 2 + cx * (CW + GX),
          z: -BED_D / 2 + GZ + CD / 2 + dz * (CD + GZ),
          y: -(CH / 2 + layer * CH),
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
  return "#0ea5e9";
}

/**
 * Camión de carga 3D. `fillPct` (0–100+) define cuánta de la capacidad del
 * contenedor se llena de cajas. El contenedor de vidrio muestra el total, así
 * el espacio vacío = capacidad disponible.
 */
export function TruckLoad3D({
  fillPct,
  caption,
  className,
  height = 190,
}: {
  fillPct: number;
  caption?: string;
  className?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.round(fillPct));
  const revealed = useMemo(() => Math.round((Math.min(100, pct) / 100) * TOTAL), [pct]);
  const accent = accentFor(pct);

  const wheelZ = BED_D / 2 + WHEEL_D / 2 + 1;
  const chassisW = BOX_W + CAB_W + 12;
  const chassisX = (CAB_W + 4) / 2;
  const wheelXs = [-BED_W / 2 + 12, BED_W / 2 - 10, BED_W / 2 + CAB_W - 6];

  // Contenedor de vidrio = capacidad total (paredes translúcidas con borde).
  const glassWall = "rgba(148,163,184,0.14)";
  const glassTop = "rgba(226,232,240,0.20)";
  const glassEdge = "rgba(71,85,105,0.55)";
  const boxCenterY = -BOX_H / 2;

  return (
    <div className={cn("select-none", className)}>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100"
        style={{ height, perspective: 920 }}
      >
        {/* Etiqueta: qué es */}
        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <TruckGlyph className="h-3.5 w-3.5 text-slate-400" />
          Capacidad del camión
        </div>

        {/* Sombra de piso */}
        <div
          className="absolute left-1/2 top-1/2 rounded-[50%]"
          style={{
            width: BOX_W + CAB_W + 46,
            height: 34,
            transform: "translate(-50%, 52px)",
            background: "radial-gradient(closest-side, rgba(15,23,42,0.26), rgba(15,23,42,0))",
            filter: "blur(2px)",
          }}
        />

        {/* Mundo 3D */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transformStyle: "preserve-3d",
            transform: "translate(-50%,-46%) rotateX(-20deg) rotateY(-34deg)",
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
            d={BED_D - 2}
            x={chassisX}
            y={DECK_H + 4}
            z={0}
            faces={{ top: "#1f2937", front: "#111827", right: "#0b1220", left: "#111827" }}
          />

          {/* Piso del furgón */}
          <Box3D w={BOX_W} h={DECK_H} d={BOX_D} x={0} y={DECK_H / 2} z={0}
            faces={{ top: "#334155", front: "#1e293b", right: "#172033", left: "#1e293b" }} radius={1} />

          {/* Cajas (se apilan según ocupación) */}
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
                faces={CRATE}
                style={{
                  transition: "opacity .35s ease, transform .35s ease",
                  transitionDelay: `${(c.order % (COLS * DEPTH)) * 22}ms`,
                  opacity: show ? 1 : 0,
                  transform: `translate3d(${c.x}px, ${show ? c.y : c.y - 22}px, ${c.z}px)`,
                }}
              />
            );
          })}

          {/* Contenedor de vidrio = capacidad total (se renderiza al final) */}
          <Box3D
            w={BOX_W}
            h={BOX_H}
            d={BOX_D}
            x={0}
            y={boxCenterY}
            z={0}
            radius={2}
            edge={glassEdge}
            faces={{ top: glassTop, front: glassWall, back: glassWall, left: glassWall, right: glassWall }}
          />

          {/* Cabina */}
          <Box3D
            w={CAB_W}
            h={CAB_H}
            d={BED_D}
            x={BOX_W / 2 + CAB_W / 2 + 2}
            y={-CAB_H / 2 + DECK_H}
            z={0}
            faces={CAB}
            radius={4}
          />
        </div>

        {/* Insignia de ocupación */}
        <div className="absolute right-2.5 top-2.5 z-10 flex items-baseline gap-1 rounded-lg bg-white/90 px-2.5 py-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
          <span className="text-lg font-bold leading-none tabular-nums" style={{ color: accent }}>
            {pct}%
          </span>
          <span className="text-[10px] font-medium text-slate-400">lleno</span>
        </div>
      </div>
      {caption && <p className="mt-1.5 text-center text-[11px] text-slate-500">{caption}</p>}
    </div>
  );
}

function TruckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h11v9H3z" />
      <path d="M14 9h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}
