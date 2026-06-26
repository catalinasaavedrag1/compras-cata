import { useDataSource } from "../../context/DataContext";
import { backendEnabled, apiBase } from "../../services/apiClient";

// Indicador del origen de datos: API conectada (backend) o modo demo (mock).
export function BackendStatus() {
  const { source } = useDataSource();
  const connected = source === "backend";
  const loading = source === "loading";

  const tone = connected
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : loading
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-100 text-slate-500 ring-slate-200";
  const dot = connected ? "bg-emerald-500" : loading ? "bg-amber-500" : "bg-slate-400";
  const label = connected ? "API conectada" : loading ? "Conectando…" : "Modo demo";
  const title = backendEnabled
    ? `Backend: ${apiBase}`
    : "Sin backend configurado (VITE_API_URL). Datos mock locales.";

  return (
    <span
      title={title}
      className={`hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tone}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
