import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { BuyerDetailDrawer, BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";
import type { Buyer } from "../types/team";
import { scoreColor, scoreLabel, trendText, trendColor } from "../utils/teamScore";
import { IconInfo } from "../components/ui/icons";

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingPage() {
  const [sel, setSel] = useState<Buyer | null>(null);
  const sorted = [...buyers].sort((a, b) => b.score - a.score);

  return (
    <div>
      <PageHeader
        title="Ranking del equipo"
        description="Posición según el score global (0–100). Cada fila muestra qué lo sube y qué lo frena."
      />

      <div className="flex items-start gap-2 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mb-4">
        <IconInfo className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-brand-900 leading-snug">
          El <b className="font-semibold">score</b> combina nivel de servicio, fill rate, control de quiebres, días de inventario, exactitud del sugerido y cumplimiento de tareas — ponderados. Sube quien atiende mejor su surtido y cumple sus metas.
        </span>
      </div>

      <div className="space-y-2.5">
        {sorted.map((b, i) => {
          const sb = [...b.breakdown].sort((p, q) => q.value - p.value);
          const strong = sb[0];
          const weak = sb[sb.length - 1];
          const gap = i > 0 ? sorted[i - 1].score - b.score : 0;
          return (
            <button
              key={b.id}
              onClick={() => setSel(b)}
              className="flex items-center gap-4 w-full text-left bg-white border border-slate-200 rounded-xl shadow-card px-4 py-3.5 transition-colors hover:border-brand-300"
              style={i === 0 ? { background: "#fffdf5" } : undefined}
            >
              <span className="w-8 text-center text-lg font-bold text-slate-700 flex-shrink-0">{i < 3 ? MEDALS[i] : i + 1}</span>
              <span className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2.5">
                  <span className="text-[15px] font-semibold text-slate-800">{b.name}</span>
                  <span className="text-[11px] font-semibold" style={{ color: trendColor(b.trend) }}>{trendText(b.trend)}</span>
                </span>
                <span className="flex flex-wrap gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700">▲ {strong.label} {strong.value}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-rose-50 text-rose-700">▼ {weak.label} {weak.value}</span>
                  <span className="text-[11px] text-slate-400 self-center">{i === 0 ? "Líder del equipo" : `A ${gap} pts del #${i}`}</span>
                </span>
              </span>
              <span className="text-right w-24 flex-shrink-0">
                <span className="block text-2xl font-bold leading-none" style={{ color: scoreColor(b.score) }}>{b.score}</span>
                <span className="block text-[10.5px] font-semibold mt-0.5" style={{ color: scoreColor(b.score) }}>{scoreLabel(b.score)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <BuyerDetailDrawer buyer={sel} onClose={() => setSel(null)} />
    </div>
  );
}
