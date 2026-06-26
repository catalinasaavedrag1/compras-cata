# Plataforma de Compras

Frontend operacional para **compradores de retail** (ferretería / construcción, estilo Sodimac, Easy, Construmart). No es una landing ni una maqueta: es una herramienta para **decidir qué comprar, cuánto, cuándo y a qué proveedor**.

> Importante: pensada como product owner. Cada pantalla tiene utilidad operacional. La app ayuda a decidir, no solo a mostrar datos.

---

## 1. Qué se construyó

Una SPA en React con 11 vistas navegables, datos mock realistas en formato chileno (CLP, fechas `dd/mm/aaaa`, porcentajes con coma) y lógica de negocio coherente para responder:

- Qué productos comprar ahora, cuánto y **por qué**.
- Qué SKUs están en quiebre, en riesgo o con sobrestock.
- Qué categorías están críticas y qué proveedores están fallando.
- Qué inventario está inmovilizando capital y qué venta se pierde por quiebre.

La compra sugerida se calcula combinando stock disponible, venta promedio, lead time del proveedor, stock mín/máx y días objetivo de inventario (ver sección 9).

## 2. Stack usado

| Tecnología | Uso |
|---|---|
| **React 18** | Librería de UI |
| **Vite 5** | Bundler / dev server |
| **TypeScript** | Tipado estático del dominio |
| **Tailwind CSS 3** | Estilos utilitarios (SaaS empresarial sobrio) |
| **React Router DOM 6** | Navegación entre vistas |

**Sin dependencias adicionales.** Los iconos son SVG inline propios (`src/components/ui/icons.tsx`) y los gráficos son barras CSS (`BarList`), para mantener el bundle liviano y evitar librerías innecesarias. No hay backend ni APIs reales: todo se sirve desde datos mock locales.

## 3. Cómo instalar

```bash
cd compras-cata
npm install
```

## 4. Cómo ejecutar

```bash
npm run dev      # solo frontend en modo demo (datos mock, http://localhost:5173)
npm run build    # build de producción (tsc + vite)
npm run preview  # previsualizar el build
npm run typecheck
```

### Con backend real (frontend + API conectados)

```bash
npm run seed       # genera server/db.json desde los datos mock (una vez)
npm run dev:full   # levanta API (http://localhost:4100) + frontend juntos
```

Y para que el frontend consuma la API, copia `.env.example` a `.env.local` y define:

```
VITE_API_URL=http://localhost:4100/api
```

Con eso el indicador del Topbar pasa a **"API conectada"** y los módulos leen/escriben contra el backend. Sin `VITE_API_URL` (p. ej. en GitHub Pages) la app sigue en **modo demo** con los datos mock, sin romperse.

**Backend** (`server/`): Express + almacén JSON (`server/db.json`, persistente) sembrado desde los mismos datos mock del front. Expone una API REST por colección: `GET /api/:collection`, `GET /api/:collection/:id`, `POST`, `PATCH`, `DELETE`, más `GET /api/health`. Scripts: `npm run server` (solo API), `npm run seed` (re-sembrar).

## 5. Estructura de carpetas

```
compras-cata/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── tailwind.config.js
├── postcss.config.js
├── README_COMPRAS.md
├── public/favicon.svg
└── src/
    ├── main.tsx · App.tsx
    ├── routes/AppRoutes.tsx
    ├── layouts/AppLayout.tsx
    ├── context/OcDraftContext.tsx     # borrador de orden de compra (estado global)
    ├── components/
    │   ├── layout/   (Sidebar, Topbar, MobileNav, navItems)
    │   ├── ui/       (Button, Card, Badge, Input, Select, Table, Tabs,
    │   │             Modal, Drawer, EmptyState, PageHeader, icons)
    │   └── business/ (KpiCard, StatusBadge, PriorityBadge, RecommendationBadge,
    │                  ProductMiniCard, AlertCard, FilterBar, BarList, alertLabels)
    ├── pages/        (11 páginas, ver sección 6)
    ├── data/         (mocks: products, categories, suppliers, purchaseOrders,
    │                  recommendations, alerts, inventory, sales, rules)
    ├── types/purchasing.ts
    ├── utils/        (formatters, calculations, filters, cn)
    └── styles/index.css
```

