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
  IconCalendar,
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
    hint: "Qué resolver hoy: prioridades, agenda y trabajo pendiente",
    children: [
      {
        to: "/",
        label: "Inicio",
        icon: IconDashboard,
        end: true,
        hint: "Qué resolver hoy: prioridades, agenda y trabajo pendiente",
      },
    ],
  },
  {
    key: "cartera",
    label: "Cartera",
    icon: IconCategories,
    to: "/mi-cartera",
    hint: "Categorías, marcas, proveedores, productos y surtido bajo tu responsabilidad",
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
      {
        to: "/surtido",
        label: "Surtido",
        icon: IconProducts,
        hint: "Rol de categoría, surtido por tienda, marca propia y altas/salidas",
        secondary: true,
      },
      {
        to: "/surtido-redundante",
        label: "Duplicidad de surtido",
        icon: IconBulb,
        hint: "Productos repetidos dentro de una subcategoría que puedes racionalizar",
        secondary: true,
      },
    ],
  },
  {
    key: "inventario",
    label: "Inventario",
    icon: IconInventory,
    to: "/inventario",
    hint: "Diagnóstico de salud: cobertura, sobrestock, sin movimiento y venta perdida",
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
    ],
  },
  {
    key: "plan-compra",
    label: "Plan de compra",
    icon: IconReplenish,
    to: "/comprar/decisiones",
    hint: "Qué reponer y con qué presupuesto: necesidades que inician la compra",
    children: [
      {
        to: "/comprar/decisiones",
        label: "Decisiones",
        icon: IconReplenish,
        hint: "Qué reponer: quiebres, riesgo y recomendaciones que inician la compra",
      },
      {
        to: "/presupuesto",
        label: "Presupuesto",
        icon: IconRules,
        hint: "Presupuesto por categoría: comprometido, recibido, disponible y proyección",
      },
    ],
  },
  {
    key: "negociaciones",
    label: "Negociaciones",
    icon: IconChat,
    to: "/comprar/cotizaciones",
    hint: "Cotizaciones, condiciones y variaciones de costo para negociar mejor",
    children: [
      {
        to: "/comprar/cotizaciones",
        label: "Cotizaciones",
        icon: IconChat,
        hint: "Solicita y compara cotizaciones (RFQ) y conviértelas en OC",
      },
      {
        to: "/alzas-precio",
        label: "Variaciones de costo",
        icon: IconSales,
        hint: "Nuevas listas de precio, impacto en margen y negociación",
      },
    ],
  },
  {
    key: "ordenes",
    label: "Órdenes",
    icon: IconOrders,
    to: "/comprar/borradores",
    hint: "Propuestas, aprobaciones y seguimiento de las órdenes de compra",
    badgeKeys: ["aprobaciones"],
    children: [
      {
        to: "/comprar/borradores",
        label: "Propuestas / borradores",
        icon: IconOrders,
        hint: "Construye la compra por proveedor, revisa restricciones y formaliza",
      },
      {
        to: "/comprar/aprobaciones",
        label: "Aprobaciones",
        icon: IconCheck,
        hint: "Compras fuera de criterio que requieren aprobación y justificación",
        badge: "aprobaciones",
      },
      {
        to: "/comprar/seguimiento",
        label: "Seguimiento",
        icon: IconOrders,
        hint: "OC emitidas, confirmadas, atrasadas y por recibir; prioriza por venta en riesgo",
      },
    ],
  },
  {
    key: "entregas",
    label: "Entregas",
    icon: IconTruck,
    to: "/comprar/plan-retiro",
    hint: "Retiro, recepción, diferencias y reclamos al proveedor",
    children: [
      {
        to: "/comprar/plan-retiro",
        label: "Plan de retiro",
        icon: IconTruck,
        hint: "Cómo se retira la mercadería: camiones, capacidad, centros, fechas y costo",
      },
      {
        to: "/recepciones",
        label: "Recepciones",
        icon: IconInventory,
        hint: "Qué viene en camino, qué llegó y con qué diferencias",
      },
      {
        to: "/reclamos",
        label: "Reclamos",
        icon: IconAlerts,
        hint: "Faltantes, daños, calidad y costos: qué se reclama y cómo se resuelve",
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
    key: "proveedores",
    label: "Proveedores",
    icon: IconSuppliers,
    to: "/proveedores",
    hint: "Performance, costos, margen, cumplimiento y negociación",
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
    key: "temporadas",
    label: "Temporadas",
    icon: IconCalendar,
    to: "/temporadas",
    hint: "Estacionalidad, planificación de temporada, campañas y anticipación",
    children: [
      {
        to: "/temporadas",
        label: "Estacionalidad",
        icon: IconCampaign,
        hint: "Cuándo sube la demanda y por qué canal se vende",
      },
      {
        to: "/comprar/temporada",
        label: "Planificar temporada",
        icon: IconCalendar,
        hint: "Planifica la compra por temporada: demanda por origen, escenarios y compra explicable",
      },
      {
        to: "/campanas",
        label: "Campañas",
        icon: IconCampaign,
        hint: "Productos en descuento, presupuesto y canales",
      },
      {
        to: "/anticipacion",
        label: "Anticipación",
        icon: IconBulb,
        hint: "Comprar antes del peak, liquidar y detectar crecimiento por canal",
      },
    ],
  },
  {
    key: "analisis",
    label: "Análisis",
    icon: IconSales,
    to: "/analisis-compra",
    hint: "Rentabilidad, ventas, desempeño, aprendizaje, alertas y señales",
    badgeKeys: ["alertas", "senales"],
    children: [
      {
        to: "/analisis-compra",
        label: "Rentabilidad",
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
        to: "/mi-desempeno",
        label: "Mi desempeño",
        icon: IconBulb,
        hint: "Tu score, metas del mes y foco de hoy",
      },
      {
        to: "/aprendizaje",
        label: "Aprendizaje de compra",
        icon: IconCheck,
        hint: "Calidad de las compras e historial de decisiones: qué se compró bien y qué aprender",
      },
      {
        to: "/reportes",
        label: "Resultados",
        icon: IconDashboard,
        hint: "Reportes consolidados de compras, OC, rotación, márgenes y proveedores",
      },
      {
        to: "/alertas",
        label: "Alertas",
        icon: IconAlerts,
        hint: "Problemas que requieren atención del comprador",
        badge: "alertas",
        secondary: true,
      },
      {
        to: "/senales-ventas",
        label: "Señales de ventas",
        icon: IconSignal,
        hint: "Lo que ventas detecta en terreno: quiebres, demanda y oportunidades",
        badge: "senales",
        secondary: true,
      },
    ],
  },
  {
    key: "config",
    label: "Configuración",
    icon: IconRules,
    to: "/reglas",
    hint: "Reglas de recomendación y parámetros de reposición",
    children: [
      {
        to: "/reglas",
        label: "Reglas y parámetros",
        icon: IconRules,
        hint: "Cómo se calcula la compra sugerida y detección de parámetros mal configurados",
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
//  Lista plana de todas las vistas (para títulos de ruta, recientes, etc.).
// ----------------------------------------------------------------------------
export const navItems: NavItem[] = [...compradorModules, ...liderExtraModules]
  .flatMap((m) => m.children)
  .filter((item, i, arr) => arr.findIndex((x) => x.to === item.to) === i);
