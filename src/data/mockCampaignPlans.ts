// ============================================================================
//  Planes de campaña editables: cada evento tiene presupuesto por canal y
//  productos en descuento asignados a un espacio publicitario.
// ============================================================================

export type PromoChannelKey = "redes" | "ml" | "web" | "tienda";
export type PlacementKey = "reel" | "banner" | "gondola" | "vitrina" | "destacado" | "email";
export type CampaignProductStatus = "ready" | "pending" | "stock_risk";

export interface CampaignProduct {
  name: string;
  sku: string;
  category: string;
  normal: number;
  promo: number;
  from: string;
  to: string;
  channel: PromoChannelKey;
  placement: PlacementKey;
  placementLabel: string;
  budget: number;
  estSale: number;
  status: CampaignProductStatus;
  isNew?: boolean;
}

export interface CampaignPlan {
  id: string;
  name: string;
  from: string;
  to: string;
  totalBudget: number;
  channelBudget: Record<PromoChannelKey, number>;
  products: CampaignProduct[];
}

export const CHANNEL_META: Record<
  PromoChannelKey,
  { label: string; tone: "violet" | "amber" | "blue" | "green"; icon: string }
> = {
  redes: { label: "Redes Sociales", tone: "violet", icon: "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" },
  ml: { label: "Mercado Libre", tone: "amber", icon: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8zM7 7h.01" },
  web: { label: "Web / Banner", tone: "blue", icon: "M3 3h18v18H3zM3 9h18M9 21V9" },
  tienda: { label: "Tienda física", tone: "green", icon: "M3 9l1-5h16l1 5M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M3 9h18M9 21v-6h6v6" },
};

export const PLACEMENT_ICON: Record<PlacementKey, string> = {
  reel: "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
  banner: "M3 3h18v18H3zM3 9h18M9 21V9",
  gondola: "M3 9l1-5h16l1 5M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M3 9h18",
  vitrina: "M3 9l1-5h16l1 5M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M3 9h18",
  destacado: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8zM7 7h.01",
  email: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
};

export const PLACEMENT_LABELS: Record<PlacementKey, string> = {
  reel: "Reel Instagram/TikTok",
  banner: "Banner home web",
  gondola: "Cabecera de góndola",
  vitrina: "Vitrina tienda",
  destacado: "Listado destacado ML",
  email: "Email & newsletter",
};

export interface SpaceType {
  placement: PlacementKey;
  label: string;
  channel: PromoChannelKey;
  position: string;
  size: string;
  total: number;
}

export const SPACE_TYPES: SpaceType[] = [
  { placement: "banner", label: "Banner Home Web", channel: "web", position: "Home — sobre el fold", size: "1080 × 300 px", total: 3 },
  { placement: "destacado", label: "Listado destacado", channel: "ml", position: "Tope de búsqueda ML", size: "Ficha + tag oferta", total: 8 },
  { placement: "reel", label: "Reel Redes", channel: "redes", position: "Feed + Stories", size: "Video vertical 9:16", total: 6 },
  { placement: "gondola", label: "Cabecera de góndola", channel: "tienda", position: "Pasillo central", size: "Físico — cabecera", total: 4 },
  { placement: "vitrina", label: "Vitrina tienda", channel: "tienda", position: "Entrada de tienda", size: "Físico — vitrina", total: 2 },
  { placement: "email", label: "Email & newsletter", channel: "web", position: "Boletín semanal", size: "Bloque destacado", total: 4 },
];

export const CAMPAIGN_PLANS: CampaignPlan[] = [
  {
    id: "cyber",
    name: "Cyber Junio",
    from: "2026-06-24",
    to: "2026-06-27",
    totalBudget: 8000000,
    channelBudget: { redes: 3200000, ml: 2400000, web: 1600000, tienda: 800000 },
    products: [
      { name: 'Esmeril angular Bosch 4.5" 820W', sku: "HER-004", category: "Herramientas eléctricas", normal: 44990, promo: 33740, from: "2026-06-24", to: "2026-06-27", channel: "redes", placement: "reel", placementLabel: "Reel Instagram + TikTok", budget: 900000, estSale: 4200000, status: "ready" },
      { name: 'Sierra circular Makita 7-1/4"', sku: "HER-005", category: "Herramientas eléctricas", normal: 89990, promo: 71990, from: "2026-06-24", to: "2026-06-27", channel: "ml", placement: "destacado", placementLabel: "Listado destacado ML", budget: 780000, estSale: 3100000, status: "ready" },
      { name: 'Disco corte metal 4 1/2" (pack 10)', sku: "HER-003", category: "Herramientas eléctricas", normal: 12990, promo: 9740, from: "2026-06-25", to: "2026-06-27", channel: "web", placement: "banner", placementLabel: "Banner home web", budget: 520000, estSale: 2200000, status: "pending" },
      { name: "Cable THHN 2,5 mm rollo 100 m", sku: "ELE-001", category: "Electricidad", normal: 42990, promo: 35990, from: "2026-06-24", to: "2026-06-27", channel: "ml", placement: "destacado", placementLabel: "Listado destacado ML", budget: 480000, estSale: 1900000, status: "ready" },
      { name: "Ampolleta LED 12W luz fría", sku: "ELE-002", category: "Electricidad", normal: 2490, promo: 1740, from: "2026-06-24", to: "2026-06-26", channel: "tienda", placement: "gondola", placementLabel: "Cabecera de góndola", budget: 300000, estSale: 1400000, status: "ready" },
      { name: "Taladro percutor + set brocas", sku: "HER-006", category: "Herramientas eléctricas", normal: 59990, promo: 44990, from: "2026-06-24", to: "2026-06-27", channel: "redes", placement: "reel", placementLabel: "Reel TikTok", budget: 620000, estSale: 2600000, status: "pending" },
    ],
  },
  {
    id: "invierno",
    name: "Campaña Invierno",
    from: "2026-07-10",
    to: "2026-07-24",
    totalBudget: 6000000,
    channelBudget: { redes: 1800000, ml: 1200000, web: 2000000, tienda: 1000000 },
    products: [
      { name: "Pintura látex blanco 1 galón", sku: "PIN-001", category: "Pinturas", normal: 14990, promo: 11240, from: "2026-07-10", to: "2026-07-24", channel: "redes", placement: "reel", placementLabel: 'Reel "renueva tu hogar"', budget: 600000, estSale: 2800000, status: "ready" },
      { name: "Plancha OSB 9,5 mm 1,22x2,44", sku: "MAD-001", category: "Maderas", normal: 18990, promo: 16140, from: "2026-07-10", to: "2026-07-24", channel: "web", placement: "banner", placementLabel: "Banner home web", budget: 520000, estSale: 2400000, status: "ready" },
      { name: "Cemento Polpaico 25 kg", sku: "CON-001", category: "Construcción", normal: 5490, promo: 4940, from: "2026-07-10", to: "2026-07-17", channel: "tienda", placement: "vitrina", placementLabel: "Vitrina + pendón tienda", budget: 400000, estSale: 3800000, status: "stock_risk" },
      { name: "Tubería PVC sanitaria 110 mm", sku: "GAS-001", category: "Gasfitería", normal: 6490, promo: 5190, from: "2026-07-10", to: "2026-07-24", channel: "ml", placement: "destacado", placementLabel: "Listado destacado ML", budget: 350000, estSale: 1900000, status: "stock_risk" },
      { name: "Terciado estructural 15 mm", sku: "MAD-003", category: "Maderas", normal: 16900, promo: 14365, from: "2026-07-15", to: "2026-07-24", channel: "web", placement: "banner", placementLabel: "Banner categoría", budget: 330000, estSale: 1500000, status: "ready" },
    ],
  },
  {
    id: "fiestas",
    name: "Fiestas Patrias",
    from: "2026-09-05",
    to: "2026-09-18",
    totalBudget: 5000000,
    channelBudget: { redes: 1500000, ml: 900000, web: 1100000, tienda: 1500000 },
    products: [
      { name: "Carretilla reforzada 90 litros", sku: "JAR-003", category: "Jardín", normal: 39990, promo: 27990, from: "2026-09-05", to: "2026-09-18", channel: "redes", placement: "reel", placementLabel: 'Reel "asado perfecto"', budget: 500000, estSale: 1500000, status: "ready" },
      { name: "Fierro estriado 8 mm x 6 m", sku: "CON-003", category: "Construcción", normal: 5290, promo: 4760, from: "2026-09-05", to: "2026-09-18", channel: "tienda", placement: "vitrina", placementLabel: "Vitrina tienda", budget: 420000, estSale: 3990000, status: "stock_risk" },
      { name: "Guantes de seguridad anticorte", sku: "SEG-001", category: "Seguridad industrial", normal: 5490, promo: 3570, from: "2026-09-10", to: "2026-09-18", channel: "ml", placement: "destacado", placementLabel: "Pack liquidación ML", budget: 300000, estSale: 980000, status: "ready" },
      { name: "Esmalte sintético negro 1/4 gal", sku: "PIN-002", category: "Pinturas", normal: 6990, promo: 5590, from: "2026-09-05", to: "2026-09-18", channel: "web", placement: "banner", placementLabel: "Banner home web", budget: 280000, estSale: 1200000, status: "pending" },
      { name: "Teflón gasfitería 12 mm (pack 10)", sku: "GAS-004", category: "Gasfitería", normal: 1490, promo: 1190, from: "2026-09-05", to: "2026-09-18", channel: "tienda", placement: "gondola", placementLabel: "Cabecera de góndola", budget: 180000, estSale: 620000, status: "ready" },
    ],
  },
];
