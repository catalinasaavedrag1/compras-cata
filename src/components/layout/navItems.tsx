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
} from "../ui/icons";

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

export const navGroups: NavGroup[] = [
  {
    title: "Inicio",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: IconDashboard,
        end: true,
        hint: "Resumen del día y qué revisar primero",
      },
      {
        to: "/mi-panel",
        label: "Mi panel",
        icon: IconCheck,
        hint: "Mis tareas, categorías, riesgos de quiebre y proveedores",
      },
    ],
  },
  {
    title: "Gestión de compra",
    items: [
      {
        to: "/reposicion",
        label: "Reposición sugerida",
        icon: IconReplenish,
        hint: "Qué comprar, cuánto y por qué",
      },
      {
        to: "/campanas-oportunidades",
        label: "Campañas y oportunidades",
        icon: IconCampaign,
        hint: "Anticipar compras para campañas, liquidaciones y crecimiento",
      },
      {
        to: "/ordenes-compra",
        label: "Órdenes de compra",
        icon: IconOrders,
        hint: "Seguimiento de OC y creación desde sugerencias",
      },
      {
        to: "/proveedores",
        label: "Proveedores",
        icon: IconSuppliers,
        hint: "Cumplimiento, lead time y proveedores a revisar",
      },
    ],
  },
  {
    title: "Catálogo",
    items: [
      {
        to: "/productos",
        label: "Productos / SKUs",
        icon: IconProducts,
        hint: "Maestro de productos del surtido",
      },
      {
        to: "/categorias",
        label: "Categorías",
        icon: IconCategories,
        hint: "Salud comercial por categoría",
      },
    ],
  },
  {
    title: "Análisis",
    items: [
      {
        to: "/inventario",
        label: "Análisis de inventario",
        icon: IconInventory,
        hint: "Capital inmovilizado, sobrestock y quiebres",
      },
      {
        to: "/ventas",
        label: "Análisis de ventas",
        icon: IconSales,
        hint: "Qué se vende, qué crece y qué cae",
      },
      {
        to: "/alertas",
        label: "Alertas comerciales",
        icon: IconAlerts,
        hint: "Problemas que requieren atención del comprador",
      },
    ],
  },
  {
    title: "Configuración",
    items: [
      {
        to: "/reglas",
        label: "Reglas de compra",
        icon: IconRules,
        hint: "Parámetros del cálculo de compra sugerida",
      },
    ],
  },
];

/** Lista plana (para búsquedas de título de ruta, etc.). */
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);
