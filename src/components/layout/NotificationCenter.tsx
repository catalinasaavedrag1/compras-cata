import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, type NotifTone } from "../../context/NotificationContext";
import { IconBell } from "../ui/icons";
import { formatDate } from "../../utils/formatters";
import { cn } from "../../utils/cn";

const toneBar: Record<NotifTone, string> = {
  info: "bg-brand-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openItem = (id: string, route: string) => {
    markRead(id);
    setOpen(false);
    navigate(route);
  };

  return (
    <div
      className="relative"
      onBlur={() => {
        blurTimer.current = setTimeout(() => setOpen(false), 120);
      }}
      onFocus={() => {
        if (blurTimer.current) clearTimeout(blurTimer.current);
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <IconBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">
              Notificaciones {unreadCount > 0 && <span className="text-slate-400 font-normal">({unreadCount} sin leer)</span>}
            </p>
            {unreadCount > 0 && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={markAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 text-center">
                No tienes notificaciones. Todo en orden.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openItem(n.id, n.route)}
                  className={cn(
                    "relative flex w-full items-start gap-2.5 px-4 py-2.5 text-left border-b border-slate-50 hover:bg-slate-50",
                    !n.read && "bg-brand-50/30"
                  )}
                >
                  <span className={cn("absolute left-0 top-0 bottom-0 w-1", toneBar[n.tone])} />
                  <span className="min-w-0 flex-1 pl-1">
                    <span className="flex items-center gap-2">
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-slate-800 truncate">{n.title}</span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{n.message}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">{formatDate(n.date)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
