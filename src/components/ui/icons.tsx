// Set de iconos como SVG inline (sin dependencias externas).
// Todos heredan el color con currentColor y reciben className.

interface IconProps {
  className?: string;
}

function base(path: React.ReactNode) {
  return function Icon({ className = "w-5 h-5" }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {path}
      </svg>
    );
  };
}

export const IconDashboard = base(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>
);

export const IconReplenish = base(
  <>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v4h-4" />
  </>
);

export const IconProducts = base(
  <>
    <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.3 7 12 12l8.7-5M12 22V12" />
  </>
);

export const IconCategories = base(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>
);

export const IconSuppliers = base(
  <>
    <path d="M3 21V7l9-4 9 4v14" />
    <path d="M9 21v-6h6v6M3 11h18" />
  </>
);

export const IconOrders = base(
  <>
    <path d="M9 2h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2V3a1 1 0 0 1 1-1z" />
    <path d="M9 12h6M9 16h6M9 4h6" />
  </>
);

export const IconAlerts = base(
  <>
    <path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </>
);

export const IconInventory = base(
  <>
    <path d="M3 7h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M3 7l2-4h14l2 4M9 12h6" />
  </>
);

export const IconSales = base(
  <>
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 3 3 5-6" />
  </>
);

export const IconRules = base(
  <>
    <path d="M4 4h16M4 12h16M4 20h16" />
    <circle cx="8" cy="4" r="2" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="20" r="2" fill="currentColor" stroke="none" />
  </>
);

export const IconSearch = base(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>
);

export const IconClose = base(<path d="M18 6 6 18M6 6l12 12" />);

export const IconMenu = base(<path d="M3 6h18M3 12h18M3 18h18" />);

export const IconChevronRight = base(<path d="m9 6 6 6-6 6" />);

export const IconArrowUp = base(<path d="M12 19V5M5 12l7-7 7 7" />);
export const IconArrowDown = base(<path d="M12 5v14M5 12l7 7 7-7" />);

export const IconPlus = base(<path d="M12 5v14M5 12h14" />);

export const IconBox = base(
  <>
    <path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8" />
    <path d="M3.3 7 12 12l8.7-5" />
  </>
);

export const IconInfo = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>
);

export const IconBulb = base(
  <>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3z" />
  </>
);

export const IconArrowRight = base(<path d="M5 12h14M13 6l6 6-6 6" />);

export const IconCheck = base(<path d="M20 6 9 17l-5-5" />);

export const IconClock = base(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);

export const IconDots = base(
  <>
    <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
  </>
);

export const IconBell = base(
  <>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </>
);

export const IconDownload = base(
  <>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </>
);

export const IconCampaign = base(
  <>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" />
    <path d="M14 8a4 4 0 0 1 0 8M17 5a8 8 0 0 1 0 14" />
  </>
);

// Señales del terreno (antena / broadcast): lo que ventas detecta y reporta.
export const IconSignal = base(
  <>
    <circle cx="12" cy="9" r="2" />
    <path d="M7.8 4.8a7 7 0 0 0 0 8.4M16.2 4.8a7 7 0 0 1 0 8.4" />
    <path d="M5 2.5a11 11 0 0 0 0 13M19 2.5a11 11 0 0 1 0 13" />
    <path d="M12 11v9" />
  </>
);

// Conversación / mensajes (chat interno comprador ↔ vendedor).
export const IconChat = base(
  <>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" />
  </>
);

// Convertir en tarea de compra / carrito.
export const IconCart = base(
  <>
    <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
    <path d="M2 3h2l2.4 12.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H5.2" />
  </>
);
