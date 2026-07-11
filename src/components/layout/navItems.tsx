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
  IconChat,
  IconDownload,
  IconTruck,
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
  /** Vistas útiles, pero no necesarias como acceso principal permanente. */
  secondary?: boolean;
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
      {
        to: "/",
        label: "Inicio",
        icon: IconDashboard,
        end: true,
        hint: "Qué hacer hoy: acciones críticas, tu día y tus categorías",
      },
    ],
  },
  {
    key: "cartera",
    label: "Mi cartera",
    icon: IconCategories,
    to: "/mi-cartera",
    hint: "Categorías, marcas, proveedores y productos bajo tu responsabilidad",
    children: [
      {
        to: "/mi-cartera",
        label: "Resumen de cartera",
        icon: IconDashboard,
        hint: "Venta, margen, inventario, cobertura, quiebres, sobrestock y GMROI de tu cartera",
      },
      {
        to: "/mi-cartera/productos-clave",
        label: "Productos clave",
        icon: IconProducts,
        hint: "Estrellas, tractores, margen, crecimiento, riesgo y detenidos",
      },
      {
        to: "/mi-cartera/marcas",
        label: "Marcas",
        icon: IconSales,
        hint: "Venta, margen, crecimiento, inventario y participación por marca",
      },
      {
        to: "/mi-cartera/proveedores",
        label: "Proveedores",
        icon: IconSuppliers,
        hint: "Dependencia, riesgo y proveedores que preparan negociación",
      },
      {
        to: "/mi-cartera/oportunidades",
        label: "Oportunidades",
        icon: IconBulb,
        hint: "Crecimiento, margen, disponibilidad, alternativas y brechas comerciales",
      },
      {
        to: "/categorias",
        label: "Categorías",
        icon: IconCategories,
        hint: "Baja desde categoría a producto para entender dónde está el problema",
        secondary: true,
      },
      {
        to: "/productos",
        label: "Productos",
        icon: IconProducts,
        hint: "Desempeño SKU: venta, margen, stock, cobertura y estado",
        secondary: true,
      },
    ],
  },
  {
    key: "comprar",
    label: "Comprar",
    icon: IconReplenish,
    to: "/comprar/decisiones",
    hint: "Workspace operacional: decide, prepara, formaliza y sigue la compra",
    badgeKeys: ["aprobaciones"],
    children: [
      {
        to: "/comprar/decisiones",
        label: "Decisiones",
        icon: IconReplenish,
        hint: "Necesidades, quiebres y recomendaciones que inician el flujo de compra",
      },
      {
        to: "/comprar/reposicion",
        label: "Reposición",
        icon: IconInventory,
        hint: "Reponer productos con riesgo de quiebre o cobertura corta",
      },
      {
        to: "/comprar/cotizaciones",
        label: "Cotizaciones",
        icon: IconChat,
        hint: "Solicita y compara cotizaciones (RFQ) y conviértelas en OC",
      },
      {
        to: "/comprar/borradores",
        label: "Borradores OC",
        icon: IconOrders,
        hint: "Construye la compra por proveedor, revisa restricciones y formaliza",
      },
      {
        to: "/comprar/plan-retiro",
        label: "Plan de retiro",
        icon: IconTruck,
        hint: "Cómo se retira la mercadería: camiones, capacidad, centros, fechas y costo logístico",
      },
      {
        to: "/comprar/aprobaciones",
        label: "Aprobaciones",
        icon: IconCheck,
        hint: "Compras fuera de criterio que requieren aprobación y justificación",
        badge: "aprobaciones",
      },
      {
        to: "/comprar/ordenes",
        label: "Órdenes",
        icon: IconOrders,
        hint: "Órdenes emitidas y estado operacional",
      },
      {
        to: "/comprar/seguimiento",
        label: "Seguimiento",
        icon: IconOrders,
        hint: "OC emitidas, confirmadas, atrasadas y por recibir",
      },
      {
        to: "/comprar/recepciones",
        label: "Recepciones",
        icon: IconInventory,
        hint: "Qué llegó, qué falta y qué incidencias debe resolver el comprador",
      },
      {
        to: "/reposicion",
        label: "Reposición",
        icon: IconReplenish,
        hint: "Ruta anterior de reposición, integrada ahora a Decisiones",
        secondary: true,
      },
      {
        to: "/ordenes-compra",
        label: "Órdenes",
        icon: IconOrders,
        hint: "Ruta anterior de órdenes, integrada ahora a Borradores y Seguimiento",
        secondary: true,
      },
      {
        to: "/cotizaciones",
        label: "Cotizaciones",
        icon: IconChat,
        hint: "Ruta anterior de cotizaciones, integrada ahora a Comprar",
        secondary: true,
      },
      {
        to: "/aprobaciones",
        label: "Aprobaciones",
        icon: IconCheck,
        hint: "Ruta anterior de aprobaciones, integrada ahora a Comprar",
        badge: "aprobaciones",
        secondary: true,
      },
      {
        to: "/recepciones",
        label: "Recepciones",
        icon: IconInventory,
        hint: "Ruta anterior de recepciones, integrada ahora a Comprar",
        secondary: true,
      },
    ],
  },
  {
    key: "inventario",
    label: "Inventario",
    icon: IconInventory,
    to: "/inventario",
    hint: "Cobertura, sobrestock, sin movimiento, recepciones y venta perdida",
    children: [
      {
        to: "/inventario",
        label: "Cobertura & sobrestock",
        icon: IconInventory,
        hint: "Capital inmovilizado, sobrestock, stock muerto y quiebres",
      },
      {
        to: "/venta-no-capturada",
        label: "Venta no capturada",
        icon: IconBulb,
        hint: "Productos que vendían, quedaron sin stock y no se recompraron",
      },
      {
        to: "/recepciones",
        label: "Recepciones",
        icon: IconInventory,
        hint: "Qué viene en camino, qué llegó y cómo llegó",
      },
      {
        to: "/documentos",
        label: "Documentos",
        icon: IconDownload,
        hint: "Cotizaciones, OC, guías, facturas, listas y contratos",
        secondary: true,
      },
    ],
  },
  {
    key: "rentabilidad",
    label: "Rentabilidad",
    icon: IconSales,
    to: "/analisis-compra",
    hint: "Margen, contribución, GMROI, costos y oportunidades",
    children: [
      {
        to: "/analisis-compra",
        label: "Ranking & liquidación",
        icon: IconSales,
        hint: "Top productos, proveedores y marcas; y qué liquidar o descontinuar",
      },
      {
        to: "/ventas",
        label: "Ventas",
        icon: IconSales,
        hint: "Qué se vende, qué crece y qué cae",
      },
      {
        to: "/margen-canal",
        label: "Margen por canal",
        icon: IconSales,
        hint: "Precio y margen por marketplace, web y tienda",
      },
      {
        to: "/alzas-precio",
        label: "Variaciones de costo",
        icon: IconSales,
        hint: "Nuevas listas de precio, impacto en margen y aprobación",
        secondary: true,
      },
      {
        to: "/presupuesto",
        label: "Presupuesto",
        icon: IconRules,
        hint: "Presupuesto por categoría: comprometido, recibido, disponible y proyección",
        secondary: true,
      },
    ],
  },
  {
    key: "catalogo",
    label: "Catálogo",
    icon: IconProducts,
    to: "/surtido-redundante",
    hint: "Racionalización, duplicidad, candidatos a salida y nuevos productos",
    children: [
      {
        to: "/surtido-redundante",
        label: "Duplicidad",
        icon: IconBulb,
        hint: "Productos repetidos dentro de una subcategoría que puedes racionalizar",
      },
      {
        to: "/campanas",
        label: "Campañas",
        icon: IconCampaign,
        hint: "Productos en descuento, presupuesto y canales",
        secondary: true,
      },
      {
        to: "/anticipacion",
        label: "Productos a potenciar",
        icon: IconBulb,
        hint: "Comprar antes del peak, liquidar y detectar crecimiento por canal",
        secondary: true,
      },
    ],
  },
  {
    key: "proveedores",
    label: "Proveedores",
    icon: IconSuppliers,
    to: "/proveedores",
    hint: "Performance comercial, costos, margen, cumplimiento y negociación",
    children: [
      {
        to: "/proveedores",
        label: "Performance",
        icon: IconSuppliers,
        hint: "Cumplimiento, lead time, venta, margen y monto pendiente para negociar mejor",
      },
    ],
  },
  {
    key: "plan",
    label: "Mi plan",
    icon: IconBulb,
    to: "/mi-desempeno",
    hint: "Metas, presupuesto, acciones y resultados",
    badgeKeys: ["alertas", "senales"],
    children: [
      {
        to: "/mi-desempeno",
        label: "Metas",
        icon: IconBulb,
        hint: "Tu score, metas del mes y foco de hoy",
      },
      {
        to: "/alertas",
        label: "Alertas",
        icon: IconAlerts,
        hint: "Problemas que requieren atención del comprador",
        badge: "alertas",
      },
      {
        to: "/senales-ventas",
        label: "Señales ventas",
        icon: IconSignal,
        hint: "Lo que ventas detecta en terreno: quiebres, demanda y oportunidades",
        badge: "senales",
      },
      {
        to: "/reportes",
        label: "Resultados",
        icon: IconDashboard,
        hint: "Reportes consolidados de compras, OC, rotación, márgenes y proveedores",
        secondary: true,
      },
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
      {
        to: "/equipo",
        label: "Panel del equipo",
        icon: IconDashboard,
        end: true,
        hint: "Cómo está funcionando el área de compras hoy",
      },
      {
        to: "/equipo/alertas",
        label: "Alertas del equipo",
        icon: IconAlerts,
        hint: "Riesgos del equipo priorizados",
        badge: "equipoAlertas",
      },
    ],
  },
  {
    key: "equipo",
    label: "Equipo",
    icon: IconSuppliers,
    to: "/equipo/compradores",
    hint: "Compradores, competencia, metas y carga del equipo",
    children: [
      {
        to: "/equipo/compradores",
        label: "Compradores",
        icon: IconSuppliers,
        hint: "Ficha y desempeño por comprador",
      },
      {
        to: "/equipo/ranking",
        label: "Competencia",
        icon: IconSales,
        hint: "Ranking general, rankings por dimensión y reconocimientos del mes",
      },
      { to: "/equipo/metas", label: "Metas", icon: IconCheck, hint: "OKRs por comprador" },
      {
        to: "/equipo/carga",
        label: "Carga & reasignación",
        icon: IconRules,
        hint: "Equilibrar la carga del equipo",
      },
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