## 6. Vistas creadas

| Ruta | Vista | Propósito |
|---|---|---|
| `/` | **Dashboard** | KPIs + "Qué deberías revisar primero", alertas críticas, compra urgente, categorías/proveedores en riesgo. |
| `/reposicion` | **Reposición sugerida** | Vista central. Tabla con cantidad sugerida, motivo, riesgo, prioridad y acciones (agregar a OC, ajustar, ignorar, cambiar proveedor). |
| `/campanas-oportunidades` | **Campañas y oportunidades** | Vista estratégica para anticipar campañas, liquidaciones, crecimiento acelerado y riesgos de quiebre por canal. Ver [UX_IMPROVEMENTS.md](UX_IMPROVEMENTS.md). |
| `/productos` | **Productos / SKUs** | Maestro de productos con filtros y estado comercial/compra. |
| `/productos/:sku` | **Detalle de producto** | KPIs, stock por ubicación, recomendación, historiales, alertas y OC relacionadas. |
| `/categorias` | **Categorías** | Salud comercial por categoría + rankings (críticas, venta, margen, inventario). |
| `/proveedores` | **Proveedores** | Cumplimiento, lead time, monto pendiente; rankings para decidir si seguir comprando. |
| `/ordenes-compra` | **Órdenes de compra** | Tabla con tabs por estado; drawer "Crear OC desde sugerencias"; detalle en modal. |
| `/alertas` | **Alertas comerciales** | 13 tipos de alerta con severidad, descripción, recomendación y gestión de estado. |
| `/inventario` | **Análisis de inventario** | Capital inmovilizado, sobrestock, stock muerto, quiebre; cortes por categoría/bodega/rotación. |
| `/ventas` | **Análisis de ventas** | Venta por categoría/proveedor, top productos, crecimiento, caída, temporada, venta perdida. |
| `/reglas` | **Reglas de compra** | Parámetros editables (días objetivo, mín/máx, margen, lead time) + explicación del cálculo. |

## 7. Componentes creados

- **UI reutilizable:** `Button` (primary/secondary/ghost/danger), `Card`, `Badge`, `Input`, `Select`, `DataTable` (genérica con columnas tipadas), `Tabs`, `Modal`, `Drawer`, `EmptyState`, `PageHeader`, set de `icons`.
- **De negocio:** `KpiCard`, `StatusBadge` (mapea estados de producto/compra/OC/proveedor/categoría/alerta a colores y etiquetas en español), `PriorityBadge` / `SeverityBadge`, `RecommendationBadge`, `ProductMiniCard`, `AlertCard`, `FilterBar` (buscador + selects + chips), `BarList` (gráfico de barras CSS).
- **Layout:** `AppLayout`, `Sidebar`, `Topbar` (buscador global, usuario y fecha simulados, contador de borrador de OC), `MobileNav`.

### Acciones simuladas (sin backend)
- Agregar productos a un **borrador de OC** (estado global vía `OcDraftContext`, visible en el Topbar).
- Crear una OC desde sugerencias (drawer), ajustar cantidades, quitar líneas.
- Ajustar cantidad sugerida / cambiar proveedor (modal en Reposición).
- Ignorar / restaurar sugerencias.
- Marcar alertas como "en revisión" o "resueltas".
- Marcar OC como "enviada".
- Editar reglas de compra (con aviso de cambios sin persistir).

## 8. Datos mock usados

`src/data/`: **25 productos**, **10 categorías**, **8 proveedores**, **15 recomendaciones**, **12 órdenes de compra**, **15 alertas**, métricas de inventario y de venta, y **reglas de compra** por categoría. Nombres, tiendas (Balmaceda San Javier, Chorrillos San Javier, Centro de Distribución), compradores y montos en CLP son realistas y coherentes entre sí.

