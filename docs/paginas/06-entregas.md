# Entregas: recepciones, plan de retiro, importaciones y reclamos

Documentación técnica de los módulos que cierran el ciclo de compra una vez emitida la
orden: qué llegó, cómo se retira, cómo se importa y qué hacer cuando el proveedor falla.

## Tabla de contenidos

1. [ReceptionsPage](#1-receptionspage)
2. [ReceptionDetail](#2-receptiondetail)
3. [helpers.ts (receptions)](#3-helpersts-receptions)
4. [PlanRetiroPage](#4-planretiropage)
5. [ImportsPage](#5-importspage)
6. [ClaimsPage](#6-claimspage)
7. [Hallazgos de clean-code](#7-hallazgos-de-clean-code)

---

## 1. ReceptionsPage

### Ruta y archivo
`src/pages/ReceptionsPage.tsx` — rutas `/recepciones` y `/comprar/recepciones` (alias, mismo
componente) en `src/routes/AppRoutes.tsx`. Carga diferida (`lazy`) como `ReceptionsPage`.

### Propósito
Vista de compras de qué mercadería viene en camino, qué llegó y, sobre todo, qué SKUs
pedidos **no despachó** el proveedor, para poder reordenarlos antes de que generen quiebre.
Para el líder agrega una vista de equipo: qué proveedor incumple y qué comprador debe
reordenar.

### Fuentes de datos
- `src/data/mockReceptions.ts`: array `receptions` y mapa de estilos `RECEPTION_STATUS`.
- `src/data/mockProducts.ts`: `getProductBySku` (para tomar el costo unitario al reordenar).
- `src/utils/supplierPerf.ts`: `supplierFulfillment(supplierName)` — % de despacho y
  cumplimiento a tiempo del proveedor.
- `src/utils/filters.ts`: `uniqueValues` (opciones del selector de proveedor).
- `src/utils/formatters.ts`: `formatDate`, `formatNumber`, `formatPercent`.
- `src/utils/entityLinks.ts`: `supplierPath`.
- `src/context/BuyerContext.tsx` (`useBuyer`), `src/context/RoleContext.tsx` (`useRole`),
  `src/context/OcDraftContext.tsx` (`useOcDraft`: `addItem`, `hasItem`), `src/context/ToastContext.tsx`
  (`useToast`).

### Estado y navegación
- `useUrlState` (query string) para: `alcance` (scope: `todos`/`mias`/nombre de comprador,
  solo relevante para líder), `tab` (`undelivered`/`arriving`/`delayed`/`issues`/`received`/`all`),
  `q` (búsqueda), `prov` (proveedor), `desde`/`hasta` (rango de fecha).
- `useState<Reception | null>` para `detail` (recepción abierta en el `Drawer`).
- Deep-link `?rid=REC-XXX`: un `useEffect` observa `searchParams.get("rid")` y abre el
  detalle de esa recepción automáticamente; `closeDetail()` limpia el parámetro `rid` de la URL.
- El líder aterriza por defecto en la pestaña `undelivered`; el comprador individual en
  `arriving`, y su `scope` queda fijo en `mias` (no puede ver `todos`).
- Botón "Reordenar" navega a `/comprar/seguimiento` vía el toast de confirmación (acción del toast).

### Estructura visual
- `PageHeader` con descripción distinta según rol (líder vs comprador).
- `Select` "Viendo" (solo líder) para cambiar el alcance de equipo.
- `FilterBar`: búsqueda, selector de proveedor, rango de fechas, resumen de contadores.
- Fila de 5 `KpiCard` que actúan como selector de pestaña (`active`/`onClick` en vez de tabs
  tradicionales): "No despachado", "Por llegar", "Atrasadas", "Con problemas", "Recibidas".
- Línea de contexto "Mostrando…" con el nombre de la vista activa y enlace "Ver todas".
- Pestaña `undelivered`: `HelpNote` explicativa, `CollapsibleSection` "Responsables de
  reordenar" (solo si hay más de un comprador con pendientes) y una lista de `Card` agrupadas
  por proveedor con badge de rendimiento (`supplierFulfillment`) y botón "Reordenar" por línea.
- Resto de pestañas: `DataTable` con columnas Orden/Proveedor, Esperada/Recibida, Recepción
  (barra de progreso), Calidad, Estado y acción; incluye `mobileCard` para vista móvil.
- `Drawer` de detalle que renderiza `ReceptionDetail`, con botón de pie "Reordenar todo lo no
  despachado" cuando aplica.

### Lógica de negocio clave
- **Recepción vs. pedido y "no despachado"**: por cada línea de cada recepción ya llegada
  (`ARRIVED = ["received", "partial", "with_issues"]`), si `received < expected` se considera
  una línea "no despachada" (`missing = expected - received`). Estas líneas se agregan y
  ordenan (`undeliveredLines`, mayor faltante primero) y se agrupan tanto por proveedor
  (`bySupplier`, quién incumple) como por comprador responsable (`byBuyer`, quién debe
  reordenar) — esto último solo visible para el líder.
- El `scope` filtra `receptions` por comprador (`buyer === target`) antes de aplicar el resto
  de filtros de texto/fecha/proveedor.
- `reorder()` evita duplicar líneas ya presentes en el borrador de OC (`hasItem`), toma el
  costo del producto (`getProductBySku(sku)?.cost ?? 0`) y agrega la cantidad faltante al
  borrador, mostrando un toast con acceso directo al borrador.
- `pct()` calcula el % de recepción (`unitsReceived / unitsExpected`) usado tanto en la barra
  de progreso de la tabla como en la tarjeta móvil.

### Subcomponentes definidos en el archivo
Ninguno: es un único componente de página (`ReceptionsPage`) que delega el detalle a
`ReceptionDetail` (archivo aparte).

---

## 2. ReceptionDetail

### Ruta y archivo
`src/pages/receptions/ReceptionDetail.tsx` — no es una ruta propia; se renderiza dentro del
`Drawer` de `ReceptionsPage` (ver deep-link `?rid=`).

### Propósito
Detalle por SKU de una recepción: cuánto llegó vs. lo pedido, rendimiento histórico del
proveedor, impacto en cobertura de stock y acciones para reordenar lo faltante o abrir un
reclamo.

### Fuentes de datos
- `src/data/mockReceptions.ts`: `RECEPTION_STATUS`.
- `src/data/mockProducts.ts`: `getProductBySku`.
- `src/utils/supplierPerf.ts`: `supplierFulfillment`.
- `src/utils/calculations.ts`: `coverageDays`.
- `src/utils/formatters.ts`: `formatDate`, `formatNumber`.
- `src/utils/entityLinks.ts`: `productPath`.
- `src/utils/constants.ts`: `TODAY_ISO`.
- `src/context/ClaimsContext.tsx` (`useClaims`: `addClaim`, `exists`; función `suggestedResolution`).
- `src/context/ToastContext.tsx` (`useToast`).
- `./helpers` (`lineStatus`).

### Estado y navegación
Componente sin estado propio (recibe `detail`, `reorder`, `hasItem` por props desde
`ReceptionsPage`). Usa `useNavigate` para el botón "Ver reclamos" del toast tras crear un
reclamo, llevando a `/reclamos`.

### Estructura visual
- Aviso de impacto (rosado) si hay SKUs bajo cobertura mínima por causa de la recepción
  parcial.
- Grilla de 3 columnas: fecha esperada, fecha recibida, estado (`Badge`).
- Bloque "Rendimiento del proveedor": % despacho completo, % entrega a tiempo, SKUs sin
  despachar histórico, con nota de advertencia si el `tone` no es verde.
- Nota de calidad (`qualityNote`) si existe.
- Lista de tarjetas por línea/SKU: cantidades pedido/recibido, badge de estado de línea
  (`lineStatus`), nota de incidencia (`issue`), estimación de días de cobertura restante y
  botones "Reordenar" / "Crear reclamo" (deshabilitado si ya existe reclamo para esa OC+SKU).

### Lógica de negocio clave
- **Impacto de recepción parcial**: para cada línea con faltante, si el producto tiene ventas
  (`salesLast30Days > 0`) calcula `coverageDays` y lo compara con
  `Math.max(7, p.supplierLeadTimeDays)` (mínimo 7 días o el lead time del proveedor, el que
  sea mayor) para marcarla `atRisk`; el resultado (`impacted`) se ordena por cobertura
  ascendente y alimenta el aviso superior con el caso más urgente.
- **Máquina de reclamos (creación desde recepción)**: `createClaim(it)` decide el `tipo` de
  reclamo así — si hay faltante (`missing > 0`) es `"faltante"`; si no, evalúa el texto de
  `it.issue` contra una expresión regular de palabras clave de calidad
  (`calidad|humedad|manch|defect|vary|separaci`) para clasificar como `"calidad"`, y si no
  matchea, `"dano"`. La cantidad reclamada es el faltante, o si no hay faltante, una
  estimación de 10% de lo recibido (`Math.max(1, Math.round(it.received * 0.1))`). El valor
  reclamado es `cantidad × costo` del producto. La resolución sugerida sale de
  `suggestedResolution(tipo)` (contexto `ClaimsContext`). El reclamo nace en estado
  `"abierto"`, con `responsable = detail.buyer` y `fecha = TODAY_ISO`.
- El botón "Crear reclamo" se deshabilita si `exists(poNumber, sku)` ya es verdadero,
  evitando reclamos duplicados por la misma línea.

### Subcomponentes definidos en el archivo
Ninguno (componente único `ReceptionDetail`).

---

## 3. helpers.ts (receptions)

### Ruta y archivo
`src/pages/receptions/helpers.ts` — módulo de utilidades, no es una página ni ruta.

### Propósito
Clasificar el estado de una línea de recepción (`ReceptionItem`) en una etiqueta y color de
badge reutilizable.

### Fuentes de datos
Solo tipos: `src/types/purchasing.ts` (`ReceptionItem`). Sin dependencias de datos ni contexto.

### Estado y navegación
No aplica (función pura, sin estado).

### Estructura visual
No aplica (no renderiza UI).

### Lógica de negocio clave
`lineStatus(it)`: si `received >= expected` → `{ label: "Completo", tone: "green" }`; si
`received === 0` → `{ label: "No despachado", tone: "red" }`; en cualquier otro caso →
`{ label: "Parcial", tone: "amber" }`. Es la única fuente de verdad para este badge y la usan
tanto `ReceptionsPage` (agrupado por proveedor en la pestaña "No despachado") como
`ReceptionDetail` (cada línea del detalle).

### Subcomponentes definidos en el archivo
No aplica — expone una única función (`lineStatus`).

---

## 4. PlanRetiroPage

### Ruta y archivo
`src/pages/PlanRetiroPage.tsx` — ruta `/comprar/plan-retiro`.

### Propósito
Simulación logística del **borrador de OC en curso**: no es un módulo aparte del flujo de
compra, sino una vista que traduce el borrador (SKUs y cantidades) en un plan de retiro físico
(camiones, capacidad, fechas, costo).

### Fuentes de datos
- `src/context/OcDraftContext.tsx` (`useOcDraft`: `items`, `count`, `totalAmount`).
- `src/utils/formatters.ts`: `formatCurrency`.
- `src/components/business/LogisticsPlan.tsx`: `LogisticsPlanView` (motor de cálculo y
  render del plan; no es un subcomponente de este archivo, se importa completo).

### Estado y navegación
Sin `useState` propio; deriva `lines` con `useMemo` a partir de `items` del borrador
(`{ sku, productName, quantity }`). Botón de cabecera "Volver al borrador" y el CTA del
`EmptyState` navegan a `/comprar/borradores` (`useNavigate`).

### Estructura visual
- `PageHeader` con acción "Volver al borrador".
- Si `count === 0`: `Card` con `EmptyState` invitando a armar un borrador.
- Si hay ítems: `HelpNote` con el resumen (SKU y monto del borrador) y `LogisticsPlanView`
  (componente externo que dibuja el detalle de camiones/capacidad/costo).

### Lógica de negocio clave
La página no calcula logística por sí misma: es un adaptador delgado que transforma
`OcDraftItem[]` al formato de entrada de `LogisticsPlanView` y le entrega el control. Todo el
cálculo de camiones, capacidad y costo vive en `src/components/business/LogisticsPlan.tsx`
(fuera del alcance de este documento).

### Subcomponentes definidos en el archivo
Ninguno (componente único `PlanRetiroPage`).

---

## 5. ImportsPage

### Ruta y archivo
`src/pages/ImportsPage.tsx` — ruta `/importaciones`.

### Propósito
Torre de control de compras importadas: estado del proceso (proforma → bodega), fechas
ETD/ETA, documentación pendiente y costo puesto en bodega (landed cost), con simulador de
tipo de cambio.

### Fuentes de datos
- `src/data/mockImports.ts`: `imports` (seed), `IMPORT_STAGE` (metadata de cada etapa),
  `IMPORT_PIPELINE` (orden de las etapas para la barra de proceso).
- `src/utils/importCost.ts`: `importLanded(imp, tipoCambioOverride?)`, `daysToEta(eta, today)`.
- `src/utils/constants.ts`: `TODAY_ISO`.
- `src/utils/formatters.ts`: `formatCurrency`, `formatCurrencyCompact`, `formatDate`, `formatNumber`.
- `src/utils/cn.ts`: `cn` (clases condicionales).

### Estado y navegación
- `useState<ImportOrder | null>` (`detail`) para abrir el `Modal` de detalle.
- Dentro de `ImportDetailModal`, `useState<number>` (`tc`) para el tipo de cambio simulado,
  inicializado en `imp.tipoCambio`.
- Sin filtros de URL ni tabs; lista plana de todas las importaciones (`seedImports.map`).

### Estructura visual
- `PageHeader`.
- 4 `KpiCard`: "Importaciones en curso" (excluye las que ya están en `"bodega"`), "Capital en
  importación" (suma de `landed` de las activas), "Próxima llegada" (ETA mínima), "Documentos
  pendientes".
- Lista de `Card` clicables por importación: badge de etapa, ID, incoterm, proveedor, ruta
  origen→puerto, contenedor, SKU count, ETA (con "hace/hoy/mañana/en Nd" vía `whenEta`), costo
  puesto en bodega y badge de documentos pendientes.
- `ImportDetailModal` (abre en `Modal` `size="xl"`): barra de pipeline (`IMPORT_PIPELINE`),
  grilla de campos (`Field`: naviera, ETD, ETA, fecha en bodega, moneda, FOB, anticipo, OC
  asociada), bloque simulador de costo puesto en bodega con `Input` numérico de tipo de cambio
  y desglose de líneas (`Row`: FOB, arancel, flete, portuarios, terrestre, aduana, total), y
  grilla de documentación con iconos de OK/pendiente.

### Lógica de negocio clave
- **Costo puesto en bodega (landed cost)**: delegado a `importLanded()` en
  `src/utils/importCost.ts`. Convierte el FOB a CLP con el tipo de cambio (`fobClp`), calcula
  el arancel sobre ese monto (`arancelPct`), y suma flete internacional, gastos portuarios,
  transporte terrestre y agente de aduana (montos fijos del pedido) para obtener `landed`.
  También expone `extraPct` (sobrecosto % sobre FOB) y `perSku`.
- El modal recalcula `importLanded(imp, tc)` en cada cambio del input de tipo de cambio
  (`sim`) y lo compara contra el valor base (`base = importLanded(imp)`) para mostrar el
  delta (`sim.landed - base.landed`) en rojo/verde sin mutar el dato original — es una
  simulación pura, no persiste cambios.
- "Importaciones en curso" para el KPI y el capital inmovilizado excluyen las que ya están en
  etapa `"bodega"` (`active = seedImports.filter(i => i.stage !== "bodega")`).
- `whenEta(d)` traduce el delta de días de `daysToEta` a texto legible: negativo → "hace Nd",
  `0` → "hoy", `1` → "mañana", resto → "en Nd".

### Subcomponentes definidos en el archivo
- `ImportDetailModal` — modal de detalle con pipeline, simulador de landed cost y documentos.
- `Field` — par etiqueta/valor de la grilla de datos generales.
- `Row` — fila etiqueta/monto del desglose de costo.

---

## 6. ClaimsPage

### Ruta y archivo
`src/pages/ClaimsPage.tsx` — ruta `/reclamos`.

### Propósito
Gestión de reclamos a proveedores (faltantes, daños, calidad, costo, etc.): qué está en
juego económicamente, quién responde y cómo se resuelve; alimenta la evaluación del
proveedor.

### Fuentes de datos
- `src/context/ClaimsContext.tsx` (`useClaims`: `claims`, `updateClaim`, `addClaim`).
- `src/context/TraceContext.tsx` (`useTrace`: `log`, para el historial de auditoría).
- `src/context/ToastContext.tsx` (`useToast`).
- `src/data/mockClaims.ts`: `CLAIM_TYPE`, `CLAIM_STATUS`, `CLAIM_RESOLUTION`,
  `CLAIM_OPEN_STATES`, `claimTypeMeta`, `claimStatusMeta`, `claimResolutionLabel`.
- `src/utils/entityLinks.ts`: `supplierPath`.
- `src/utils/formatters.ts`: `formatCurrency`, `formatCurrencyCompact`, `formatDate`.

### Estado y navegación
- `useState<"abiertos" | "todos" | "resueltos">` (`filter`), por defecto `"abiertos"`. No
  está sincronizado con la URL (a diferencia de `ReceptionsPage`).
- `useState<SupplierClaim | null>` (`managing`) — abre `ManageClaimModal`.
- `useState<boolean>` (`creating`) — abre `CreateClaimModal`.
- Dentro de `ManageClaimModal`: `estado`, `resolucion`, `notaCredito` (estado local del
  formulario, inicializado desde el reclamo).
- Dentro de `CreateClaimModal`: campos del formulario (`poNumber`, `supplierName`,
  `productName`, `sku`, `tipo`, `cantidad`, `valor`, `motivo`, `error`).
- Sin navegación a otras rutas desde esta página (los enlaces de proveedor van a
  `supplierPath`).

### Estructura visual
- `PageHeader` con acción "Nuevo reclamo".
- 4 `KpiCard`: "Reclamos abiertos", "Valor en juego" (suma de `valorReclamado` de abiertos),
  "Resueltos", "Recuperado" (suma de reclamos resueltos con resolución que implica
  recuperación).
- Fila de `Chip` para el filtro (`abiertos`/`resueltos`/`todos`).
- `DataTable` con columnas OC/Proveedor, Producto, Motivo (tipo + texto), Valor reclamado
  (ordenable), Fecha/límite, Estado (+ resolución), acción "Gestionar"; incluye `mobileCard`.
- `ManageClaimModal`: `Select` de estado y resolución, `Input` de N° de nota de crédito
  (solo si `resolucion === "nota_credito"`).
- `CreateClaimModal`: formulario completo (proveedor, OC, producto, SKU, tipo, cantidad,
  valor, motivo) con validación mínima.

### Lógica de negocio clave
- **Máquina de estados de reclamos**: `CLAIM_OPEN_STATES = ["abierto", "en_gestion",
  "aceptado"]` (definida en `mockClaims.ts`) determina qué cuenta como "abierto" tanto en el
  filtro de esta página como en `ClaimsContext.openClaims`. Los estados cerrados son
  `"resuelto"` y `"rechazado"`. La resolución (`ClaimResolution`) es independiente del estado:
  `pendiente`, `nota_credito`, `reposicion`, `descuento`, `aceptado_sin_ajuste`.
  `RESUELTO_RECUPERA = ["nota_credito", "reposicion", "descuento"]` (constante local de esta
  página) define qué resoluciones cuentan como "valor recuperado" para el KPI.
- Editar un reclamo (`ManageClaimModal`) solo actualiza `estado`, `resolucion` y
  `notaCredito` (`Partial<SupplierClaim>` acotado); si el estado cambió, se registra en el
  log de trazabilidad (`useTrace().log`) con el actor hardcodeado `"Catalina Saavedra"`.
- Crear un reclamo manual (`CreateClaimModal`) siempre nace en `estado: "abierto"`,
  `resolucion: "pendiente"`, con `responsable` también hardcodeado a `"Catalina Saavedra"` y
  `fecha` tomada de `new Date().toISOString().slice(0, 10)` (no usa `TODAY_ISO`, a diferencia
  de `ReceptionDetail`).
- Los reclamos creados desde una recepción con diferencia (ver `ReceptionDetail.createClaim`)
  aparecen aquí automáticamente porque comparten el mismo `ClaimsContext` (persistido en
  `localStorage`, clave `"compras:claims"`).

### Subcomponentes definidos en el archivo
- `ManageClaimModal` — edita estado/resolución/nota de crédito de un reclamo existente.
- `CreateClaimModal` — formulario de alta manual de un reclamo.

---

## 7. Hallazgos de clean-code

Ver lista de hallazgos en la respuesta del agente (formato `archivo:línea — problema —
acción sugerida`). No se modificó ningún archivo `.ts`/`.tsx`; estos son solo puntos de
atención documentados.
