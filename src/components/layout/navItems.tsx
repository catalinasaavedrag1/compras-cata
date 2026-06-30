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
  /** Indicador de pendientes/alertas (conteo dinámico). */
  badge?: NavBadgeKey;
}

/**
 * Módulo de la barra superior. Cada módulo agrupa una o varias vistas como
 * sub-pestañas — ya no hay menú lateral secundario: el módulo es el primer
 * nivel y sus `children` el segundo (sub-pestañas). Si un módulo tiene un solo
 * hijo no muestra barra de sub-pestañas.
 */
export interface NavModule {
  key: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  /** Ruta a la que lleva el módulo al hacer clic (normalmente su primera vista). */
  to: string;
  end?: boolean;
  hint: string;
  /** Badges cuyos conteos se suman para el indicador del módulo. */
  badgeKeys?: NavBadgeKey[];
  /** Sub-pestañas del módulo (≥ 1). */
  children: NavItem[];
}

// Compatibilidad con consumidores que esperan grupos {title, items}.
export interface NavGroup {
  title: string;
  items: NavItem[];
}

// ----------------------------------------------------------------------------
//  Módulos del Comprador (barra superior · sub-pestañas)
// ----------------------------------------------------------------------------
export const compradorModules: NavModule[] = [
  {
    key: "inicio",
    label: "Inicio",
    icon: IconDashboard,
    to: "/",
    end: true,
    hint: "Qué hacer hoy: acciones críticas, tu día y tus categorías",
    children: [
      { to: "/", label: "Inicio", icon: IconDashboard, end: true, hint: "Qué hacer hoy: acciones críticas, tu día y tus categorías" },
    ],
  },
  {
    key: "reposicion",
    label: "Reposición",
    icon: IconReplenish,
    to: "/reposicion",
    hint: "Qué comprar, cuánto y por qué — priorizado por riesgo de quiebre",
    children: [
      { to: "/reposicion", label: "Reposición sugerida", icon: IconReplenish, hint: "Qué comprar, cuánto y por qué — priorizado por riesgo de quiebre" },
      { to: "/reglas", label: "Reglas de compra", icon: IconRules, hint: "Parámetros del cálculo de la compra sugerida" },
    ],
  },
  {
    key: "campanas",
    label: "Campañas",
    icon: IconCampaign,
    to: "/campanas",
    hint: "Descuentos, anticipación al peak y venta no capturada",
    children: [
      { to: "/campanas", label: "Campañas", icon: IconCampaign, hint: "Productos en descuento, presupuesto y canales" },
      { to: "/anticipacion", label: "Anticipación de campañas", icon: IconBulb, hint: "Comprar antes del peak, liquidar y detectar crecimiento por canal" },
      { to: "/venta-no-capturada", label: "Venta no capturada", icon: IconBulb, hint: "Productos que vendían, quedaron sin stock y no se recompraron" },
    ],
  },
  {
    key: "catalogo",
    label: "Catálogo",
    icon: IconProducts,
    to: "/productos",
    hint: "Productos, categorías y racionalización del surtido",
    children: [
      { to: "/productos", label: "Productos", icon: IconProducts, hint: "Stock, margen, rotación y estado del surtido" },
      { to: "/categorias", label: "Categorías", icon: IconCategories, hint: "Salud comercial por categoría" },
      { to: "/surtido-redundante", label: "Surtido redundante", icon: IconBulb, hint: "Productos repetidos dentro de una misma subcategoría que puedes racionalizar" },
    ],
  },
  {
    key: "proveedores",
    label: "Proveedores",
    icon: IconSuppliers,
    to: "/proveedores",
    hint: "Cumplimiento, lead time y monto pendiente",
    children: [
      { to: "/proveedores", label: "Proveedores", icon: IconSuppliers, hint: "Cumplimiento, lead time y monto pendiente — para decidir si seguir comprando" },
    ],
  },
  {
    key: "ordenes",
    label: "Órdenes",
    icon: IconOrders,
    to: "/ordenes-compra",
    hint: "OC, recepciones, aprobaciones y aprendizaje de compra",
    badgeKeys: ["aprobaciones"],
    children: [
      { to: "/ordenes-compra", label: "Órdenes de compra", icon: IconOrders, hint: "Seguimiento de OC y creación desde el borrador" },
      { to: "/recepciones", label: "Recepciones", icon: IconInventory, hint: "Qué viene en camino, qué llegó y cómo llegó" },
      { to: "/aprobaciones", label: "Aprobaciones", icon: IconCheck, hint: "Compras fuera de criterio que requieren aprobación y justificación", badge: "aprobaciones" },
      { to: "/aprendizaje", label: "Aprendizaje de compra", icon: IconBulb, hint: "¿Se compró corto, saludable o de más? Sugerido vs comprado y su resultado" },
    ],
  },
  {
    key: "bandeja",
    label: "Bandeja",
    icon: IconAlerts,
    to: "/alertas",
    hint: "Alertas del sistema y señales del terreno",
    badgeKeys: ["alertas", "senales"],
    children: [
      { to: "/alertas", label: "Alertas comerciales", icon: IconAlerts, hint: "Problemas que requieren atención del comprador", badge: "alertas" },
      { to: "/senales-ventas", label: "Señales de ventas", icon: IconSignal, hint: "Lo que ventas detecta en el terreno: quiebres, demanda y oportunidades", badge: "senales" },
    ],
  },
  {
    key: "analisis",
    label: "Análisis",
    icon: IconInventory,
    to: "/inventario",
    hint: "Inventario, ventas y margen por canal — cada corte enlaza a su acción",
    children: [
      { to: "/inventario", label: "Inventario", icon: IconInventory, hint: "Capital inmovilizado, sobrestock y quiebres" },
      { to: "/ventas", label: "Ventas", icon: IconSales, hint: "Qué se vende, qué crece y qué cae" },
      { to: "/margen-canal", label: "Margen por canal", icon: IconSales, hint: "Precio y margen por marketplace, web y tienda" },
    ],
  },
  {
    key: "desempeno",
    label: "Mi desempeño",
    icon: IconBulb,
    to: "/mi-desempeno",
    hint: "Tu score, metas del mes y foco de hoy",
    children: [
      { to: "/mi-desempeno", label: "Mi desempeño", icon: IconBulb, hint: "Tu score, metas del mes y foco de hoy" },
    ],
  },
];

