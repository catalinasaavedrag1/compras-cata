import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { BuyerDetailDrawer, BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";
import type { Buyer } from "../types/team";
import { scoreColor, trendText, trendColor, WORKLOAD_CFG, leagueOf } from "../utils/teamScore";

export function BuyersPage() {
  const [sel, setSel] = useState<Buyer | null>(null);
  const list = [...buyers].sort((a, b) => b.score - a.score);

  return (
    <div>
      <PageHeader
        title="Compradores"
        description="Ficha ejecutiva de cada comprador. Haz clic para ver su detalle, KPIs, metas y evolución."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {list.map((b) => {
          const wl = WORKLOAD_CFG[b.workload];
          return (
            <button
              key={b.id}
              onClick={() => setSel(b)}
              className="text-left bg-white border border-slate-200 rounded-xl shadow-card p-4 flex flex-col gap-3 transition-colors hover:border-brand-300"
            >
              <div className="flex items-center gap-3">
                <span className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-slate-800">{b.name}</p>
                  <p className="text-xs text-slate-400 truncate">{b.categories.join(" · ")}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold leading-none" style={{ color: scoreColor(b.score) }}>{b.score}</p>
                  <p className="text-[11px] font-semibold" style={{ color: trendColor(b.trend) }}>{trendText(b.trend)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={leagueOf(b.score).league.tone}>Nivel {leagueOf(b.score).league.name}</Badge>
                <Badge tone={wl.tone}>Carga {wl.label}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                <div><p className="text-base font-semibold text-slate-800">{b.fillRate}%</p><p className="text-[10.5px] text-slate-400">Fill Rate</p></div>
                <div><p className="text-base font-semibold text-rose-700">{b.stockouts}</p><p className="text-[10.5px] text-slate-400">Quiebres</p></div>
                <div><p className="text-base font-semibold text-amber-700">{b.pending}</p><p className="text-[10.5px] text-slate-400">Pendientes</p></div>
                <div><p className="text-base font-semibold text-rose-600">{b.alerts}</p><p className="text-[10.5px] text-slate-400">Alertas</p></div>
              </div>
            </button>
          );
        })}
      </div>

      <BuyerDetailDrawer buyer={sel} onClose={() => setSel(null)} />
    </div>
  );
}
