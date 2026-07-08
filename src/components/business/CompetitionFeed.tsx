import { getBuyer } from "../../data/mockBuyers";
import { BUYER_TONE_AV } from "./BuyerDetailDrawer";
import type { FeedItem, FeedKind } from "../../data/mockCompetitionFeed";

const KIND_CFG: Record<FeedKind, { icon: string; bg: string; fg: string }> = {
  league_up: { icon: "▲", bg: "bg-emerald-50", fg: "text-emerald-700" },
  league_down: { icon: "▼", bg: "bg-rose-50", fg: "text-rose-700" },
  rank_up: { icon: "▲", bg: "bg-emerald-50", fg: "text-emerald-700" },
  rank_down: { icon: "▼", bg: "bg-rose-50", fg: "text-rose-700" },
  overtaken: { icon: "⇄", bg: "bg-amber-50", fg: "text-amber-700" },
  badge: { icon: "🏅", bg: "bg-amber-50", fg: "text-amber-700" },
  duel_win: { icon: "⚔", bg: "bg-brand-50", fg: "text-brand-700" },
  streak: { icon: "🔥", bg: "bg-emerald-50", fg: "text-emerald-700" },
};

export function CompetitionFeed({ items, meId }: { items: FeedItem[]; meId?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">Sin novedades por ahora.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const b = getBuyer(it.buyerId);
        const cfg = KIND_CFG[it.kind];
        const isMe = it.buyerId === meId;
        return (
          <div
            key={it.id}
            className={`flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 ${isMe ? "bg-brand-50/50" : ""}`}
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${b ? BUYER_TONE_AV[b.tone] : "bg-slate-100 text-slate-500"}`}
            >
              {b?.initials ?? "—"}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-slate-700 leading-snug">
                <b className="font-semibold text-slate-800">{isMe ? "Tú" : b?.name}</b> {it.text}
              </span>
            </span>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 ${cfg.bg} ${cfg.fg}`}
            >
              {cfg.icon}
            </span>
            <span className="text-[11px] text-slate-400 flex-shrink-0 w-12 text-right">
              {it.time}
            </span>
          </div>
        );
      })}
    </div>
  );
}
