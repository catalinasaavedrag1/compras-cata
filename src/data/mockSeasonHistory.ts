// ============================================================================
//  Historial de temporadas cerradas: campeón y podio de cada mes.
// ============================================================================

export interface PastSeason {
  id: string;
  name: string;
  championId: string;
  championScore: number;
  podium: string[]; // ids top 3, en orden
}

export const seasonHistory: PastSeason[] = [
  {
    id: "may",
    name: "Mayo 2026",
    championId: "andrea",
    championScore: 88,
    podium: ["andrea", "catalina", "juan"],
  },
  {
    id: "apr",
    name: "Abril 2026",
    championId: "catalina",
    championScore: 90,
    podium: ["catalina", "andrea", "juan"],
  },
  {
    id: "mar",
    name: "Marzo 2026",
    championId: "juan",
    championScore: 85,
    podium: ["juan", "andrea", "maria"],
  },
];
