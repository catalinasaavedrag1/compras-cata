import {
  IconDashboard,
  IconReplenish,
  IconProducts,
  IconCategories,
  IconSuppliers,
  IconOrders,
  IconAlerts,
  IconInventory,
  IconSales,
  IconRules,
  IconCampaign,
  IconCheck,
  IconBulb,
  IconSignal,
} from "../ui/icons";
import type { Role } from "../../context/RoleContext";

/** Claves de badge dinámico: el conteo y tono se resuelven en useNavBadges(). */
export type NavBadgeKey = "alertas" | "aprobaciones" | "senales" | "equipoAlertas";

export interface NavItem {
  to: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  end?: boolean;
  /** Descripción corta para tooltip / ayuda. */
  hint: string;
  /** Indicador de pendientes/alertas en el menú (conteo dinámico). */
  badge?: NavBadgeKey;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// ----------------------------------------------------------------------------
//  Menú del Comprador
// ----------------------------------------------------------------------------
export const compradorGroups: NavGroup[] = [
  {
    title: "Inicio",
    items: [
      { to: "/", label: "Dashboard", icon: IconDashboard, end: true, hint: "Resumen del día y qué revisar primero" },
      { to: "/mi-panel", label: "Mi panel", icon: IconCheck, hint: "Mis tareas, categorías, riesgos de quiebre y proveedores" },
      { to: "/mi-desempeno", label: "Mi desempeño", icon: IconBulb, hint: "Tu score, metas y posición frente al equipo" },
      { to: "/alertas", label: "Alertas", icon: IconAlerts, hint: "Problemas que requieren atención del comprador", badge: "alertas" },
      { to: "/senales-ventas", label: "Señales de ventas", icon: IconSignal, hint: "Lo que ventas detecta en el terreno: quiebres, demanda y oportunidades", badge: "senales" },
    ],
  },
  {
    title: "Comprar",
    items: [
      { to: "/reposicion", label: "Reposición", icon: IconReplenish, hint: "Qué comprar, cuánto y por qué" },
      { to: "/campanas", label: "Campañas", icon: IconCampaign, hint: "Productos en descuento, presupuesto por canal y espacios publicitarios" },
      { to: "/campanas-oportunidades", label: "Oportunidades", icon: IconBulb, hint: "Anticipar compras para campañas, liquidaciones y crecimiento" },
      { to: "/oportunidades-perdidas", label: "Oportunidades perdidas", icon: IconBulb, hint: "Productos que vendían, quedaron sin stock y no se volvieron a comprar" },
      { to: "/ordenes-compra", label: "Órdenes", icon: IconOrders, hint: "Seguimiento de OC y creación desde sugerencias" },
      { to: "/aprobaciones", label: "Aprobaciones", icon: IconCheck, hint: "Compras fuera de criterio que requieren aprobación y justificación", badge: "aprobaciones" },
      { to: "/calidad-compra", label: "Calidad de compra", icon: IconCheck, hint: "¿Se compró corto, saludable o de más? Días comprados vs objetivo" },
      { to: "/recepciones", label: "Recepciones", icon: IconInventory, hint: "Qué viene en camino, qué llegó y cómo llegó" },
      { to: "/decisiones", label: "Historial de decisiones", icon: IconBulb, hint: "Auditoría: sugerido vs comprado, resultado y aprendizaje" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { to: "/productos", label: "Productos", icon: IconProducts, hint: "Maestro de productos del surtido" },
      { to: "/categorias", label: "Categorías", icon: IconCategories, hint: "Salud comercial por categoría" },
      { to: "/proveedores", label: "Proveedores", icon: IconSuppliers, hint: "Cumplimiento, lead time y proveedores a revisar" },
      { to: "/catalogo-optimizado", label: "Catálogo optimizado", icon: IconBulb, hint: "Productos redundantes por subcategoría para racionalizar el surtido" },
    ],
  },
  {
    title: "Análisis",
    items: [
      { to: "/inventario", label: "Inventario", icon: IconInventory, hint: "Capital inmovilizado, sobrestock y quiebres" },
      { to: "/ventas", label: "Ventas", icon: IconSales, hint: "Qué se vende, qué crece y qué cae" },
      { to: "/margen-canal", label: "Margen por canal", icon: IconSales, hint: "Precio y margen por marketplace, web y tienda" },
    ],
  },
  {
    title: "Configuración",
    items: [
      { to: "/reglas", label: "Reglas", icon: IconRules, hint: "Parámetros del cálculo de compra sugerida" },
    ],
  },
];

// ----------------------------------------------------------------------------
//  Grupos EXTRA solo del Líder de Compras (visión de equipo y cross-comprador).
//  El líder ve todo lo del comprador + estos grupos. Un comprador no los ve.
// ----------------------------------------------------------------------------
export const liderExtraGroups: NavGroup[] = [
  {
    title: "Equipo",
    items: [
      { to: "/equipo", label: "Panel del equipo", icon: IconDashboard, end: true, hint: "Cómo está funcionando el área de compras hoy" },
      { to: "/equipo/alertas", label: "Alertas del equipo", icon: IconAlerts, hint: "Riesgos del equipo priorizados", badge: "equipoAlertas" },
      { to: "/equipo/compradores", label: "Compradores", icon: IconSuppliers, hint: "Ficha y desempeño por comprador" },
      { to: "/equipo/ranking", label: "Competencia", icon: IconSales, hint: "Ranking general, rankings por dimensión y reconocimientos del mes" },
      { to: "/equipo/metas", label: "Metas", icon: IconCheck, hint: "OKRs por comprador" },
    ],
  },
  {
    title: "Gestión del equipo",
    items: [
      { to: "/equipo/carga", label: "Carga & reasignación", icon: IconRules, hint: "Equilibrar la carga del equipo" },
    ],
  },
];

// El líder ve el mismo menú operativo del comprador + sus grupos de equipo.
export const liderGroups: NavGroup[] = [...compradorGroups, ...liderExtraGroups];

export function navGroupsFor(role: Role): NavGroup[] {
  return role === "lider" ? liderGroups : compradorGroups;
}

/** Rutas que son exclusivas del líder (cross-comprador). Un comprador no entra. */
export const LEADER_ONLY_PREFIXES = ["/equipo"];

/** Lista plana de todos los ítems (para títulos de ruta, recientes, etc.). */
export const navItems: NavItem[] = [...compradorGroups, ...liderExtraGroups].flatMap(
  (g) => g.items
);
