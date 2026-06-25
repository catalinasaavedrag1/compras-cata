import { useToast, type ToastTone } from "../../context/ToastContext";
import { IconCheck, IconInfo, IconAlerts, IconClose } from "./icons";
import { cn } from "../../utils/cn";

const toneStyles: Record<ToastTone, { bar: string; icon: JSX.Element }> = {
  success: { bar: "bg-emerald-500", icon: <IconCheck className="w-4 h-4 text-emerald-600" /> },
  info: { bar: "bg-brand-500", icon: <IconInfo className="w-4 h-4 text-brand-600" /> },
  warning: { bar: "bg-amber-500", icon: <IconAlerts className="w-4 h-4 text-amber-600" /> },
  error: { bar: "bg-rose-500", icon: <IconAlerts className="w-4 h-4 text-rose-600" /> },
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="relative flex items-start gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg animate-[slideIn_0.18s_ease-out]"
          role="status"
        >
          <span className={cn("absolute left-0 top-0 bottom-0 w-1", toneStyles[t.tone].bar)} />
          <span className="mt-0.5 flex-shrink-0 pl-1">{toneStyles[t.tone].icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 leading-snug">{t.message}</p>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                {t.action.label} →
              </button>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
            aria-label="Cerrar notificación"
          >
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
