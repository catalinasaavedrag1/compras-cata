// ============================================================================
//  Novedades de competencia: movimientos de ranking, ligas, duelos e insignias.
// ============================================================================

export type FeedKind =
  | "league_up"
  | "league_down"
  | "rank_up"
  | "rank_down"
  | "overtaken"
  | "badge"
  | "duel_win"
  | "streak";

export interface FeedItem {
  id: string;
  buyerId: string;
  kind: FeedKind;
  text: string;
  time: string;
}

export const competitionFeed: FeedItem[] = [
  {
    id: "f1",
    buyerId: "andrea",
    kind: "league_up",
    text: "Ascendió a Elite y tomó el #1 del equipo",
    time: "Hoy",
  },
  {
    id: "f2",
    buyerId: "catalina",
    kind: "duel_win",
    text: "Va ganando el duelo de rotación vs Felipe",
    time: "Hoy",
  },
  { id: "f3", buyerId: "maria", kind: "league_up", text: "Ascendió a Elite este mes", time: "Hoy" },
  {
    id: "f4",
    buyerId: "catalina",
    kind: "overtaken",
    text: "María la superó en margen bruto",
    time: "Ayer",
  },
  {
    id: "f5",
    buyerId: "juan",
    kind: "league_down",
    text: "Bajó a Plata por aumento de quiebres",
    time: "Ayer",
  },
  {
    id: "f6",
    buyerId: "andrea",
    kind: "badge",
    text: "Ganó la insignia «Mejor Fill Rate»",
    time: "Ayer",
  },
  {
    id: "f7",
    buyerId: "felipe",
    kind: "rank_down",
    text: "Cayó al #5: 5 semanas a la baja",
    time: "2 días",
  },
  {
    id: "f8",
    buyerId: "catalina",
    kind: "streak",
    text: "Racha de 2 semanas cumpliendo OC",
    time: "2 días",
  },
];
