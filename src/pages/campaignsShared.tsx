// Icono SVG inline compartido entre la vista de planificación y la de
// rendimiento de campañas (el tono de canal vive en utils/tone → CHANNEL_BG).

/** Icono SVG inline (recibe el `path` de PERF_CHANNEL_META o de una acción). */
export function Svg({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
