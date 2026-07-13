# Módulo: Inicio y Mi Cartera

> Levantamiento funcional realizado **solo desde el frontend** (React + TypeScript). La aplicación funciona con **datos mock deterministas y síncronos** (sin backend): no existen estados reales de carga ni de error de red, salvo que se indique explícitamente. Todo lo aquí descrito se deduce del código de los componentes, textos, handlers, props, filtros y navegación (`navigate()` / `<Link>`).

## Contexto técnico compartido por el módulo

- **Página física única para Inicio y Mi Cartera:** las rutas `/`, `/mi-cartera` y sus sub-rutas renderizan el mismo componente `MyPanelPage` (registrado en el router como `InicioPage`). El componente decide qué mostrar según la URL:
  - `location.pathname.startsWith("/mi-cartera")` ⇒ `isPortfolioView = true` (vista "Mi cartera").
  - En `/` ⇒ `isPortfolioView = false` (vista "Inicio / portada operativa del día").
  - El **foco de cartera** (`portfolioFocus`) se deriva del path: `resumen` (en `/mi-cartera`), `productos-clave`, `marcas`, `proveedores` u `oportunidades`. Son **pestañas internas por ruta**, no un componente de tabs con estado local.
- **Comprador actual (`BuyerContext`):** el comprador se guarda en `localStorage` (`compras:buyer`, por defecto `"Catalina Saavedra"`). `myCategories` = nombres de categorías cuyo campo `buyer` coincide con el comprador actual. Se cambia de comprador desde la barra superior (fuera del alcance de este módulo).
- **Rol (`RoleContext`):** roles `comprador` y `lider`. El rol define el alcance por defecto del `ScopeToggle` (líder ⇒ `"all"`, comprador ⇒ `"mine"`), preferencia compartida entre vistas vía `localStorage` (`compras:scope`).
- **Borrador de OC (`OcDraftContext`):** `addItem`, `hasItem`, `items`, `count`, `totalAmount`. Es el "carrito" de compra que alimenta el flujo de órdenes de compra (otro módulo).
- **Datos mock consumidos:** `mockProducts`, `mockCategories`, `mockSuppliers`, `mockRecommendations`, `mockPurchaseOrders`, `mockAlerts`, `mockChannelMargin`, `mockReceptions`, `mockRules`, señales (`SignalsContext` / `signalService`), aprobaciones (`PurchaseFlowContext`), oportunidades perdidas (`lostOpportunities`).

---

# Pantalla 1 · Inicio (portada operativa del día)

## Nombre
Inicio — "Hola, {nombre del comprador}" (portada operativa diaria).

## Ruta(s)
- `/` (renderiza `MyPanelPage` con `isPortfolioView = false`).
- `/mi-panel` redirige de forma permanente a `/` (`<Navigate to="/" replace />`).

## Módulo
Inicio y Mi Cartera.

## Objetivo funcional
Dar al comprador una **portada de trabajo del día**: qué decisiones tiene pendientes, cuáles son urgentes hoy, dónde continuar el trabajo (borrador de OC), y los pendientes operativos (riesgos de quiebre, OC por recibir, proveedores por revisar, sobrestock, venta no capturada y señales de ventas).

## Tipo de usuario
Comprador (vista personal, filtrada por `buyer` y sus categorías). Accesible también para líder, pero los datos siguen siendo los del comprador seleccionado en la barra superior (no hay un modo "equipo" en esta pantalla). No hay `RoleGate` sobre esta ruta.

