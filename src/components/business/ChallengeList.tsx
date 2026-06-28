import { Card, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { getBuyer } from "../../data/mockBuyers";
import { BUYER_TONE_AV } from "./BuyerDetailDrawer";
import { daysToClose } from "../../utils/teamScore";
import type { Challenge } from "../../data/mockChallenges";

function Avatar({ id, size = "w-9 h-9" }: { id: string; size?: string }) {
  const b = getBuyer(id);
  if (!b) return null;
  return <span className={`${size} rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>;
}

export function ChallengeList({ items, meId }: { items: Challenge[]; meId?: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      {items.map((c) => {
        const ends = `Cierra en ${daysToClose(c.ends)} d`;
        if (c.kind === "team") {
          return (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                  <Badge tone="violet">Equipo</Badge>
                </div>
                <p className="text-xs text-slate-500 mb-3">{c.description}</p>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${c.progress}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs font-semibold text-slate-700">{c.progress}% · {c.targetText}</span>
                  <span className="text-[11px] text-slate-500">{ends}</span>
                </div>
              </CardBody>
            </Card>
          );
        }
        if (c.kind === "duel") {
          const aMe = c.aId === meId, bMe = c.bId === meId;
          const aWin = c.leaderId === c.aId;
          const a = getBuyer(c.aId), b = getBuyer(c.bId);
          return (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                  <Badge tone="amber">Duelo</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex-1 flex items-center gap-2.5 rounded-lg px-3 py-2 ${aWin ? "bg-emerald-50" : "bg-slate-50"}`}>
                    <Avatar id={c.aId} size="w-8 h-8" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{aMe ? "Tú" : a?.name}</p>
                      <p className="text-sm font-bold" style={{ color: aWin ? "#059669" : "#64748b" }}>{c.aText}</p>
                    </div>
                    {aWin && <span className="ml-auto text-[10px] font-bold text-emerald-600">LIDERA</span>}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 flex-shrink-0">VS</span>
                  <div className={`flex-1 flex items-center gap-2.5 rounded-lg px-3 py-2 ${!aWin ? "bg-emerald-50" : "bg-slate-50"}`}>
                    <Avatar id={c.bId} size="w-8 h-8" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{bMe ? "Tú" : b?.name}</p>
                      <p className="text-sm font-bold" style={{ color: !aWin ? "#059669" : "#64748b" }}>{c.bText}</p>
                    </div>
                    {!aWin && <span className="ml-auto text-[10px] font-bold text-emerald-600">LIDERA</span>}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 text-right">{c.metric} · {ends}</p>
              </CardBody>
            </Card>
          );
        }
        // streak
        const me = c.buyerId === meId;
        const b = getBuyer(c.buyerId);
        return (
          <Card key={c.id}>
            <CardBody>
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                <Badge tone="green">Racha</Badge>
              </div>
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar id={c.buyerId} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{me ? "Tú" : b?.name}</p>
                  <p className="text-xs text-slate-500">{c.reward}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: c.goalWeeks }).map((_, i) => (
                  <span key={i} className={`flex-1 h-2 rounded-full ${i < c.weeks ? "bg-emerald-500" : "bg-slate-100"}`} />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs font-semibold text-slate-700">{c.weeks}/{c.goalWeeks} semanas</span>
                <span className="text-[11px] text-slate-500">{ends}</span>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
