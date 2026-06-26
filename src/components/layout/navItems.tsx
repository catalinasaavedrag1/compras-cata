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

export interface NavItem {
  to: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  end?: boolean;
  /** Descripción corta para tooltip / ayuda. */
  hint: string;
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
      { to: "/alertas", label: "Alertas", icon: IconAlerts, hint: "Problemas que requieren atención del comprador" },
      { to: "/senales-ventas", label: "Señales de ventas", icon: IconSignal, hint: "Lo que ventas detecta en el terreno: quiebres, demanda y oportunidades" },
    ],
  },
  {
    title: "Comprar",
    items: [
      { to: "/reposicion", label: "Reposición", icon: IconReplenish, hint: "Qué comprar, cuánto y por qué" },
      { to: "/campanas-oportunidades", label: "Campañas", icon: IconCampaign, hint: "Anticipar compras para campañas, liquidaciones y crecimiento" },
      { to: "/ordenes-compra", label: "Órdenes", icon: IconOrders, hint: "Seguimiento de OC y creación desde sugerencias" },
      { to: "/recepciones", label: "Recepciones", icon: IconInventory, hint: "Qué viene en camino, qué llegó y cómo llegó" },
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
//  Menú del Líder de Compras
// ----------------------------------------------------------------------------
export const liderGroups: NavGroup[] = [
  {
    title: "Inicio",
    items: [
      { to: "/equipo", label: "Panel del equipo", icon: IconDashboard, end: true, hint: "Cómo está funcionando el área de compras hoy" },
      { to: "/equipo/alertas", label: "Alertas del equipo", icon: IconAlerts, hint: "Riesgos del equipo priorizados" },
    ],
  },
  {
    title: "Equipo",
    items: [
      { to: "/equipo/compradores", label: "Compradores", icon: IconSuppliers, hint: "Ficha y desempeño por comprador" },
      { to: "/equipo/ranking", label: "Ranking", icon: IconSales, hint: "Posiciones por score global" },
      { to: "/equipo/metas", label: "Metas", icon: IconCheck, hint: "OKRs por comprador" },
    ],
  },
  {
    title: "Gestión",
    items: [
      { to: "/equipo/carga", label: "Carga & reasignación", icon: IconRules, hint: "Equilibrar la carga del equipo" },
    ],
  },
];

export function navGroupsFor(role: Role): NavGroup[] {
  return role === "lider" ? liderGroups : compradorGroups;
}

/** Lista plana de todos los ítems (para títulos de ruta, etc.). */
export const navItems: NavItem[] = [...compradorGroups, ...liderGroups].flatMap(
  (g) => g.items
);