// ----------------------------------------------------------------------------
//  Módulos EXTRA solo del Líder de Compras (visión de equipo y cross-comprador).
// ----------------------------------------------------------------------------
export const liderExtraModules: NavModule[] = [
  {
    key: "lider",
    label: "Líder",
    icon: IconDashboard,
    to: "/equipo",
    end: true,
    hint: "Cómo está funcionando el área de compras hoy",
    badgeKeys: ["equipoAlertas"],
    children: [
      { to: "/equipo", label: "Panel del equipo", icon: IconDashboard, end: true, hint: "Cómo está funcionando el área de compras hoy" },
      { to: "/equipo/alertas", label: "Alertas del equipo", icon: IconAlerts, hint: "Riesgos del equipo priorizados", badge: "equipoAlertas" },
    ],
  },
  {
    key: "equipo",
    label: "Equipo",
    icon: IconSuppliers,
    to: "/equipo/compradores",
    hint: "Compradores, competencia, metas y carga del equipo",
    children: [
      { to: "/equipo/compradores", label: "Compradores", icon: IconSuppliers, hint: "Ficha y desempeño por comprador" },
      { to: "/equipo/ranking", label: "Competencia", icon: IconSales, hint: "Ranking general, rankings por dimensión y reconocimientos del mes" },
      { to: "/equipo/metas", label: "Metas", icon: IconCheck, hint: "OKRs por comprador" },
      { to: "/equipo/carga", label: "Carga & reasignación", icon: IconRules, hint: "Equilibrar la carga del equipo" },
    ],
  },
];

/** Módulos visibles según el rol (el líder ve los del comprador + los de equipo). */
export function modulesFor(role: Role): NavModule[] {
  return role === "lider" ? [...compradorModules, ...liderExtraModules] : compradorModules;
}

/** ¿La ruta `to` está activa para `pathname`? (coincidencia exacta o por prefijo). */
export function isPathActive(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(to + "/");
}

/** Módulo activo para una ruta: el del hijo con la coincidencia más larga. */
export function activeModuleFor(modules: NavModule[], pathname: string): NavModule | undefined {
  let best: NavModule | undefined;
  let bestLen = -1;
  for (const m of modules) {
    for (const c of m.children) {
      if (isPathActive(pathname, c.to, c.end) && c.to.length > bestLen) {
        best = m;
        bestLen = c.to.length;
      }
    }
  }
  return best;
}

// ----------------------------------------------------------------------------
//  Compatibilidad: grupos {title, items} para el menú móvil y lista plana.
// ----------------------------------------------------------------------------
export function navGroupsFor(role: Role): NavGroup[] {
  return modulesFor(role).map((m) => ({ title: m.label, items: m.children }));
}

/** Rutas que son exclusivas del líder (cross-comprador). Un comprador no entra. */
export const LEADER_ONLY_PREFIXES = ["/equipo"];

/** Lista plana de todas las vistas (para títulos de ruta, recientes, etc.). */
export const navItems: NavItem[] = [...compradorModules, ...liderExtraModules]
  .flatMap((m) => m.children)
  .filter((item, i, arr) => arr.findIndex((x) => x.to === item.to) === i);