## 9. Cómo se calcula la compra sugerida

Implementado en `src/utils/calculations.ts`:

```
demanda diaria   = venta mensual / 30
horizonte        = lead time del proveedor + días objetivo de inventario
stock neto       = stock disponible − stock comprometido
objetivo         = max(demanda diaria × horizonte, stock mínimo)  acotado al stock máximo
cantidad sugerida = ceil(objetivo − stock neto)   (nunca negativa)
```

El **estado** (`crítico`, `comprar ahora`, `revisar`, `normal`, `sobrestock`) y la **prioridad** (alta/media/baja) se derivan de la cobertura en días vs. el lead time y de la rotación. Solo se sugiere comprar cuando hay riesgo de quiebre o necesidad real; si hay sobrestock, la sugerencia es 0 y se alerta el capital inmovilizado.

## 10. Cómo conectar esto después a un backend real

1. Reemplazar los imports de `src/data/*` por llamadas a una capa de servicios (ej. `src/services/*`) con `fetch`/Axios + React Query/SWR.
2. Mover los cálculos de `utils/calculations.ts` al backend (`purchasing-service`) y consumir el resultado ya calculado; mantener los del front solo como fallback/preview.
3. Sustituir el estado local de acciones (OcDraft, cambios de estado de alertas/OC) por mutaciones a la API.
4. Añadir autenticación y el comprador real en el Topbar.

## 11. Endpoints futuros recomendados

```
GET   /purchasing/dashboard
GET   /purchasing/recommendations
GET   /purchasing/products
GET   /purchasing/products/:sku
GET   /purchasing/categories
GET   /purchasing/suppliers
GET   /purchasing/purchase-orders
POST  /purchasing/purchase-orders
POST  /purchasing/purchase-orders/from-recommendations
GET   /purchasing/alerts
PATCH /purchasing/alerts/:id/status
GET   /purchasing/inventory-analysis
GET   /purchasing/sales-analysis
GET   /purchasing/rules
PATCH /purchasing/rules
GET   /purchasing/campaign-opportunities
GET   /purchasing/campaign-opportunities/:id
POST  /purchasing/campaign-opportunities/:id/add-to-purchase-order
PATCH /purchasing/campaign-opportunities/:id/status
GET   /purchasing/campaigns
GET   /purchasing/campaigns/:id/products
```

> La UX se rediseñó a fondo para que sea didáctica y accionable, y se agregó la vista
> **Campañas y oportunidades**. El detalle está en [UX_IMPROVEMENTS.md](UX_IMPROVEMENTS.md).

### Microservicios con los que debería integrarse

- **catalog-service** — productos, SKUs, categorías, marcas.
- **pricing-service** — precios, costos, márgenes.
- **inventory-service-v3** — stock total/disponible/comprometido y por tienda/bodega.
- **supplier-service / comerce-service** — proveedores y datos comerciales.
- **oms-service-v2** — venta histórica, demanda, pedidos, venta perdida.
- **purchasing-service** (futuro) — recomendaciones, órdenes de compra, reglas de reposición, campañas y oportunidades.
- **marketplace-service** — performance por marketplace para campañas y oportunidades.
- **trace-service** — trazabilidad de cambios y decisiones de compra.
- **notification-service** — envío de alertas a compradores.
- **document-generator-service** — generación de OC en PDF / Excel.

## 12. Próximos pasos sugeridos

- Persistir borradores de OC y estados de alertas en backend.
- Exportar tablas (Reposición, OC) a Excel/PDF.
- Gráficos de tendencia real (ej. Recharts) cuando exista histórico por API.
- Multi-usuario con permisos por rol (comprador, jefe de categoría, gerencia).
- Configuración de reglas con simulación: "ver impacto en la compra sugerida".
- Tests (Vitest + Testing Library) sobre `calculations.ts` y filtros.
```

---

**Demo con datos mock. Sin backend.** Toda la interfaz está en español y usa formato chileno.