## Descripción detallada
La página arma una **"agenda de decisiones"** combinando varias fuentes y ordenándolas por prioridad e impacto. Sobre esa agenda muestra una tarjeta destacada (la decisión #1), luego 4 pendientes secundarios, y tres tarjetas de apoyo (Prioridad recomendada, Continuar trabajo, Señales de cartera). Debajo, una grilla de "Trabajo del día" con tablas/listas operativas, y al final "Venta no capturada" y "Señales de ventas para mí".

## Información que muestra
- **Encabezado (`PageHeader`):** título `Hola, {primer nombre}`; descripción `{fecha de hoy} · {N} decisiones pendientes · {N} requieren atención hoy`. Botón de acción "Ir a reposición" (→ `/comprar/decisiones`).
- **Bloque Agenda de decisiones:**
  - Titular `{hoy} requieren atención hoy · {semana} esta semana`.
  - 3 estadísticas: **Decisiones** (total agenda), **Impacto** (suma de `impactValue` de los 7 primeros por prioridad, en moneda compacta), **Críticas** (ítems con `days <= 0`).
  - Pestañas de filtro (chips): **Prioridad**, **Hoy**, **Semana**, **Después**, cada una con su contador.
  - **Tarjeta destacada** (primer ítem según vista): badge de tipo, etiqueta de urgencia, título, meta, impacto, recomendación y botón de acción.
  - **Hasta 4 pendientes secundarios** (ítems 2–5) como enlaces con tipo, urgencia, título, meta, impacto y etiqueta de acción.
  - Enlace "Ver agenda completa" → `/comprar/decisiones`.
- **Tarjeta "Prioridad recomendada":** repite el ítem destacado (título, impacto, recomendación) con botón "Revisar". Si no hay agenda: "Sin prioridad crítica".
- **Tarjeta "Continuar trabajo":** si hay borrador de OC activo, muestra `{count} SKU · {total} preparados`, botón "Continuar" (→ `/comprar/borradores`) y el último SKU agregado. Si no hay borrador: "Sin borrador activo" + botón "Ir a decisiones".
- **Tarjeta "Señales de cartera":** 4 mini-indicadores — **Riesgos** (`riskRows.length`), **OC pendientes** (`myOpenOrders.length`), **Proveedor** (`mySuppliersToReview.length`), **Sobrestock** (valor en moneda compacta).
- **Trabajo del día** (grilla de 2 columnas):
  - **Mis productos en riesgo de quiebre** (tabla `DataTable`): SKU, nombre, categoría · proveedor, frase de cobertura, stock disponible, venta 30d, quiebre estimado (fecha o "En quiebre"), compra sugerida (u. + cobertura resultante), y botón "Agregar a OC" / "En OC".
  - **Órdenes de compra sin recibir:** lista de OC abiertas del comprador con número, proveedor, fecha esperada, badge de días de atraso y estado.
  - **Proveedores por revisar:** proveedores en estado `review/delayed/inactive` con cumplimiento, última compra y estado.
  - **Mi inventario con sobrestock:** productos con `purchaseStatus === "overstock"`, disponible, días de inventario y capital inmovilizado (moneda).
- **Venta no capturada** (solo si hay oportunidades perdidas del comprador): total mensual perdido + hasta 4 productos con motivo, venta histórica mensual y venta perdida/mes.
- **Señales de ventas para mí** (`CollapsibleSection`): hasta 5 señales pendientes (`new`/`in_review`) asignadas al comprador o de sus categorías sin asignar, ordenadas por prioridad y fecha; badges de prioridad, tipo y estado + comentario.

## Secciones/bloques
1. Encabezado con acción.
2. Agenda de decisiones (stats + pestañas + destacado + secundarios).
3. Trío de tarjetas (Prioridad recomendada / Continuar trabajo / Señales de cartera).
4. Trabajo del día (riesgo de quiebre, OC sin recibir, proveedores por revisar, sobrestock).
5. Venta no capturada (condicional).
6. Señales de ventas para mí (colapsable).

## Filtros disponibles
- **Pestañas de la agenda:** `prioridad` (todas), `hoy` (`days <= 0`), `semana` (`0 < days <= 7`), `despues` (`days > 7`). Estado local `agendaView` (`useState`). No hay filtros por texto, categoría ni proveedor en esta pantalla.

## Acciones del usuario
- Cambiar la vista de la agenda entre Prioridad/Hoy/Semana/Después.
- Ir a la acción de un ítem (navegación contextual según `to`).
- **Agregar a OC** desde la tabla de riesgo de quiebre (agrega el producto con la cantidad sugerida al borrador; muestra un toast con enlace "Ver borrador OC").
- Continuar el borrador de OC activo.
- Navegar a reposición, decisiones, seguimiento de OC, proveedores, inventario, producto, señales de ventas, venta no capturada.

## Botones y controles
- `PageHeader` → botón **"Ir a reposición"** (`/comprar/decisiones`).
- Chips de agenda (Prioridad / Hoy / Semana / Después).
- Botón **"Revisar"** (destacado) → `featuredAgenda.to`.
- Botón **"Continuar"** → `/comprar/borradores` (o "Ir a decisiones" si no hay borrador).
- Botón por fila **"Agregar a OC" / "En OC"** (deshabilitado si ya está en el borrador o si `suggestedQty <= 0`).
- Enlaces "Ver agenda completa", "Ver reposición", "Ver todas", etc.

## Tablas/tarjetas/formularios/componentes relevantes
- `PageHeader`, `Card`/`CardBody`/`CardHeader`, `DataTable` (con `mobileCard`), `Badge`, `StatusBadge`, `Button`, `EmptyState`, `CollapsibleSection`, íconos.
- Componentes locales de `myPanel/components.tsx`: `AgendaStat`, `SignalSummary`, `SectionLabel`.
- **No hay formularios** en esta pantalla (solo acción de agregar cantidad sugerida ya calculada).

## Campos de cada formulario
No aplica (sin formularios).

## Estados posibles
- **Con datos:** estado principal (mock siempre entrega datos para el comprador por defecto).
- **Vacía / sin resultados parciales:** existen `EmptyState` específicos: agenda sin ítems ("Sin decisiones pendientes"), sin OC pendientes, proveedores al día, sin sobrestock, riesgo de quiebre vacío ("No tienes productos en riesgo de quiebre. ¡Bien!"), señales al día. La sección "Venta no capturada" no se renderiza si no hay oportunidades.
- **Cargando:** no aplica en la página (datos síncronos); el router sí envuelve la ruta en `Suspense` con `PageLoader` para la carga diferida del bundle.
- **Error:** no existe manejo de error de datos (mock). Un comprador sin categorías produciría listas vacías, no un error.

## Navegación hacia otras pantallas
- `/comprar/decisiones` (reposición / agenda completa / focos de riesgo).
- `/comprar/borradores` (borrador de OC).
- `/comprar/seguimiento?oc={número}` (seguimiento de OC).
- `/comprar/aprobaciones` (ítems de aprobación).
- `/productos/{sku}` (detalle de producto, incluida la tabla de riesgo por clic de fila).
- `/proveedores` (proveedores por revisar).
- `/inventario` (foco de sobrestock desde señales/focos).
- `/senales-ventas` (señales).
- `/venta-no-capturada` (oportunidades perdidas).
- Y la acción del encabezado a `/comprar/decisiones`.

## Flujo funcional completo
1. Al abrir `/`, el comprador ve la fecha, cuántas decisiones tiene y cuántas son de hoy.
2. La app construye la agenda cruzando: riesgos de quiebre, aceleraciones/desaceleraciones de venta, OC abiertas, proveedores por revisar, sobrestock y aprobaciones. Ordena por prioridad, impacto y días.
3. El comprador atiende primero la decisión destacada (mayor prioridad/impacto) o filtra por Hoy/Semana.
4. Puede agregar directamente al borrador de OC los productos en riesgo (con cantidad sugerida).
5. Revisa pendientes operativos (OC sin recibir, proveedores, sobrestock) y señales del terreno.
6. Continúa el trabajo desde el borrador activo o avanza a reposición/decisiones.

## Reglas de negocio inferibles
- **Riesgo de quiebre:** un SKU entra si `salesLast30Days > 0` y (`availableStock <= 0` o cobertura ≤ `2 × leadTime`). La cantidad sugerida sale de la recomendación mock o, en su defecto, del cálculo `calculateSuggestedPurchase` (objetivo 45 días de inventario, con factor estacional por categoría).
- **Prioridad de agenda:** quiebre activo (sin stock) = máxima prioridad (1000); OC atrasada suma según días; aprobaciones y aceleraciones con poca cobertura son altas; sobrestock es baja ("Después").
- **Urgencia textual:** "CRÍTICO · HOY", "ALTA PRIORIDAD", "ATRASADO · N DÍAS", "REQUIERE DECISIÓN", "DESPUÉS", etc.
- **Alcance personal:** todo se filtra por `buyer` (OC, aprobaciones) y por `myCategories` (productos, señales sin asignar, oportunidades perdidas).
- **OC abierta:** OC del comprador cuyo estado no es `received` ni `cancelled`.
- **Señales que "me tocan":** estado `new`/`in_review` y (asignadas a mí, o de mis categorías sin comprador asignado). Máximo 5, orden por prioridad y luego fecha desc.

## Validaciones necesarias
- Botón "Agregar a OC" deshabilitado si el SKU ya está en el borrador (`hasItem`) o si la cantidad sugerida es ≤ 0. No hay más validaciones (no hay entradas de texto/números editables).

## Permisos/restricciones deducibles
- Vista personal atada al comprador seleccionado. No hay diferenciación de contenido por rol en esta pantalla; el líder ve la misma portada del comprador actual (no un consolidado de equipo).

## Dudas funcionales / definiciones pendientes
- **Suposición:** el "impacto" (venta en riesgo, capital expuesto) es un cálculo indicativo mock, no un valor financiero validado.
- **Definición pendiente:** al cambiar de comprador se recalcula todo; no está claro si un líder debería ver un consolidado del equipo en Inicio (hoy no existe).
- **Definición pendiente:** varios badges de "+3 vs mes anterior" y bases de "mes anterior" son estimaciones derivadas del maestro (no hay serie temporal real).

---

# Pantalla 2 · Mi Cartera (resumen ejecutivo)

## Nombre
Mi cartera · {comprador} — resumen.

## Ruta(s)
- `/mi-cartera` (`portfolioFocus = "resumen"`).

## Módulo
Inicio y Mi Cartera.

## Objetivo funcional
Entregar una **lectura de negocio** de la cartera del comprador: cómo está funcionando (venta, margen, GMROI, rotación, cobertura), si va camino a sus metas, cuál es la salud del catálogo, dónde están los principales focos, cuáles son los productos estratégicos, marcas y proveedores, oportunidades, tendencias, categorías y calidad de datos.

## Tipo de usuario
Comprador (con foco en su cartera). Líder puede acceder, pero el contenido sigue el comprador seleccionado.

## Descripción detallada
Página de análisis (no operativa) que se apoya en `portfolio`, `portfolioInsights`, `salesPace` y `story` (todos memos derivados de `myProducts`). Presenta primero "¿qué administro?", luego objetivos, resumen ejecutivo con tendencia, salud + focos, estratégicos, marcas/proveedores, oportunidades, tendencias, categorías y calidad.

## Información que muestra
- **Encabezado:** título `Mi cartera · {comprador}`; descripción sobre venta/margen/inventario/cobertura/surtido/proveedores. Botón "Ver decisiones" → `/` (nota: en vista de cartera el botón lleva de vuelta a Inicio).
- **"Mi cartera — ¿qué administro?":** nombres de categorías del comprador; conteos `N SKU · N subcategorías · N proveedores · N marcas`; chips-enlace a Categorías (`/categorias`), Marcas (`/productos`), Proveedores (`/proveedores`) y "Ver detalle →" (`/mi-cartera/productos-clave`).
- **Objetivos del mes** (4 `GoalBar`): Venta (meta = venta × 1,18 redondeada), Margen (meta 33%), Sobrestock (meta < $3.000.000, barra invertida), Disponibilidad (meta 96%).
- **Resumen ejecutivo** (8 `TrendKpi`): Venta 30d (Δ% tendencia), Margen (Δ pp), GMROI, Rotación, Cobertura (Δ días, invertido), Sobrestock, Quiebres (N SKU), Inventario.
- **Salud de cartera:** score 0–100 (promedio de 6 dimensiones) + "↑ +3 vs mes anterior", tarjetas de Fortaleza (mejor dimensión) y Mayor problema (peor dimensión), y 6 mini-barras (`MiniDim`): venta, margen, inventario, disponibilidad, surtido, proveedores.
- **Principales focos** (`FocoCard`): SKU con riesgo de quiebre (→ decisiones), sobrestock (→ `/inventario`), oportunidades comerciales (→ `/mi-cartera/oportunidades`), proveedores por revisar (→ `/proveedores`), productos nuevos (→ `/productos`).
- **Productos estratégicos:** top 3 por utilidad (participación %, GMROI, margen), con enlace a cada producto y "Ver todos" → productos-clave.
- **Marcas** (tabla top 5): marca, venta, margen, crecimiento (`Delta`). "Ver todas" → `/mi-cartera/marcas`.
- **Proveedores** (tabla top 5): proveedor, venta, dependencia, estado (`StatusBadge`). "Ver todos" → `/mi-cartera/proveedores`.
- **Oportunidades** (4 contadores enlazados): buen margen por potenciar, ventas acelerando, proveedor alternativo, productos nuevos → todos a `/mi-cartera/oportunidades`.
- **Tendencias:** dos columnas — acelerando vs desacelerando (top 3 cada una con `TrendRow`), "Ver análisis →" → `/ventas`.
- **Categorías:** tarjetas por categoría del comprador con venta, margen y badges de quiebre/riesgo → `/categorias/{id}`.
- **Calidad de cartera** (4 `QualityItem`): costo sin actualizar (>90 días → `/productos`), margen bajo (<20% → `/analisis-compra`), productos nuevos (→ `/productos`), atributos incompletos (sin código de barras o unidad de compra → `/productos`).

## Secciones/bloques
Encabezado · Qué administro · Objetivos del mes · Resumen ejecutivo · Salud + Focos · Productos estratégicos · Marcas + Proveedores · Oportunidades · Tendencias · Categorías · Calidad de cartera.

## Filtros disponibles
No hay filtros interactivos. La segmentación se hace por ruta (foco) y por el comprador activo. (Nota: la selección de cartera "mine/all" del `ScopeToggle` **no** aplica aquí; esta vista siempre usa las categorías del comprador.)

## Acciones del usuario
- Navegar a los distintos focos de cartera, categorías, productos, proveedores, inventario, análisis de ventas y análisis de compra.
- Abrir productos, categorías y proveedores específicos desde las tablas/tarjetas.

## Botones y controles
- Botón de encabezado "Ver decisiones" (→ `/`).
- Múltiples enlaces "Ver todas/todos", "Ver detalle", "Ver análisis", chips-contadores y tarjetas-enlace. No hay controles de formulario.

## Tablas/tarjetas/formularios/componentes relevantes
- `Card`, `TrendKpi`, `GoalBar`, `MiniDim`, `FocoCard`, `Delta`, `TrendRow`, `QualityItem`, `SectionLabel`, `StatusBadge`, `Badge`, `EmptyState`, `PortfolioCountLink`.
- Tablas HTML simples para Marcas y Proveedores (top 5). Sin formularios.

## Campos de cada formulario
No aplica.

## Estados posibles
- **Con datos:** estado normal.
- **Vacía:** "Categorías" muestra `EmptyState` "Sin categorías asignadas" si el comprador no tiene categorías. El encabezado muestra "Sin categorías asignadas" cuando corresponde.
- **Sin resultados / cargando / error:** no aplican (datos mock síncronos; sin filtros que puedan vaciar la vista salvo la ausencia de categorías).

## Navegación hacia otras pantallas
`/` · `/mi-cartera/productos-clave` · `/mi-cartera/marcas` · `/mi-cartera/proveedores` · `/mi-cartera/oportunidades` · `/categorias` · `/categorias/{id}` · `/productos` · `/productos/{sku}` · `/proveedores` · `/inventario` · `/ventas` · `/analisis-compra` · `/comprar/decisiones`.

## Flujo funcional completo
1. El comprador entra a "Mi cartera" para entender el estado de su negocio.
2. Revisa qué administra y si va camino a sus metas del mes.
3. Lee el resumen ejecutivo con tendencia y la salud (fortaleza vs mayor problema).
4. Prioriza con "Principales focos" y profundiza en productos estratégicos, marcas o proveedores.
5. Salta a los focos específicos (productos-clave, marcas, proveedores, oportunidades) o a otras vistas para actuar.

## Reglas de negocio inferibles
- **Roles de producto (clasificación comercial):** Estrella (venta > 0, margen ≥ 34%, GMROI ≥ 4), Margen (venta > 0, margen ≥ 36%), Tractor (venta ≥ 40 u.), Emergente (crecimiento ≥ +25%), Deterioro (crecimiento ≤ −25% con stock), Detenido (venta 0 con stock), Riesgo (resto).
- **GMROI** = utilidad bruta × 12 / valor de inventario; **Rotación** = costo vendido × 12 / valor de inventario; **Cobertura ponderada** por venta valorizada.
- **Salud (6 dimensiones 0–100):** heurísticas acotadas a 0–100 (venta según aceleraciones/frenos; margen ≈ margen% × 2,4; inventario penaliza sobrestock; disponibilidad penaliza quiebres/cobertura corta; surtido penaliza detenidos; proveedores penaliza estado no activo).
- **Metas:** venta = venta actual × 1,18 (redondeada a 500k); margen 33%; sobrestock < $3M; disponibilidad 96%.
- **Base "mes anterior":** promedio de los dos meses previos derivado de venta 90d − 30d (no hay serie histórica real).

## Validaciones necesarias
No aplica (vista de lectura, sin entradas).

## Permisos/restricciones deducibles
Contenido atado al comprador activo. Sin diferenciación por rol.

## Dudas funcionales / definiciones pendientes
- **Suposición:** las metas y tendencias son fórmulas fijas de demostración, no metas reales negociadas.
- **Definición pendiente:** "↑ +3 vs mes anterior" en Salud está hardcodeado; falta definir el comparativo real.
- **Definición pendiente:** el botón "Ver decisiones" en cartera navega a `/` (Inicio), no a `/comprar/decisiones` — posible inconsistencia de etiqueta/destino a confirmar.

---

# Pantalla 3 · Mi Cartera · Productos clave

## Nombre
Productos clave · {comprador}.

## Ruta(s)
- `/mi-cartera/productos-clave` (`portfolioFocus = "productos-clave"`).

## Módulo
Inicio y Mi Cartera.

## Objetivo funcional
Clasificar los SKU de la cartera por su **rol comercial** (venta, margen, tráfico, crecimiento o riesgo) y ofrecer rankings de decisión antes de comprar o negociar.

## Tipo de usuario
Comprador (líder puede acceder).

## Descripción detallada
Renderiza `PortfolioFocusWorkspace` con `focus = "productos-clave"`. Muestra un "Mapa de roles comerciales" (conteo por rol + lista de hasta 10 SKU con su rol, razón, venta, margen y GMROI) y "Rankings para decidir" (más vendidos, mayor utilidad, mayor GMROI, top 5 cada uno). Debajo se mantienen los bloques comunes de cartera (Tendencias, Categorías, Calidad).

## Información que muestra
- Encabezado de foco: "Productos clave · {comprador}" + descripción.
- Bloque "Mi cartera — ¿qué administro?" (común a todas las sub-rutas de cartera).
- **Mapa de roles:** tiras por rol (Estrella, Tractor, Margen, Emergente, Deterioro, Detenido, Riesgo) con su conteo; lista de 10 productos (`KeyProductItem`) con badge de rol, SKU, nombre, razón, venta, margen y GMROI.
- **Rankings:** "Más vendidos" (por venta valorizada), "Mayor utilidad" (por utilidad bruta), "Mayor GMROI".
- Bloques comunes: Tendencias, Categorías, Calidad de cartera.

## Secciones/bloques
Encabezado · Qué administro · Mapa de roles comerciales · Rankings para decidir · Tendencias · Categorías · Calidad.

## Filtros disponibles
No hay filtros interactivos; la clasificación por rol es automática. Los rankings están limitados a top 5 / top 10.

## Acciones del usuario
- Abrir el detalle de cada producto (`/productos/{sku}`) desde la lista o los rankings.
- Navegar a bloques comunes (categorías, ventas, productos, análisis de compra).

## Botones y controles
Enlaces por ítem; sin controles de formulario ni botones de acción directa (no hay "Agregar a OC" en este foco).

## Tablas/tarjetas/formularios/componentes relevantes
`PortfolioFocusWorkspace`, `KeyProductItem`, `ProductRank`, `Badge`, `Card`. Sin formularios.

## Campos de cada formulario
No aplica.

## Estados posibles
- **Con datos:** normal. Las listas quedan vacías (sin `EmptyState` dedicado) si el comprador no tiene productos; los conteos por rol serían 0.
- **Cargando / error / sin resultados:** no aplican (mock síncrono, sin filtros).

## Navegación hacia otras pantallas
`/productos/{sku}`, más los destinos de los bloques comunes (`/ventas`, `/categorias/{id}`, `/productos`, `/analisis-compra`).

## Flujo funcional completo
El comprador identifica qué SKU son estrella/tractor/margen/emergente y cuáles están en riesgo/detenidos, usa los rankings para responder "qué vende más / qué rinde más / qué usa mejor el capital", y entra al detalle del producto para decidir compra o negociación.

## Reglas de negocio inferibles
Mismos criterios de rol y métricas (GMROI, crecimiento) que en el resumen. El orden de la lista prioriza Estrella → Tractor → Margen → Emergente → Riesgo → Deterioro → Detenido, y luego por venta.

## Validaciones necesarias
No aplica.

## Permisos/restricciones deducibles
Atado al comprador activo.

## Dudas funcionales / definiciones pendientes
- **Definición pendiente:** los umbrales de rol (34%/36%/40 u./±25%) son de demostración; requieren validación con negocio.

---

# Pantalla 4 · Mi Cartera · Marcas

## Nombre
Marcas · {comprador}.

## Ruta(s)
- `/mi-cartera/marcas` (`portfolioFocus = "marcas"`).

## Módulo
Inicio y Mi Cartera.

## Objetivo funcional
Leer el desempeño por **marca** dentro de la cartera: participación, crecimiento, margen e inventario, para decidir qué proteger, qué monitorear y dónde se consume capital.

## Tipo de usuario
Comprador (líder puede acceder).

## Descripción detallada
`PortfolioFocusWorkspace` con `focus = "marcas"`: tarjeta "Lectura de marcas" (métricas resumen) + "Desempeño por marca" (una tarjeta por marca con conclusión cualitativa, venta, margen y crecimiento). Mantiene los bloques comunes de cartera.

## Información que muestra
- **Lectura de marcas:** Marcas activas, Creciendo (crecimiento > 8%), Con presión (crecimiento < −8% o con quiebres), Venta líder (marca top).
- **Desempeño por marca (`BrandHealthItem`):** nombre, N SKU, conclusión ("crece, pero consume capital" / "se está frenando" / "protege rentabilidad" / "monitorear mix"), badge de quiebres, venta, margen y crecimiento.
- Bloques comunes: Tendencias, Categorías, Calidad.

## Secciones/bloques
Encabezado · Qué administro · Lectura de marcas · Desempeño por marca · Tendencias · Categorías · Calidad.

## Filtros disponibles
Ninguno interactivo. Orden por venta descendente.

## Acciones del usuario
Lectura y navegación a bloques comunes. No hay enlace directo por marca a una vista de marca dedicada (las marcas se exploran vía `/productos` con filtro de marca desde otras pantallas).

## Botones y controles
Sin botones de acción; solo los enlaces de los bloques comunes.

## Tablas/tarjetas/formularios/componentes relevantes
`PortfolioMetric`, `BrandHealthItem`, `Card`, `Badge`. Sin formularios.

## Campos de cada formulario
No aplica.

## Estados posibles
- **Con datos:** normal.
- **Vacía:** si no hay marcas, las métricas muestran 0 y la lista queda vacía (sin `EmptyState` dedicado).
- **Cargando / error / sin resultados:** no aplican.

## Navegación hacia otras pantallas
Destinos de bloques comunes (`/ventas`, `/categorias/{id}`, `/productos`, `/analisis-compra`).

## Flujo funcional completo
El comprador revisa qué marcas ganan/pierden participación, cuáles deterioran margen o consumen capital, y decide dónde negociar o ajustar surtido (accionando desde otras vistas).

## Reglas de negocio inferibles
- "Creciendo" > +8%; "Con presión" < −8% o con quiebres.
- Conclusión de marca: crece consumiendo capital si crecimiento > 15% e inventario > venta; frenando si < −12%; protege rentabilidad si margen ≥ 34%.

## Validaciones necesarias
No aplica.

## Permisos/restricciones deducibles
Atado al comprador activo.

## Dudas funcionales / definiciones pendientes
- **Definición pendiente:** no existe pantalla de "detalle de marca"; se navega solo a productos filtrados desde otras vistas.

---

# Pantalla 5 · Mi Cartera · Proveedores

## Nombre
Proveedores · {comprador}.

## Ruta(s)
- `/mi-cartera/proveedores` (`portfolioFocus = "proveedores"`).

## Módulo
Inicio y Mi Cartera.

## Objetivo funcional
Priorizar relaciones con proveedores de la cartera según **dependencia, alternativas y SKU detenidos**, y preparar puntos de negociación.

## Tipo de usuario
Comprador (líder puede acceder).

## Descripción detallada
`PortfolioFocusWorkspace` con `focus = "proveedores"`: tarjeta "Prioridad de negociación" (métricas resumen) + "Proveedores de cartera" (una tarjeta por proveedor con posición negociadora, venta, dependencia, detenidos y estado), cada uno enlazando al detalle del proveedor en su pestaña de negociación. Bloques comunes al final.

## Información que muestra
- **Prioridad de negociación:** Dependencia alta (dependencia > 35%), Con alternativas (SKU con proveedor alternativo > 0), SKU detenidos (suma).
- **Proveedores de cartera (`SupplierPortfolioItem`):** nombre, posición ("posición negociadora media-alta" / "dependencia alta" / "relación diversificada"), estado (`StatusBadge`), venta, dependencia (% de SKU del comprador que dependen del proveedor) y detenidos. Enlace a `/proveedores/{id}?tab=negociacion`.
- Bloques comunes: Tendencias, Categorías, Calidad.

## Secciones/bloques
Encabezado · Qué administro · Prioridad de negociación · Proveedores de cartera · Tendencias · Categorías · Calidad.

## Filtros disponibles
Ninguno interactivo. Solo proveedores cuyas categorías intersectan con las del comprador; orden por venta.

## Acciones del usuario
Abrir el detalle de proveedor (pestaña negociación) y navegar a bloques comunes.

## Botones y controles
Enlaces por proveedor; sin controles de formulario.

## Tablas/tarjetas/formularios/componentes relevantes
`PortfolioMetric`, `SupplierPortfolioItem`, `StatusBadge`, `Card`. Sin formularios.

## Campos de cada formulario
No aplica.

## Estados posibles
- **Con datos:** normal.
- **Vacía:** si no hay proveedores en la cartera, las listas quedan vacías (sin `EmptyState` dedicado).
- **Cargando / error / sin resultados:** no aplican.

## Navegación hacia otras pantallas
`/proveedores/{id}?tab=negociacion` + destinos de bloques comunes.

## Flujo funcional completo
El comprador identifica proveedores con alta dependencia o con alternativas disponibles, revisa SKU detenidos por proveedor y entra a preparar la negociación.

## Reglas de negocio inferibles
- Dependencia = SKU del proveedor / total de SKU del comprador; "alta" > 35%.
- Posición negociadora media-alta si dependencia > 35% y proporción de SKU con alternativa > 40%.
- Detenidos = SKU con venta 0 y stock > 0 del proveedor.

## Validaciones necesarias
No aplica.

## Permisos/restricciones deducibles
Atado al comprador activo.

## Dudas funcionales / definiciones pendientes
- **Suposición:** la "compra anual estimada" y otros indicadores del proveedor se calculan en el módulo de proveedores (fuera de esta pantalla).

---

# Pantalla 6 · Mi Cartera · Oportunidades

## Nombre
Oportunidades · {comprador}.

## Ruta(s)
- `/mi-cartera/oportunidades` (`portfolioFocus = "oportunidades"`).

## Módulo
Inicio y Mi Cartera.

## Objetivo funcional
Detectar oportunidades comerciales antes de que sean urgencias: **crecimiento con poca cobertura, margen por potenciar y alternativas para negociar**.

## Tipo de usuario
Comprador (líder puede acceder).

## Descripción detallada
`PortfolioFocusWorkspace` con `focus = "oportunidades"` (rama por defecto): "Radar de oportunidades" con hasta ~8 tarjetas (`OpportunityItem`) o `EmptyState` si no hay oportunidades. Bloques comunes al final.

## Información que muestra
- **Radar de oportunidades:** tarjetas con etiqueta (badge de color), título (producto o proveedor) y detalle:
  - "Crecimiento con poca cobertura" (productos emergentes con cobertura ≤ 2 × leadTime) → `/productos/{sku}`.
  - "Buen margen por potenciar" (rol Margen con stock) → `/productos/{sku}`.
  - "Alternativas para negociar" (proveedores con SKU alternativos) → `/proveedores/{id}?tab=negociacion`.
- Bloques comunes: Tendencias, Categorías, Calidad.

## Secciones/bloques
Encabezado · Qué administro · Radar de oportunidades · Tendencias · Categorías · Calidad.

## Filtros disponibles
Ninguno interactivo. Cada tipo de oportunidad está limitado (2–3 ítems por tipo).

## Acciones del usuario
Abrir producto o proveedor asociado a la oportunidad; navegar a bloques comunes.

## Botones y controles
Enlaces por tarjeta; sin controles de formulario.

## Tablas/tarjetas/formularios/componentes relevantes
`OpportunityItem`, `Badge`, `Card`, `EmptyState`. Sin formularios.

## Campos de cada formulario
No aplica.

## Estados posibles
- **Con datos:** tarjetas de oportunidad.
- **Vacía / sin resultados:** `EmptyState` "Sin oportunidades fuertes" cuando no hay señales comerciales destacadas.
- **Cargando / error:** no aplican.

## Navegación hacia otras pantallas
`/productos/{sku}`, `/proveedores/{id}?tab=negociacion` + bloques comunes.

## Flujo funcional completo
El comprador revisa oportunidades de crecimiento/margen/negociación y entra al producto o proveedor para capturarlas (agregar a OC, potenciar profundidad, negociar alternativas).

## Reglas de negocio inferibles
- Emergente con cobertura ≤ 2 × leadTime = "crecimiento con poca cobertura".
- Margen (rol) con stock = "buen margen por potenciar".
- Proveedor con SKU alternativos = "alternativas para negociar".

## Validaciones necesarias
No aplica.

## Permisos/restricciones deducibles
Atado al comprador activo.

## Dudas funcionales / definiciones pendientes
- **Definición pendiente:** el radar es un resumen (máx. ~8 ítems); no hay paginación ni vista completa de todas las oportunidades detectadas.

---

# Pantalla 7 · Categorías (listado)

## Nombre
Categorías.

## Ruta(s)
- `/categorias`.

## Módulo
Inicio y Mi Cartera (surtido/categorías).

## Objetivo funcional
Mostrar la **salud comercial por categoría** (venta, margen, quiebres, riesgo, sobrestock, rotación, compra sugerida) y dar acceso directo a la reposición y a la optimización de surtido de cada categoría.

## Tipo de usuario
Comprador y líder. El alcance por defecto depende del rol (líder ⇒ "Todas"; comprador ⇒ "Mi cartera"), alternable con el `ScopeToggle`.

## Descripción detallada
Página con 4 tarjetas de ranking (`RankCard` + `BarList`) y una tabla `DataTable` con todas las categorías del alcance. Incluye un `InfoHint` "Cómo leer esta vista". El alcance se controla con `ScopeToggle` (mine/all) y filtra `categories` por `inScope(c.name)`.

## Información que muestra
- **Encabezado:** título "Categorías", descripción, `ScopeToggle` y ayuda contextual.
- **Rankings (top 5 cada uno):** Categorías críticas (quiebres + riesgo), Mayor venta 30d, Peor margen, Mayor inventario inmovilizado.
- **Tabla "Detalle por categoría":** Categoría (nombre + comprador), SKUs activos, Venta 30/90 días, Margen (ámbar si < 28%), Inventario valorizado, Quiebre/Riesgo/Sobre (badges rojo/ámbar/violeta), Rotación, Compra sugerida, Estado (`StatusBadge`), y acciones "Reposición" / "Surtido".

## Secciones/bloques
Encabezado con toggle y ayuda · Grilla de 4 rankings · Tabla de detalle.

## Filtros disponibles
- **`ScopeToggle`** ("Mi cartera · N cat." / "Todas"). Es el único filtro; no hay búsqueda por texto ni selects. La descripción de la tabla cambia según el alcance.

## Acciones del usuario
- Cambiar alcance (mi cartera / todas).
- Abrir el detalle de una categoría (clic en fila → `/categorias/{id}`).
- Ir a **Reposición** de una categoría (`/comprar/decisiones?cat={nombre}`).
- Ir a **Surtido** redundante de una categoría (`/surtido-redundante?cat={nombre}`).

## Botones y controles
- `ScopeToggle` (segmentado).
- `InfoHint` (ayuda desplegable).
- Enlaces por fila "Reposición" y "Surtido" (con `stopPropagation` para no disparar el clic de fila).

## Tablas/tarjetas/formularios/componentes relevantes
`PageHeader`, `RankCard` + `BarList`, `DataTable` (con `mobileCard`), `StatusBadge`, `Badge`, `ScopeToggle`, `InfoHint`. Sin formularios.

## Campos de cada formulario
No aplica.

## Estados posibles
- **Con datos:** normal.
- **Vacía / sin resultados:** `emptyMessage` distinto según alcance — en "Mi cartera": "Estás viendo solo tu cartera. Cambia a 'Todas' arriba para ver el resto…"; en "Todas": "No hay categorías."
- **Cargando / error:** no aplican (mock síncrono).

## Navegación hacia otras pantallas
`/categorias/{id}` · `/comprar/decisiones?cat=…` · `/surtido-redundante?cat=…`.

## Flujo funcional completo
1. El comprador ve primero las categorías críticas (más quiebres + riesgo).
2. Compara venta, margen, inventario y rotación en la tabla.
3. Desde cada fila salta a la acción: reposición (para comprar) o surtido (para optimizar), o abre el detalle de la categoría.

## Reglas de negocio inferibles
- Alcance por defecto según rol (comprador = solo sus categorías).
- Margen resaltado como advertencia si < 28%.
- "Categorías críticas" = suma de SKU en quiebre + en riesgo.
- Los enlaces de acción pasan la categoría como parámetro de URL (`cat`) para pre-filtrar la vista destino.

## Validaciones necesarias
No aplica (sin entradas de datos).

## Permisos/restricciones deducibles
- Comprador arranca acotado a su cartera pero puede ver "Todas". Líder ve "Todas" por defecto. No hay bloqueo duro de acceso (ambos pueden alternar).

## Dudas funcionales / definiciones pendientes
- **Definición pendiente:** no hay búsqueda ni orden interactivo de columnas en la tabla (solo rankings fijos).

---

# Pantalla 8 · Categoría (detalle)

## Nombre
Detalle de categoría — {nombre de la categoría}.

## Ruta(s)
- `/categorias/:id`.

## Módulo
Inicio y Mi Cartera (surtido/categorías).

## Objetivo funcional
Profundizar en una categoría: KPIs clave y navegación por pestañas a **productos, productos clave, crecimiento, detenidos, marcas, optimización de surtido, reposición, proveedores y alertas**.

## Tipo de usuario
Comprador y líder. No hay `RoleGate`; se accede por enlace desde Categorías o Mi cartera.

## Descripción detallada
Busca la categoría por `id`. Si no existe, muestra `EmptyState` "Categoría no encontrada" con botón "Volver a categorías". Si existe, renderiza encabezado con breadcrumb, 4 `KpiCard` y un componente `Tabs` con 9 pestañas (estado local `tab`, inicial "productos"). Una KPI ("Compra sugerida") actúa como acceso rápido a la pestaña de reposición.

## Información que muestra
- **Encabezado:** breadcrumb Categorías → {categoría}; título; "Comprador: {buyer}"; estado (`StatusBadge`).
- **KPIs:** Compra sugerida (clic → pestaña reposición), SKUs en quiebre (+ N en riesgo), Venta 30 días (+ margen promedio), Inventario (+ N sobrestock).
- **Pestañas (con contadores):**
  - **Productos:** lista de todos los SKU (disp., venta/mes, margen, estado de compra) → detalle producto.
  - **Productos clave:** hasta 12 SKU con rol (Detenido/Deterioro/Margen/otros), venta, margen, utilidad.
  - **Crecimiento:** SKU con crecimiento ≥ 25% (cobertura, stock, % crecimiento) o `EmptyState`.
  - **Detenidos:** SKU con venta 0 y stock (capital inmovilizado) o `EmptyState`.
  - **Marcas:** por marca — SKU, margen, venta, badge de quiebres.
  - **Optimizar surtido:** `CatalogRedundancy` (candidatos redundantes de la categoría).
  - **Reposición:** recomendaciones de la categoría con cantidad, monto, proveedor, `RecommendationBadge` y botón "Agregar" a OC.
  - **Proveedores:** proveedores de la categoría (cumplimiento, lead time, OC abiertas, estado) → detalle proveedor.
  - **Alertas:** `AlertCard` de alertas relacionadas a la categoría o a sus SKU, o `EmptyState`.

## Secciones/bloques
Encabezado + KPIs · Barra de pestañas · Panel de la pestaña activa.

## Filtros disponibles
- **Pestañas** (`Tabs`) como segmentación del contenido. No hay filtros por texto ni selects; los contadores de cada pestaña orientan.

## Acciones del usuario
- Cambiar de pestaña.
- Abrir producto, proveedor o alerta relacionada.
- **Agregar a OC** desde la pestaña Reposición (con toast y enlace a borrador).
- Volver a Categorías (si no existe la categoría).

## Botones y controles
- `Tabs` (9 pestañas con contador).
- `KpiCard` "Compra sugerida" clickeable (activa pestaña reposición).
- Botón "Agregar" / "En OC" por recomendación (deshabilitado si ya está en el borrador).
- Botón "Volver a categorías" (estado no encontrado).

## Tablas/tarjetas/formularios/componentes relevantes
`PageHeader` (breadcrumbs), `KpiCard`, `Tabs`, `StatusBadge`, `Badge`, `RecommendationBadge`, `AlertCard`, `CatalogRedundancy`, `EmptyState`, `Button`. Sin formularios de captura.

## Campos de cada formulario
No aplica (la única acción de datos es "Agregar a OC" con cantidad ya sugerida).

## Estados posibles
- **Con datos:** normal.
- **Vacía / sin resultados:** `EmptyState` en varias pestañas (Productos sin SKU, Crecimiento sin aceleraciones, Detenidos vacío, Reposición sin sugerencias, Proveedores sin asociados, Alertas sin alertas).
- **No encontrado:** `id` inexistente ⇒ "Categoría no encontrada".
- **Cargando / error:** no aplican (mock síncrono).

## Navegación hacia otras pantallas
`/categorias` · `/productos/{sku}` · `/proveedores/{id}` · `/comprar/borradores` (vía toast) · destino de `CatalogRedundancy` (surtido).

## Flujo funcional completo
1. Se abre desde Categorías o Mi cartera.
2. El comprador revisa KPIs de la categoría y navega por pestañas según su objetivo (comprar, optimizar, revisar marcas/proveedores/alertas).
3. En Reposición agrega recomendaciones al borrador de OC.
4. Profundiza en productos individuales o proveedores.

## Reglas de negocio inferibles
- Roles de producto simplificados por categoría (Detenido, Emergente ≥25%, Deterioro ≤−25%, Margen ≥34%, Tractor ≥40 u., Riesgo).
- "Detenidos" = venta 0 con stock (capital inmovilizado = stock × costo).
- Alertas de categoría = por `relatedEntity` = nombre de categoría o `relatedSku` dentro de la categoría.

## Validaciones necesarias
- "Agregar" deshabilitado si el SKU ya está en el borrador o si la cantidad sugerida no es > 0.

## Permisos/restricciones deducibles
Sin restricción de rol. Cualquier usuario autenticado con la URL accede.

## Dudas funcionales / definiciones pendientes
- **Definición pendiente:** las pestañas "Productos clave" y "Marcas" no tienen `EmptyState` propio (quedarían vacías si no hay datos).
- **Suposición:** `CatalogRedundancy` y sus reglas pertenecen al módulo de optimización de surtido (fuera de este levantamiento).

---

# Pantalla 9 · Productos / SKUs (listado)

## Nombre
Productos / SKUs.

## Ruta(s)
- `/productos` (admite parámetros de URL: `q`, `cat`, `sub`, `marca`, `prov`, `comercial`, `compra`, `stock`).

## Módulo
Inicio y Mi Cartera (surtido/productos).

## Objetivo funcional
Explorar el maestro de productos con **búsqueda, filtros y KPIs** para revisar stock, margen, rotación, quiebre estimado y estado del surtido, y exportar el resultado a CSV.

## Tipo de usuario
Comprador y líder. Alcance por defecto según rol (`ScopeToggle` mine/all), compartido vía `localStorage`.

## Descripción detallada
Lista de productos filtrable. Usa `useCollection("products", mockProducts)` (colección editable en memoria vía `DataContext`), la acota por alcance (`inScope`), aplica filtros de `FilterBar` (búsqueda + selects + toggles) y muestra KPIs que reflejan el resultado filtrado y una tabla `DataTable`. Los filtros de búsqueda/selects se sincronizan con la URL (`useUrlState`/`useUrlToggle`); los toggles booleanos avanzados viven en estado local.

## Información que muestra
- **Encabezado:** título, descripción, `ScopeToggle` y `MoreActions` con "Exportar a CSV".
- **`FilterBar`:** búsqueda; resumen dinámico "{N} productos · {N} sin stock · {N} margen bajo · {N} sin proveedor"; selects (Categoría, Subcategoría, Marca, Proveedor, Estado comercial, Estado compra); toggles (Sin stock, Margen bajo, Sin proveedor, Sin venta, Sin costo actualizado); botón limpiar.
- **KPIs:** SKUs en vista, Margen bajo (<25%), Sin proveedor, Sin venta (30d). Los tres últimos son clickeables y activan su toggle correspondiente.
- **Tabla:** Producto (SKU, marca, nombre, categoría-enlace · subcategoría), Proveedor (o "Sin proveedor" en rojo), Costo/Precio, Margen (ámbar si <25%), Stock disp./total, Venta mes, Quiebre estimado (fecha con color según cobertura vs lead time, o "En quiebre"), Rotación, Estado comercial, Estado compra.

## Secciones/bloques
Encabezado con toggle y exportación · `FilterBar` · Grilla de KPIs · Tabla de productos.

## Filtros disponibles
- **Búsqueda de texto** (`q`): SKU, producto o marca.
- **Selects:** Categoría (`cat`), Subcategoría (`sub`), Marca (`marca`), Proveedor (`prov`), Estado comercial (`comercial`: active/new/discontinued/no_sales/seasonal/blocked), Estado compra (`compra`: buy/do_not_buy/review/on_demand/overstock).
- **Toggles:** Sin stock (`stock`, `availableStock <= 0`), Margen bajo (`lowMargin`), Sin proveedor (`noSupplier`), Sin venta (`noSales`), Sin costo actualizado (`outdatedCost`, `costUpdatedAt < "2026-04-01"`).
- **`ScopeToggle`** (mi cartera / todas).
- Botón **Limpiar** (resetea todos los filtros y toggles).

## Acciones del usuario
- Buscar, filtrar y limpiar.
- Cambiar alcance.
- Abrir el detalle de un producto (clic en fila → `/productos/{sku}`) o de su categoría (enlace dentro de la celda).
- **Exportar a CSV** el resultado filtrado (toast confirma N productos).

## Botones y controles
- `ScopeToggle`.
- `MoreActions` → "Exportar a CSV".
- `FilterBar` (input de búsqueda, selects, toggles, limpiar).
- KPIs clickeables (Margen bajo, Sin proveedor, Sin venta).

## Tablas/tarjetas/formularios/componentes relevantes
`PageHeader`, `FilterBar`, `KpiCard`, `DataTable` (con `mobileCard`), `StatusBadge`, `ScopeToggle`, `MoreActions`. No hay formulario de edición (solo controles de filtro).

## Campos de cada formulario
No aplica en el sentido de formulario de captura. Controles de filtrado: búsqueda (texto), 6 selects, 5 toggles.

## Estados posibles
- **Con datos:** normal.
- **Sin resultados:** `emptyMessage` distinto por alcance — en "Mi cartera": "Sin productos con estos filtros en tu cartera. Cambia a 'Todas' arriba o limpia los filtros."; en "Todas": "Sin productos que coincidan con los filtros."
- **Cargando / error:** no aplican (mock síncrono; sin llamadas de red).

## Navegación hacia otras pantallas
`/productos/{sku}` (fila) · `/categorias/{...}` (enlace de categoría en la celda) · exportación local (descarga CSV, sin navegación).

## Flujo funcional completo
1. El comprador (acotado a su cartera por defecto) busca o filtra SKU por múltiples criterios.
2. Los KPIs y el resumen se recalculan con cada cambio de filtro.
3. Puede exportar la vista a CSV o entrar al detalle de un producto para decidir.

## Reglas de negocio inferibles
- Margen "bajo" = < 25% (resaltado y KPI); en el CSV se exporta el margen numérico.
- "Sin costo actualizado" ata a fecha fija `2026-04-01` (equivalente a >90 días respecto a hoy 2026-07-13, aproximado como umbral mock).
- Quiebre estimado: "En quiebre" si sin stock con venta; color rojo si cobertura ≤ lead time, ámbar si ≤ 2× lead time.
- Alcance por defecto según rol.

## Validaciones necesarias
No hay validaciones de entrada (filtros libres). La exportación siempre opera sobre el resultado visible.

## Permisos/restricciones deducibles
- Comprador acotado a su cartera por defecto, con opción "Todas". Sin bloqueo de acceso por rol.

## Dudas funcionales / definiciones pendientes
- **Suposición:** `useCollection` permite editar productos en memoria (usado por otras pantallas); aquí es solo lectura/filtrado.
- **Definición pendiente:** el umbral fijo `"2026-04-01"` para "sin costo actualizado" debería derivarse de la fecha actual y no ser una constante.

---

# Pantalla 10 · Producto (detalle)

## Nombre
Detalle de producto — {nombre del producto}.

## Ruta(s)
- `/productos/:sku` (admite `?tab=` para abrir en una pestaña concreta, p.ej. `?tab=margen`, `?tab=negociacion`).

## Módulo
Inicio y Mi Cartera (surtido/productos).

## Objetivo funcional
Reunir en una sola vista **todo lo necesario para decidir sobre un SKU**: decisión recomendada, KPIs, recomendación de compra, stock por ubicación, historiales, alertas, OC relacionadas, panel de negociación, margen por canal, señales de ventas, entidades relacionadas y actividad.

## Tipo de usuario
Comprador y líder. Se accede por enlace desde casi todo el sistema.

## Descripción detallada
Busca el producto por SKU (`getProductBySku`). Si no existe, muestra `EmptyState` "Producto no encontrado" con botón "Volver a productos". Si existe, muestra encabezado con breadcrumb y botón "Agregar a OC" (solo si hay recomendación con cantidad > 0), una fila de chips de estado, un **`DecisionBanner`** (decisión recomendada en una frase) y `Tabs` con 6 pestañas (estado inicial tomado de `?tab`).

## Información que muestra
- **Encabezado:** breadcrumb Productos → {sku}; título (nombre); "categoría · subcategoría · marca"; botón "Agregar a OC" / "Agregado a OC" (condicional).
- **Chips:** SKU, estado comercial (`StatusBadge`), estado de compra, proveedor (enlace) o "Sin proveedor asignado", y badges de optimización ("Redundante · {acción}" o "Reactivar compra") enlazando a surtido.
- **`DecisionBanner`:** 4 casos — (1) comprar N u. a proveedor por $ (crítico rojo / normal ámbar), (2) sobrestock → "No comprar", (3) sin proveedor con venta → "Asignar proveedor", (4) todo en orden → "Sin acción por ahora".
- **Pestaña Resumen:** 8 KPIs (Stock total, Stock disponible + comprometido, Venta 30d + 90d, Días de inventario, Margen, Costo actual + fecha, Precio venta, Cantidad sugerida + monto). Recomendación de compra (badge, cantidad, monto, proveedor, lead time, Motivo, Riesgo si no compras, stock mín./punto reposición/máx.) o `EmptyState`. Stock por ubicación (barras disp./comprometido). Historiales: últimas ventas (mock 3 meses), últimas compras (OC con el SKU), cambios de costo (mock 3 hitos). Alertas relacionadas y OC relacionadas.
- **Pestaña Negociación (`NegotiationPanel`):** venta y demanda (30/90d, tendencia, ranking), margen y precio (con costo objetivo por regla), inventario (disponible, días, en tránsito, venta perdida por quiebre), proveedor (lead time, cumplimiento, fill rate, compra anual estimada), costo neto real (flete/arancel/manejo → costo puesto en bodega; margen nominal vs real), precio/costo e historial (último costo, variación, precio promedio vendido, precio competencia), stock por tienda/CD, calidad y condiciones del proveedor (pago, devoluciones, notas de crédito, reclamos, quiebres provocados), demanda futura (venta 180d, proyección 90d, tendencia, rotación, estacionalidad), productos sustitutos, proveedores alternativos y objetivos de la negociación + próxima decisión (chips).
- **Pestaña Margen por canal:** comparación por canal (precio, costo, comisión, descuento, margen, objetivo, venta 30d, precio sugerido si margen bajo/negativo, causa y acción) o `EmptyState`. Enlace "Ver comparador" → `/margen-canal?q={sku}`.
- **Pestaña Señales de ventas:** señales del SKU (prioridad, tipo, estado, comentario, reportado por · canal · tienda) o `EmptyState`. Enlace a `/senales-ventas`.
- **Pestaña Relacionados:** `RelatedEntitiesPanel` con entidades conectadas.
- **Pestaña Actividad:** `ActivityTimeline` (actualización de costo, OC, alertas), ordenada por fecha.

## Secciones/bloques
Encabezado + acción · Chips de estado · `DecisionBanner` · `Tabs` (Resumen, Negociación, Margen por canal, Señales de ventas, Relacionados, Actividad).

## Filtros disponibles
- **Pestañas** (`Tabs`, 6) como segmentación; la pestaña inicial se puede fijar por `?tab=`. No hay filtros de datos.

## Acciones del usuario
- **Agregar a OC** (desde el encabezado y desde el `DecisionBanner`; cantidad = sugerida de la recomendación, o `reorderPoint` como respaldo).
- Cambiar de pestaña.
- Navegar a proveedor, surtido redundante, comparador de margen por canal, señales, seguimiento de OC, productos sustitutos y proveedores alternativos.
- Volver a Productos (estado no encontrado).

## Botones y controles
- Botón "Agregar a OC" / "Agregado a OC" (encabezado y banner; deshabilitado si ya está en el borrador).
- `Tabs` (6 pestañas con contadores donde aplica).
- Múltiples enlaces contextuales.

## Tablas/tarjetas/formularios/componentes relevantes
`PageHeader` (breadcrumbs), `Tabs`, `KpiCard`, `StatusBadge`, `RecommendationBadge`, `AlertCard`, `BarList`, `Badge`, `EmptyState`, `Button`; componentes locales `DecisionBanner`, `NegotiationPanel`, `MiniStat`, `Row` (y `NStat` interno); componentes compartidos `RelatedEntitiesPanel`, `ActivityTimeline`. **No hay formularios de captura**; la única acción de datos es agregar al borrador de OC.

## Campos de cada formulario
No aplica (sin formulario editable). La acción "Agregar a OC" no pide datos: usa cantidad y costo ya calculados.

## Estados posibles
- **Con datos:** normal.
- **Vacía / sin resultados:** `EmptyState` en Recomendación (sin recomendación activa), Margen por canal (sin datos de canal), Señales (sin señales), Alertas (sin alertas), OC relacionadas (sin órdenes), sustitutos/alternativas (mensajes en texto). Historial de compras muestra "Sin compras recientes registradas." cuando no hay OC.
- **No encontrado:** SKU inexistente ⇒ "Producto no encontrado".
- **Cargando / error:** no aplican (mock síncrono). Los historiales de ventas y costo son datos generados (mock) a partir del maestro.

## Navegación hacia otras pantallas
`/productos` · `/productos/{sku}` (sustitutos) · `/proveedores/{id}` y `/proveedores/{id}?tab=temporadas` · `supplierPath(nombre)` (proveedor por nombre) · `/surtido-redundante?cat=…` · `/margen-canal?q={sku}` · `/senales-ventas` · `/comprar/seguimiento?oc=…` · `/comprar/borradores` (vía toast al agregar, según el flujo del borrador).

## Flujo funcional completo
1. El comprador abre un SKU desde cualquier vista.
2. Lee la decisión recomendada (comprar / no comprar / asignar proveedor / sin acción) y, si aplica, agrega a OC en un clic.
3. Profundiza en KPIs, recomendación, stock por ubicación e historiales.
4. Prepara una negociación con el panel dedicado (costo real, objetivos, alternativas).
5. Revisa margen por canal, señales del terreno, entidades relacionadas y actividad.

## Reglas de negocio inferibles
- **Decisión recomendada:** prioriza recomendación de compra activa; si no, sobrestock ⇒ no comprar; si no, sin proveedor con venta ⇒ asignar proveedor; si no, sin acción.
- **Días de inventario:** tono malo si <7, advertencia si >120.
- **Margen:** advertencia si <25%.
- **Costo real** = costo de factura + flete + arancel + manejo ("costo puesto en bodega"); se negocia sobre ese costo, no sobre el descuento de lista.
- **Costo objetivo** para alcanzar el margen mínimo por regla (`resolveRuleForProduct`).
- **Objetivos de negociación** se generan condicionalmente (brecha de margen, fill rate <95%, cumplimiento <90%, lead time ≥12, quiebre activo, volumen ≥50 u., plazo de pago).
- **Cantidad a agregar** = `rec.suggestedQuantity` o, como respaldo, `product.reorderPoint`.

## Validaciones necesarias
- "Agregar a OC" deshabilitado si el SKU ya está en el borrador. El botón del encabezado solo aparece si hay recomendación con cantidad > 0.

## Permisos/restricciones deducibles
Sin restricción de rol. Cualquier usuario autenticado accede vía URL.

## Dudas funcionales / definiciones pendientes
- **Suposición:** historiales de ventas y de costo son estimaciones mock derivadas del maestro (no hay serie real).
- **Definición pendiente:** varios indicadores del panel de negociación (devoluciones, notas de crédito, reclamos, quiebres provocados, precio competencia) provienen de utilidades mock (`negotiation`, `supplierPerf`) cuya fuente real está por definir.
- **Definición pendiente:** el badge de optimización ("Redundante"/"Reactivar compra") depende del módulo de optimización de surtido.

---

# RESUMEN DEL MÓDULO

## Objetivo
Ofrecer al comprador un punto de entrada diario (Inicio) y una lectura de negocio de su cartera (Mi cartera), más las vistas de surtido asociadas (Categorías y Productos con sus detalles), para pasar de "entender el estado" a "tomar decisiones de compra y negociación". Todo opera sobre datos mock deterministas y síncronos.

## Pantallas que lo componen
1. **Inicio** (`/`) — portada operativa del día (agenda de decisiones).
2. **Mi cartera · Resumen** (`/mi-cartera`).
3. **Mi cartera · Productos clave** (`/mi-cartera/productos-clave`).
4. **Mi cartera · Marcas** (`/mi-cartera/marcas`).
5. **Mi cartera · Proveedores** (`/mi-cartera/proveedores`).
6. **Mi cartera · Oportunidades** (`/mi-cartera/oportunidades`).
7. **Categorías** (`/categorias`).
8. **Categoría (detalle)** (`/categorias/:id`).
9. **Productos / SKUs** (`/productos`).
10. **Producto (detalle)** (`/productos/:sku`).

> Nota: 1–6 son el mismo componente `MyPanelPage`/`InicioPage` decidiendo su contenido por ruta.

## Flujo principal
Inicio (qué decidir hoy) → agregar productos en riesgo al **borrador de OC** o entrar al detalle → Mi cartera (entender el negocio y priorizar focos) → Categorías / Productos (explorar y filtrar surtido) → Detalle de categoría o producto (decidir: agregar a OC, preparar negociación, revisar margen por canal, señales, etc.) → salto al flujo de compra (`/comprar/...`).

## Funcionalidades principales
- Agenda de decisiones priorizada (riesgos, OC, proveedores, sobrestock, aprobaciones, aceleraciones).
- Resumen ejecutivo de cartera con tendencia, salud y metas del mes.
- Clasificación de productos por rol comercial y rankings de decisión.
- Análisis por marcas y proveedores (dependencia, alternativas, negociación).
- Listado de categorías con salud comercial y accesos a reposición/surtido.
- Listado de productos con búsqueda, filtros, KPIs y exportación CSV.
- Detalle de producto con decisión recomendada, panel de negociación completo y margen por canal.
- Acción transversal **"Agregar a OC"** (borrador) desde múltiples pantallas.

## Funcionalidades secundarias
- Radar de oportunidades comerciales.
- Calidad de datos de cartera (costo desactualizado, margen bajo, atributos incompletos, productos nuevos).
- Venta no capturada (oportunidades perdidas) en Inicio.
- Señales de ventas para el comprador (por cartera y por SKU).
- Alcance "Mi cartera / Todas" (`ScopeToggle`) según rol.
- Historiales (ventas, compras, costo) y actividad/auditoría del producto.
- Optimización de surtido embebida (`CatalogRedundancy`) en el detalle de categoría.

## Dependencias con otros módulos
- **Órdenes de compra / Reposición:** `OcDraftContext` (borrador), rutas `/comprar/decisiones`, `/comprar/borradores`, `/comprar/seguimiento`, `/comprar/aprobaciones`; recomendaciones (`mockRecommendations`).
- **Proveedores:** `/proveedores`, `/proveedores/:id` (incl. `?tab=negociacion`, `?tab=temporadas`); `mockSuppliers`, utilidades de desempeño y negociación.
- **Señales de ventas:** `SignalsContext` / `signalService`, `/senales-ventas`.
- **Aprobaciones / flujo de compra:** `PurchaseFlowContext` (aprobaciones del comprador).
- **Inventario y análisis:** `/inventario`, `/ventas`, `/analisis-compra`, `/venta-no-capturada`.
- **Margen por canal:** `mockChannelMargin`, `/margen-canal`.
- **Optimización de surtido:** `catalogOptimization`, `/surtido-redundante`.
- **Identidad y permisos:** `BuyerContext` (comprador activo), `RoleContext` (rol y alcance por defecto), `DataContext` (colección de productos en memoria), `ToastContext` (confirmaciones), autenticación (`RequireAuth`) a nivel de router.
