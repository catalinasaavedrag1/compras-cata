# Módulo: Mi plan

> Levantamiento funcional realizado **solo desde el frontend** (React + TypeScript, datos mock). Todo lo aquí descrito se basa en el código leído; donde algo no puede determinarse desde el código se marca como **"Definición pendiente"** o **"Suposición"**.

El módulo **"Mi plan"** (grupo de navegación `plan`, etiqueta lateral **"Mi plan"**, hint *"Metas, presupuesto, acciones y resultados"*) agrupa el desempeño personal del comprador, sus alertas, las señales que recibe de ventas, su aprendizaje de compra y los reportes de resultados.

Está compuesto por 5 pantallas (5 ítems de menú):

| Ítem menú | Ruta | Pantalla / componente |
|-----------|------|-----------------------|
| Metas | `/mi-desempeno` | `MyPerformancePage` |
| Alertas | `/alertas` | `AlertsPage` |
| Señales ventas | `/senales-ventas` | `SalesSignalsPage` |
| Aprendizaje de compra | `/aprendizaje` (acepta `?tab=decisiones`) | `AprendizajePage` (fusiona `PurchaseQualityPage` + `DecisionsPage`) |
| Resultados | `/reportes` | `ReportsPage` |

Notas de navegación relevantes (de `src/routes/AppRoutes.tsx`):
- Ninguna de estas 5 rutas está protegida por `RoleGate`; están accesibles a cualquier rol autenticado (`RequireAuth`). Las rutas con `RoleGate allow="lider"` son las de `/equipo/*` (fuera de este módulo).
- Rutas legadas que redirigen a este módulo: `/calidad-compra` → `/aprendizaje`; `/decisiones` → `/aprendizaje?tab=decisiones`.
- El comportamiento por rol dentro de las pantallas de Aprendizaje se controla por `useRole()` (no por guardas de ruta): el comprador ve solo lo suyo, el líder ve todo el equipo.

---

## Pantalla 1 — Mi desempeño (Metas)

### Nombre
Mi desempeño (título de página: **"Mi desempeño"**; etiqueta de menú: **"Metas"**).

### Ruta(s)
- `/mi-desempeno`

### Módulo
Mi plan.

### Objetivo funcional
Mostrar al comprador su **score** de desempeño, su **nivel/liga**, su **posición frente al equipo** (anonimizada) y, sobre todo, **cómo subir** ese score. Combina desempeño personal, gamificación (ligas, temporada, retos, premios), metas del mes y evaluación justa de quiebres.

### Tipo de usuario
Comprador (visión "mía", en primera persona: "Tu score", "Tus retos"). Accesible también para el líder por ruta, pero la vista está redactada para el comprador. El comprador "yo" se resuelve por `useBuyer()` (nombre del comprador seleccionado); si no coincide, cae a `getBuyer(CURRENT_BUYER_ID)`. Datos mock: lista `buyers` de `mockBuyers`.

### Descripción detallada
Página de solo lectura (no hay formularios). Toda la información se **deriva** de los datos mock del comprador y del equipo mediante utilidades de `utils/teamScore` y `utils/buyerAttribution`. El encuadre es deliberadamente positivo ("no solo el problema: también cómo subir") y el ranking del resto del equipo está **anonimizado** ("Comprador A/B/C…").

### Información que muestra
- **Foco de hoy**: la palanca de mayor impacto para subir el score (primer elemento de `improvements`), con el consejo (`SCORE_ADVICE`) y los puntos ganables (`+N pts`). Es un enlace a reposición.
- **Score gauge**: score 0–100 en un anillo `conic-gradient`, color según `scoreColor`, badge de **Nivel** (liga), tendencia vs semana anterior (`trendText`/`trendColor`), barra de progreso hacia la siguiente liga con "Faltan N pts para {liga}", y sparkline del historial (`me.scoreHist`).
- **Tarjetas resumen** (3): "Tu posición" (`#pos` de N compradores), "Percentil" (vs carga similar, `percentileSimilarLoad`), "Cumpl. metas" (`me.goalComp}%`).
- **Encuadre positivo**: frase "Vas #pos de N en general" y, si el mejor ranking específico está en top 3, "eres #k en {margen bruto / reducción de quiebres / rotación saludable / recuperación del mes}".
- **Indicadores vs promedio del equipo** (KPIs): Fill Rate, Nivel de servicio (SLA), Tiempo reposición (días), Quiebres; cada uno con el valor propio y "eq. {promedio}", coloreado verde/rojo según sea mejor o peor que el promedio del equipo (`teamAggregate`).
- **Tu temporada** (banner): nombre de la temporada (`SEASON.name`), "Cierra en N días" (`daysToClose`), nivel actual y puntos para el siguiente, y "Si cerrara hoy": movimiento de liga (`seasonStatus`: Ascenso/Descenso/Mantiene) con from → to.
- **Causa de tus quiebres**: barra e items con la atribución (`buyerAttribution`) en 3 causas — "Tu decisión", "Proveedor", "Demanda" — con conteo, porcentaje y descripción; nota de justicia (`fairNote`) y, si aplica, "Estos quiebres no deberían penalizar tu score".
- **Cómo subir mi score**: hasta 3 dimensiones más débiles ponderadas por impacto, cada una con `+N pts` y consejo.
- **Tus reconocimientos**: insignias del mes que el comprador lidera (`badgesOf` filtradas a `me`), o mensaje de que aún no lidera ninguna.
- **Tus retos de la semana**: lista de challenges (`ChallengeList`) filtrados a los del comprador (equipo, duelos donde participa, o rachas propias).
- **Tus novedades**: feed de competición filtrado al comprador (`CompetitionFeed`).
- **Premios en juego**: premios definidos por el líder (`rewards` desde `localStorage` `compras:rewards`, default `defaultRewards`), con quién los va ganando (`winnerByCriterion`) y si "Lo vas ganando tú".
- **Mis metas del mes**: filas de metas (`GoalRow`) con `me.goals`.
- **Ranking del equipo**: lista ordenada por score descendente, con medallas para top 3, mostrando "Tú" resaltado y el resto como "Comprador A/B/C…" (anonimizado), con el score de cada uno.

### Secciones/bloques
1. `PageHeader` (título + descripción).
2. Banner "Foco de hoy" (condicional a que exista `improvements[0]`).
3. Grid: Score gauge (izq.) + [3 tarjetas resumen, encuadre positivo, KPIs vs equipo] (der.).
4. Banner "Tu temporada".
5. Card "Causa de tus quiebres".
6. Grid: "Cómo subir mi score" + "Tus reconocimientos".
7. "Tus retos de la semana".
8. Grid: "Tus novedades" + "Premios en juego".
9. Grid: "Mis metas del mes" + "Ranking del equipo".

### Filtros disponibles
Ninguno. La pantalla no expone filtros ni buscador.

### Acciones del usuario
- Clic en **"Foco de hoy"** → navega a `/comprar/decisiones` (reposición). Es el único CTA interactivo real; el resto es lectura.
- Los componentes `ChallengeList` / `CompetitionFeed` pueden tener interacción propia (no verificado en detalle aquí — **Definición pendiente** sobre su interactividad interna).

### Botones y controles
- Enlace "Foco de hoy → Ir a reposición".
- No hay botones de formulario, toggles ni selects.

### Tablas/tarjetas/formularios/componentes
- Componentes UI: `PageHeader`, `Card/CardBody`, `Badge`, `Sparkline`, `GoalRow` (de `BuyerDetailDrawer`), `ChallengeList`, `CompetitionFeed`.
- Sin tablas (`DataTable`) ni formularios.

### Campos de formularios
No aplica (no hay formularios).

### Estados posibles (existentes / no aplican por datos mock)
- **Score/nivel/tendencia/temporada**: dependen del `Buyer` mock (`me.score`, `me.trend`, `me.prevSeasonScore`, `me.scoreHist`). Movimiento de temporada puede ser Ascenso/Descenso/Mantiene.
- **Reconocimientos**: estado "sin insignias lideradas" existe (mensaje alternativo) y estado con insignias.
- **Causa de quiebres**: estado "sin quiebres" (mensaje positivo) y estado con atribución.
- **Premios**: estado "lo vas ganando tú" vs "va ganando: {otro}".
- No hay estados de carga/errores/paginación (datos mock en memoria).

### Navegación hacia otras pantallas
- "Foco de hoy" → `/comprar/decisiones` (fuera del módulo; Comprar/Reposición).
- No hay otros enlaces salientes explícitos en esta página (los internos dependen de subcomponentes).

### Flujo funcional completo
1. Se resuelve el comprador "yo" (`useBuyer`).
2. Se calculan agregados de equipo, liga, percentil, mejoras, insignias, temporada, retos, feed y premios (todo derivado, en render).
3. El usuario ve su estado y su "foco de hoy"; el único paso accionable es ir a reposición para ejecutar la mejora sugerida.

### Reglas de negocio inferibles
- **Ligas** (`LEAGUES`): Bronce 0–59, Plata 60–74, Oro 75–84, Elite 85–94, Leyenda 95–100.
- **Puntos a siguiente liga** = `next.min - score`.
- **Mejoras / "cómo subir score"**: por cada dimensión del `breakdown`, `target = min(95, valor+15)`, `pts = round((target−valor)*peso/100)`; se muestran las de `pts ≥ 1`, top 3 por impacto.
- **Percentil por carga similar**: se compara solo con compradores de `workloadPct` dentro de ±20; si el grupo < 3, compara contra todos.
- **Atribución de quiebres** (`buyerAttribution`): proveedor 25–55%, demanda 10–30%, resto comprador; determinista por hash del id; `scoreAdjust = round(externos*0.8)`. Regla explícita: "no todo quiebre es culpa del comprador".
- **Ranking anonimizado**: solo se identifica "Tú"; los demás son "Comprador A, B, C…" (encuadre para no exponer a pares).
- **Insignias del mes** (`badgesOf`): mejor margen, menos quiebres, mejor rotación, mayor mejora, mejor sobrestock, mejor negociador (ahorro).
- **Premios** (`winnerByCriterion`): criterios general/mejora/quiebres/margen/rotación.

### Validaciones
No aplica (sin entradas de usuario).

### Permisos/restricciones
- Ruta sin `RoleGate`: accesible a comprador y líder. La vista está pensada para el comprador (primera persona). **Suposición**: el líder normalmente usaría el módulo "Líder" (`/equipo/*`) en su lugar.
- El ranking de terceros está intencionalmente anonimizado.

### Dudas/definiciones pendientes
- Interactividad interna de `ChallengeList` y `CompetitionFeed` (no revisada en profundidad). **Definición pendiente**.
- Origen real de `SEASON`, `challenges`, `competitionFeed`, `rewards` (todo mock/localStorage). En producción tendrían backend. **Suposición**.
- Los premios se "definen por el líder", pero desde esta pantalla no se editan; su edición estaría en otra pantalla del rol líder. **Definición pendiente**.

---

## Pantalla 2 — Alertas comerciales

### Nombre
Alertas comerciales (título **"Alertas comerciales"**; menú **"Alertas"**).

### Ruta(s)
- `/alertas`

### Módulo
Mi plan.

### Objetivo funcional
Bandeja tipo "inbox" de **problemas comerciales que requieren atención del comprador**, cada uno con descripción, recomendación y una **acción sugerida concreta** según su tipo (por ejemplo, agregar a OC, ver proveedor, ver venta no capturada). Permite gestionar el estado (en revisión / resuelta).

### Tipo de usuario
Comprador (redacción "tu atención"). Ruta sin restricción de rol. Datos mock: `alerts` de `mockAlerts` (semilla), con **override de estado persistido** en `localStorage` (`compras:alert-status`).

### Descripción detallada
Layout maestro-detalle: barra de filtros → KPIs clicables → tabs por estado → lista (inbox agrupada por antigüedad) + panel de detalle (escritorio) o drawer (móvil). El estado de cada alerta puede cambiarse y se recuerda vía `useLocalStorage`.

### Información que muestra
- **KPIs** (4, clicables): Alertas activas (new + in_review), Severidad alta (alta y activa), En revisión, Resueltas.
- **Resumen de filtros**: "N alertas · M alta severidad · K en revisión".
- **Lista (inbox)**: por cada alerta — severidad (`SeverityBadge`), grupo de tipo (`TYPE_GROUP`: Stock/OC/Proveedor/Demanda/Margen/Oportunidad), indicador "no leída" (status `new`), fecha, entidad relacionada, descripción (2 líneas), badge de estado, y botón de acción sugerida.
- **Detalle**: severidad, tipo (`ALERT_TYPE_LABELS`), estado, fecha; entidad (enlace al producto si hay `relatedSku`); descripción; **Recomendación**; botones de acción; bloque "Detalle" con Responsable, Fecha y SKU.

### Secciones/bloques
1. `PageHeader`.
2. `FilterBar` (filtros).
3. Grid de 4 `KpiCard`.
4. `Tabs` por estado (con conteos).
5. Lista agrupada por tiempo + Detalle (escritorio) / `Drawer` (móvil), o `EmptyState`.

### Filtros disponibles
En `FilterBar`:
- **Buscador**: por producto, proveedor o SKU (`filterAlerts` por query).
- **Rango de fechas**: "Fecha de alerta" (`inRange` sobre `a.date`).
- **Select Severidad**: Alta / Media / Baja.
- **Select Tipo de alerta**: todas las claves de `ALERT_TYPE_LABELS` (Quiebre de stock, Riesgo de quiebre, Sobrestock, Margen bajo, Costo aumentado, Proveedor atrasado, Producto sin venta, Alta demanda inesperada, Producto sin proveedor, OC atrasada, Compra sugerida alta, Stock muerto, Costo sin actualizar, Sin compra reciente, Temporada próxima, Oportunidad no capturada).
- **Select Responsable**: derivado de los `responsible` únicos de la semilla.
- **Tabs (no son "filtro" de la barra pero filtran el listado)**: Activas, Nuevas, En revisión, Resueltas, Ignoradas.
- Botón **Limpiar** (resetea query, tipo, severidad, responsable y fechas).

Nota: los filtros de la barra controlan KPIs, conteos y listado; la pestaña filtra adicionalmente por estado sobre ese subconjunto.

### Acciones del usuario
- Seleccionar una alerta (clic en la fila) → muestra el detalle (y abre drawer en móvil).
- **Acción sugerida** por alerta (`actionForAlert`):
  - Si hay recomendación de compra para el SKU (`recommendations` con `suggestedQuantity > 0`): "Agregar a OC" (agrega al borrador vía `useOcDraft.addItem`; si ya está, "Agregado a OC" deshabilitado). Toast con enlace "Ver borrador OC" → `/comprar/borradores`.
  - `po_delayed` → "Ver órdenes de compra" → `/comprar/seguimiento`.
  - `supplier_delay` → "Revisar proveedor" → `/proveedores`.
  - `lost_opportunity` / `no_recent_purchase` → "Ver venta no capturada" → `/venta-no-capturada`.
  - Con `relatedSku` (sin recomendación) → "Ver producto" → `/productos/{sku}`.
- **Marcar en revisión** (solo si status `new`) → `setStatus(id, "in_review")` + toast.
- **Marcar resuelta** (si no está resuelta/ignorada) → `setStatus(id, "resolved")` + toast.
- Cambiar de pestaña o hacer clic en KPIs (los KPIs cambian pestaña y/o severidad).

### Botones y controles
- 4 `KpiCard` clicables (con estado `active`).
- `Tabs` (5).
- Buscador, 3 selects, rango de fechas, botón Limpiar.
- Filas de lista clicables + botón de acción inline.
- En detalle: botón de acción primaria, "Marcar en revisión", "Marcar resuelta".
- `Drawer` móvil (cerrar).

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `FilterBar`, `KpiCard`, `Tabs`, `Card`, `Drawer`, `EmptyState`, `Button`, `SeverityBadge`, `StatusBadge`, `Badge`. Subcomponentes locales `AlertRow` y `AlertDetail`.
- No hay `DataTable` ni formulario de entrada; el "detalle" es una tarjeta de lectura + botones.

### Campos de formularios
No aplica (no hay formularios; solo cambios de estado por botón).

### Estados posibles (existentes / no aplican por datos mock)
- **Estados de alerta** (`AlertStatus`): `new`, `in_review`, `resolved`, `ignored`. La pestaña "Activas" = new + in_review.
  - Existentes por datos mock: al menos `new` e `in_review` están en la semilla. `ignored` **existe como estado/tab/select pero no hay acción en la UI para asignarlo** (no hay botón "Ignorar"); solo podría venir precargado en el mock. **Definición pendiente** sobre cómo se marca "Ignorada".
  - `resolved` se alcanza desde la UI ("Marcar resuelta").
- **Severidad**: high/medium/low.
- **EmptyState**: dos variantes — "No hay alertas activas" (con CTA "Ir a reposición") y "Sin alertas en esta vista".
- No hay estados de carga/errores (mock + localStorage).

### Navegación hacia otras pantallas
- `/comprar/borradores`, `/comprar/seguimiento`, `/proveedores`, `/venta-no-capturada`, `/productos/{sku}` (según acción/tipo).
- `/comprar/decisiones` desde el CTA del `EmptyState` activo.

### Flujo funcional completo
1. El comprador entra a la bandeja; ve KPIs y alertas activas ordenadas por severidad y agrupadas por antigüedad (Hoy/Ayer/Esta semana/Anteriores).
2. Filtra/busca según necesidad; selecciona una alerta.
3. Lee descripción + recomendación; ejecuta la acción sugerida (p.ej. agregar a OC) o navega al recurso relacionado.
4. Marca la alerta en revisión y/o resuelta; el estado persiste en `localStorage`.

### Reglas de negocio inferibles
- **Orden de la lista**: por severidad (high→medium→low).
- **Activas** = new + in_review.
- **Alta severidad (KPI)** = severidad high y estado activo.
- **Agrupación temporal** basada en `TODAY_ISO` (constante mock, no fecha real del sistema).
- La acción sugerida prioriza convertir la alerta en compra cuando existe recomendación con cantidad > 0.

### Validaciones
- No hay validación de entrada. Único control: botón de acción "Agregar a OC" se **deshabilita** si el SKU ya está en el borrador (`hasItem`).

### Permisos/restricciones
- Ruta sin `RoleGate`. Redactada para comprador. **Suposición**: alertas del equipo completo se ven en `/equipo/alertas` (rol líder).
- Persistencia de estado es por navegador (localStorage), no por usuario/backend.

### Dudas/definiciones pendientes
- No existe acción para marcar "Ignorada" desde la UI. **Definición pendiente**.
- El campo `responsible` de cada alerta sugiere que las alertas no son necesariamente del comprador logueado (aparecen varios responsables en el mock); sin embargo, la barra permite filtrar por responsable pero no filtra por "mías" automáticamente. **Suposición**: en `/alertas` se ven todas y el filtro por responsable es manual.
- Origen de `recommendation` por alerta (campo `alert.recommendation`) y su relación con `recommendations` de reposición: son fuentes distintas. **Definición pendiente**.

---

## Pantalla 3 — Señales de Ventas

### Nombre
Señales de Ventas (título **"Señales de Ventas"**; menú **"Señales ventas"**).

### Ruta(s)
- `/senales-ventas`

### Módulo
Mi plan.

### Objetivo funcional
Canalizar lo que el **equipo de ventas** detecta en terreno (quiebres, demanda, oportunidades, errores de precio, sugerencias) hacia el comprador. El comprador **recibe, analiza con datos de apoyo, conversa, decide** (convierte en compra, avanza el flujo o rechaza) y **todo queda registrado** (timeline/trazabilidad). Incluye captura rápida de señales (modo vendedor).

### Tipo de usuario
- **Comprador**: recibe y gestiona señales (bandeja, detalle, decisión, conversación, asignación).
- **Vendedor (modo)**: reporta señales mediante el modal (identificándose entre una lista fija de vendedores). El "modo vendedor" es un badge del modal; no hay un rol de sesión "vendedor" (los roles de sesión son comprador/líder).

Datos mock: `useSignals()` (semilla `signalService.list()` + creadas + parches en `localStorage` `compras:signals`).

### Descripción detallada
Bandeja tipo inbox con analítica agregada, filtros ricos, KPIs, tabs por estado del flujo y panel de detalle completo con acciones de decisión, conversación comprador↔vendedor, asignación e historial. Las señales son explícitamente **de terreno** (badge "Terreno"), no alertas automáticas.

### Información que muestra
- **FlowStrip**: pasos del proceso — Ventas reporta › Comprador recibe › Analiza con datos › Decide › Queda registrado.
- **KPIs** (5): Nuevas (`status=new`), Quiebres reportados (tipos stockout activos), Por revisar (new + in_review), Aceptadas, Venta perdida est. (suma de `estimatedLostSale` en señales activas, formato compacto CLP).
- **Resumen de señales (analítica)**: Top productos reportados, Top tiendas con señales, Productos más solicitados (por `customersAsking`) — como `MiniBar`/`BarList`.
- **Bandeja**: por señal — prioridad, tipo corto (`SIGNAL_TYPE.short`), badge "Terreno", indicador "sin revisar" (new), badge "Para mí" (si asignada al comprador actual), fecha, nombre de producto, comentario (2 líneas), estado (`SIGNAL_STATUS`), canal + tienda.
- **Detalle** (`SignalDetail`): tipo, "Terreno", prioridad, estado; producto (enlace o "Producto nuevo"); categoría/marca/canal/tienda; motivo del reporte + reportado por + fecha/hora; **Solicitud de compra** (cliente, cantidad, fecha requerida, precio objetivo, proveedor sugerido, costo cotizado, margen esperado) editable; evidencia (clientes que preguntaron, venta perdida, nota); acción recomendada por ventas; **Datos de apoyo para decidir** (stock, venta 30d, rotación, margen, quiebres 30d, tiendas afectadas); toolbar de decisión; asignación; conversación; historial/timeline.

### Secciones/bloques
1. `PageHeader` con acción "Reportar señal".
2. `FlowStrip`.
3. `FilterBar`.
4. Grid de 5 `KpiCard`.
5. Card "Resumen de señales" (3 mini-barras).
6. `Tabs` (6) con conteos.
7. Bandeja + `SignalDetail` (escritorio) / `Drawer` (móvil), o `EmptyState`.
8. `ReportSignalModal` (modal de captura).

### Filtros disponibles
En `FilterBar`:
- **Buscador**: producto, SKU, categoría o vendedor (`reportedBy`).
- **Toggles**: "Asignadas a mí" (`mine`, compara `assignedBuyer === buyer`), "Sólo quiebres" (`onlyStockout`, `STOCKOUT_TYPES`).
- **Selects**: Prioridad (Alta/Media/Baja), Tipo de señal (todas las claves de `SIGNAL_TYPE`), Canal (Tienda/Web/Marketplace/Call center), Tienda/punto (derivado), Categoría (derivado), Comprador (asignados derivados).
- **Rango de fechas**: "Fecha de la señal".
- Botón **Limpiar** (resetea todo lo anterior incluidos toggles).
- **Tabs**: Por revisar (new + in_review), En gestión (`sourcing/quoted/awaiting_customer/purchased`), Aprobadas (accepted), Resueltas, Rechazadas, Todas.

### Acciones del usuario
- **Reportar señal** (abre `ReportSignalModal`, modo vendedor).
- Seleccionar señal (bandeja → detalle / drawer móvil).
- **Convertir en compra** (`convert`): agrega ítem al borrador de OC (`useOcDraft`), marca la señal `accepted` (`markConverted`), toast con enlace a `/comprar/borradores`. Deshabilitado si ya está en el borrador.
- **Avanzar el flujo** (`advance`, botón cuyo texto depende del estado — ver STEP): new→in_review ("Marcar en revisión"), in_review→sourcing ("Consultar proveedor"), sourcing→quoted ("Registrar cotización"), quoted→awaiting_customer ("Esperar respuesta cliente"), awaiting_customer→accepted ("Aprobar"), accepted→purchased ("Marcar comprado"), purchased→resolved ("Marcar resuelto").
- **Rechazar** (con motivo obligatorio ≥ 3 caracteres) → estado `rejected`.
- **Editar/Completar "Solicitud de compra"** (cliente, cantidad, fecha requerida, precio objetivo, proveedor sugerido, costo cotizado) → `updateRequest`.
- **Asignar comprador** (select "Comprador asignado" o acción "Asignármela" en `MoreActions`) → `assign`.
- **Conversar con ventas** (input de mensaje + Enviar) → `addMessage` (rol buyer).
- **MoreActions**: "Ver historial del producto" (`/productos/{sku}`), "Ver ventas recientes" (`/productos/{sku}?tab=ventas`), "Asignármela".
- Ver/ocultar **historial** (timeline).
- KPIs y toggles clicables cambian pestañas/filtros.

### Botones y controles
- Botón header "Reportar señal".
- 5 `KpiCard` (clicables), 6 `Tabs`, `FilterBar` (buscador, 2 toggles, 6 selects, rango, Limpiar).
- En detalle: "Convertir en compra", botón de avance de flujo, "Rechazar" (→ textarea + "Confirmar rechazo"/"Cancelar"), "Editar/Completar" solicitud (+ inputs + Guardar/Cancelar), select de asignación, `MoreActions`, input+Enviar de conversación, toggle historial.
- `Modal` de reporte (ver campos abajo).

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `FilterBar`, `KpiCard`, `BarList`/`MiniBar`, `Tabs`, `Card`, `Drawer`, `EmptyState`, `Badge`, `Button`, `SignalDetail`, `ReportSignalModal`, `MoreActions`. Subcomponentes locales: `FlowStrip`, `SignalRow`, helpers `aggCount`/`aggSum`.
- Formularios: modal de reporte y sub-formularios en el detalle (solicitud de compra, mensaje, rechazo, asignación).

### Campos de formularios
**Modal "Reportar señal de ventas"** (`ReportSignalModal`, modo vendedor):
- **Tipo** (`SignalType`, botones): Quiebre, Sin stock (asked_no_stock), Muy pedido (high_demand), Demanda (unexpected_demand), Reponer (restock), Precio (price_error), Campaña (campaign), Liquidar (liquidation), Baja rotación (low_rotation), Nuevo (customer_suggested). Cada tipo muestra un `hint`.
- **Producto**: buscador en surtido (nombre/SKU/marca, sugerencias, `pickProduct`) **o** "Producto nuevo (sin SKU)" (nombre + categoría). "Sugerido por cliente" fuerza producto nuevo.
- **Canal** (store/web/marketplace/call_center) y **Tienda/Punto** (si store: Balmaceda San Javier / Chorrillos San Javier; si no, punto fijo por canal).
- **Prioridad** (Alta/Media/Baja) — **sugerida automáticamente** (`suggestPriority`) salvo que el usuario la toque; muestra el porqué.
- **¿Qué pasó?** (comentario, obligatorio, textarea).
- **Evidencia (opcional, plegable)**: Clientes que preguntaron (número), Venta perdida estimada CLP (número), Nota/link/foto (texto).
- **Reportado por** (select de 6 vendedores fijos).

**Sub-formulario "Solicitud de compra"** (en detalle): Cliente (texto), Cantidad (número), Fecha requerida (date), Precio objetivo (número CLP), Proveedor sugerido (texto), Costo cotizado (número CLP).

**Rechazo**: textarea "¿Por qué rechazas esta señal?".

**Conversación**: input de texto libre.

### Estados posibles (existentes / no aplican por datos mock)
- **Estados de señal** (`SignalStatus`): new (Solicitado), in_review (En revisión), sourcing (Consultando proveedor), quoted (Cotizado), awaiting_customer (Esperando cliente), accepted (Aprobado), purchased (Comprado), rejected (Rechazado), resolved (Resuelto). Todos alcanzables desde la UI vía el flujo STEP + rechazo.
- "Para mí" (asignada al comprador actual), "Sin asignar".
- `EmptyState`: "No hay señales en esta vista" (con CTA "Reportar señal").
- Producto nuevo vs producto del surtido.
- No hay estados de carga/errores (mock + localStorage).

### Navegación hacia otras pantallas
- `/comprar/borradores` (tras convertir), `/productos/{sku}` y `/productos/{sku}?tab=ventas` (desde detalle/MoreActions).

### Flujo funcional completo
1. Ventas reporta una señal (modal); nace en estado `new` con timeline "Señal reportada desde {tienda}" y un primer mensaje del vendedor.
2. El comprador la recibe en "Por revisar"; la analiza con los datos de apoyo y la conversación.
3. Decide: la **convierte en compra** (→ accepted + ítem en borrador OC), la **avanza** por el flujo de gestión (in_review→sourcing→quoted→awaiting_customer→accepted→purchased→resolved), o la **rechaza** con motivo.
4. Puede completar la "Solicitud de compra", asignarla a un comprador y conversar con ventas.
5. Cada acción deja evento en el timeline (trazabilidad). Todo persiste en `localStorage`.

### Reglas de negocio inferibles
- **Prioridad sugerida** (`suggestPriority`): Alta si quiebre con ≥3 clientes o sin stock, o error de precio; Media si quiebre con algo de stock o demanda con ≥3 solicitudes o demanda al alza; Baja para observaciones/sugerencias.
- **Orden de bandeja**: por prioridad (high→medium→low) y luego fecha descendente.
- **Venta perdida (KPI)** suma solo señales activas (no resueltas/rechazadas).
- **Convertir** usa la recomendación del SKU si existe (`suggestedQuantity>0`); si no, calcula cantidad desde el producto (`maxStock−totalStock`, o ~`ventas30*1.5`, mínimo 1/10).
- **Margen esperado** = (precio objetivo − costo cotizado)/precio objetivo; se marca "bad" si < 20%.
- Señales "abiertas" = todo excepto resolved/rejected (habilita botones de decisión).

### Validaciones
- **Reportar**: `canSubmit` = nombre de producto > 1 carácter, comentario > 2 caracteres, y (si producto nuevo) categoría no vacía. Botón "Enviar señal" deshabilitado si no cumple.
- **Rechazo**: motivo con `trim().length ≥ 3` (botón "Confirmar rechazo" deshabilitado si no).
- **Mensaje**: no se envía si está vacío (`draft.trim()`).
- **Convertir**: deshabilitado si el SKU ya está en el borrador de OC.

### Permisos/restricciones
- Ruta sin `RoleGate`: accesible a comprador/líder. La captura de señal es "modo vendedor" pero cualquiera con acceso a la pantalla puede abrir el modal (no hay gating por rol de sesión).
- Toggle "Asignadas a mí" usa el comprador actual (`useBuyer`), no el rol.
- Persistencia por navegador (localStorage), no por usuario/backend.

### Dudas/definiciones pendientes
- No hay rol de sesión "vendedor"; el reporte se hace en "modo vendedor" con lista fija de 6 vendedores. **Definición pendiente** sobre autenticación real de ventas.
- `reportDefaults` está fijado en `undefined` en esta página (el modal soporta defaults por producto, usado en otras pantallas como Ficha de producto). **Suposición**.
- Lista de tiendas del modal está hardcodeada (2 tiendas). **Definición pendiente** sobre catálogo real de puntos.

---

## Pantalla 4 — Aprendizaje de compra (Calidad + Historial de decisiones)

### Nombre
Aprendizaje de compra (título **"Aprendizaje de compra"**; menú **"Aprendizaje de compra"**, marcado `secondary`).

### Ruta(s)
- `/aprendizaje` (sub-pestaña "Calidad de compra" por defecto).
- `/aprendizaje?tab=decisiones` (sub-pestaña "Historial de decisiones").
- Redirecciones legadas: `/calidad-compra` → `/aprendizaje`; `/decisiones` → `/aprendizaje?tab=decisiones`.

### Módulo
Mi plan.

### Objetivo funcional
Vista única de **aprendizaje** que fusiona dos ángulos:
1. **Calidad de compra**: ¿se compró corto, saludable o de más? Compara "días comprados" (cantidad ÷ venta diaria) vs el rango objetivo de cobertura de cada producto.
2. **Historial de decisiones**: auditoría de qué sugería el sistema, qué se compró, por qué se desvió y cómo resultó — "para no repetir errores".

### Tipo de usuario
- **Comprador**: ve **solo sus** compras/decisiones (filtrado por `buyerName === buyer`).
- **Líder**: ve las de **todo el equipo** (`role === "lider"`).

Datos mock: `purchaseQualityLines()` (derivadas de `mockPurchaseOrders` + `mockProducts` + `mockRules`) y `usePurchaseFlow().decisions` (base `mockDecisions`).

### Descripción detallada
`AprendizajePage` renderiza un `PageHeader` común y un `Tabs` de dos sub-pestañas; embebe `PurchaseQualityPage` (embedded) o `DecisionsPage` (embedded) según `?tab`. El estado de pestaña se guarda en la URL (`useUrlState("tab")`).

### Información que muestra
**Sub-pestaña "Calidad de compra"** (`PurchaseQualityPage`):
- KPIs (5): Líneas evaluadas, Compras saludables (con % del total con venta), Compras cortas, Compras altas, Sobrecompras.
- Tabla de líneas de compra: Producto (enlace a `/productos/{sku}`, con OC y comprador), Proveedor (enlace), Comprado (u.), Días comprados, Objetivo (rango d), Monto, Resultado (badge de clase).

**Sub-pestaña "Historial de decisiones"** (`DecisionsPage`):
- KPIs (4): Decisiones registradas, Compró bien, Sobrecompras, Compras cortas.
- Lista de tarjetas por decisión: producto (enlace) + badge de resultado; fecha, comprador, quién aprobó, proveedor (enlace); Sugerido vs Comprado vs Desvío (u. y %); Motivo; Resultado (con días); Aprendizaje (destacado si existe).

### Secciones/bloques
1. `PageHeader` (común).
2. `Tabs` (Calidad de compra / Historial de decisiones).
3. Contenido embebido de la sub-pestaña activa (KPIs + filtros + tabla/lista).

### Filtros disponibles
**Calidad de compra**:
- Buscador: producto, OC, comprador o proveedor.
- Select **Resultado** (`PurchaseClass`): Compra corta, Saludable, Compra alta, Sobrecompra, Sin venta.
- Botón Limpiar. (Estado en URL: `q`, `tipo`.)

**Historial de decisiones**:
- Buscador: producto, comprador o proveedor.
- Select **Resultado** (`DecisionOutcome`): Compró bien, Sobrecompró, Compró corto, En medición.
- Botón Limpiar. (Estado en URL: `q`, `resultado`.)

### Acciones del usuario
- Cambiar de sub-pestaña (persiste en URL).
- Filtrar/buscar en cada sub-pestaña.
- Navegar a productos (`/productos/{sku}`) y proveedores (`supplierPath`) desde enlaces.
- No hay acciones de escritura (ambas vistas son de lectura/auditoría).

### Botones y controles
- `Tabs` (2).
- Buscador + select Resultado + Limpiar (en cada sub-pestaña).
- Enlaces a producto/proveedor.
- `InfoHint` (ayuda) en los headers de cada sub-pantalla — **pero solo cuando NO están embebidas**: en `AprendizajePage` van `embedded`, por lo que se omite su propio `PageHeader`/`help`. El `InfoHint` con explicaciones ("Qué son los días comprados", "Qué guarda cada decisión") no se muestra dentro de la vista fusionada. **Nota importante.**

### Tablas/tarjetas/formularios/componentes
- `PageHeader`, `Tabs`, `KpiCard`, `FilterBar`, `Badge`, `DataTable` (Calidad), `Card/CardBody` (Decisiones), `EmptyState`, `InfoHint` (no visible en modo embebido).
- Sin formularios de entrada.

### Campos de formularios
No aplica (solo buscador y select de filtro).

### Estados posibles (existentes / no aplican por datos mock)
- **Clase de compra** (`PurchaseClass`): corta, saludable, alta, sobrecompra, sin_venta. Todas derivadas de reglas; presencia depende del mock.
- **Resultado de decisión** (`DecisionOutcome`): bueno, sobrestock, corto, pendiente ("En medición").
- **EmptyState** en Decisiones ("Sin decisiones"). Calidad usa el `emptyMessage`/render de la tabla.
- Diferencias por rol: comprador (subconjunto propio) vs líder (todo el equipo).
- No hay estados de carga/errores (mock).

### Navegación hacia otras pantallas
- `/productos/{sku}` (ambas sub-pestañas).
- Ficha de proveedor vía `supplierPath(...)` (ambas).

### Flujo funcional completo
1. El usuario abre Aprendizaje; por defecto ve "Calidad de compra".
2. Revisa cuántas compras fueron saludables/cortas/altas/sobrecompras y detalla líneas; filtra por resultado o busca.
3. Cambia a "Historial de decisiones" para auditar el porqué de los desvíos y el aprendizaje registrado.
4. Usa los enlaces para profundizar en producto/proveedor.

### Reglas de negocio inferibles
- **Días comprados** = cantidad ÷ venta diaria esperada (`monthlySales/30`).
- **Objetivo** = `targetInventoryDays` de la regla aplicable (`resolveRuleForProduct`), o 45 por defecto; rango objetivo = `[obj*0.7, obj*1.3]` redondeado.
- **Clasificación**: sin venta si demanda diaria ≤ 0; corta si días < objMin; saludable si ≤ objMax; alta si ≤ objMax*1.8; sobrecompra si mayor.
- **% saludables** se calcula sobre líneas con venta (excluye "sin venta").
- **Alcance por rol**: comprador solo evalúa sus compras; líder ve todo el equipo (regla explícita en el código).
- **Decisiones** guardan sugerido vs comprado, motivo del desvío, quién aprobó (`approvedBy`, "—" si nadie), resultado y aprendizaje; desvío = comprado − sugerido (u. y %).

### Validaciones
No aplica (sin entradas de escritura).

### Permisos/restricciones
- Ruta sin `RoleGate`, pero el **contenido depende del rol** (`useRole`): comprador ve lo suyo, líder ve todo. Esta es la restricción funcional clave del módulo.

### Dudas/definiciones pendientes
- Al embeber, se pierde el `InfoHint` explicativo (ayuda sobre "días comprados" / "qué guarda cada decisión"). ¿Intencional? **Definición pendiente**.
- Relación entre "Calidad de compra" (derivada de OC+reglas) y "Historial de decisiones" (mock curado): son fuentes distintas; no se cruzan entre sí. **Suposición**.
- `usePurchaseFlow().decisions` puede incluir decisiones generadas por el flujo de compra además de `mockDecisions`. No verificado el origen completo. **Definición pendiente**.

---

## Pantalla 5 — Resultados (Reportes consolidados)

### Nombre
Reportes consolidados (título **"Reportes consolidados"**; menú **"Resultados"**, marcado `secondary`).

### Ruta(s)
- `/reportes`

### Módulo
Mi plan.

### Objetivo funcional
Centralizar **reportes operativos y estratégicos** de compras, inventario y proveedores que la plataforma no tenía consolidados, cada uno **exportable a CSV (Excel)**. Todo se **deriva** de los datos mock existentes mediante agregaciones (sin inventar campos).

### Tipo de usuario
Comprador / Líder (ruta sin restricción). Los reportes NO filtran por comprador logueado: son **consolidados de toda la operación** (p. ej. "Compras por comprador" lista a todos). **Suposición**: pensado como cierre/resultados del módulo, útil a ambos roles.

### Descripción detallada
Una sola página con `Tabs` que conmuta entre 8 reportes; KPIs globales arriba; filtro de fechas solo para reportes con datos temporales (OC). Cada reporte es una tabla ordenable con botón de exportación CSV (uno en el header de página vía `ExportLauncher` y otro por reporte vía `ExportButton`).

### Información que muestra
- **KPIs globales** (4): Monto comprado (total OC o en rango), Órdenes de compra (OC en alcance), Proveedores (con compras), Categorías activas (con stock o venta).
- **8 reportes** (`REPORTS`):
  1. **Compras por proveedor**: Nº OC, Monto comprado, Monto prom. OC.
  2. **Compras por categoría**: Nº líneas, Unidades, Monto (derivado uniendo líneas de OC con el producto por SKU; incluye `HelpNote` con cuántas OC tienen líneas).
  3. **Compras por comprador**: Nº OC, Monto, Monto prom. OC.
  4. **OC abiertas / atrasadas**: KPIs (OC abiertas, OC atrasadas, Monto pendiente) + tabla (OC, Proveedor, Estado, Fecha esperada, Atraso, Monto); filas atrasadas resaltadas.
  5. **Rotación e inventario**: por producto (Categoría, Rotación/año, Días inventario, Stock, Venta 30d).
  6. **Margen por categoría**: Nº SKUs, Margen prom., Valor inventario.
  7. **Productos sin venta / críticos**: KPIs (Sin venta 30d, Críticos) + tabla (Motivo, Stock, Cobertura, Capital detenido).
  8. **Cumplimiento de proveedores** ("peores"): Cumplimiento, Lead time, OC abiertas, Monto pendiente, Estado; `HelpNote` con umbrales.

### Secciones/bloques
1. `PageHeader` con `ExportLauncher` (exporta el reporte visible).
2. Grid de 4 `KpiCard` globales.
3. `Tabs` (8 reportes).
4. `FilterBar` de fechas (solo reportes temporales).
5. Bloque del reporte activo (a veces con `HelpNote` y/o KPIs propios) + `DataTable` con `ExportButton`.

### Filtros disponibles
- **Rango de fechas** (`FilterBar`): solo para reportes `compras_proveedor`, `compras_categoria`, `compras_comprador`, `oc_abiertas` (por `createdAt` de la OC). Sin rango = todas las OC. Botón Limpiar.
- **Ordenamiento por columna** (sort) en cada tabla (independiente por reporte; toggle asc/desc vía `makeToggleSort`).
- No hay buscador de texto (el `FilterBar` de fechas tiene el buscador deshabilitado).

### Acciones del usuario
- Cambiar de reporte (Tabs).
- Ajustar rango de fechas (reportes temporales).
- Ordenar por cualquier columna sortable.
- **Exportar CSV** (header con `ExportLauncher` y/o botón por reporte con `ExportButton`).
- Navegar: la tabla de OC abiertas usa `StatusBadge` (sin enlace directo evidente); Rotación/Margen/Alertas no enlazan a ficha en este reporte (a diferencia de Calidad). **Nota**: no se detectaron enlaces salientes a producto/proveedor en las columnas de estos reportes.

### Botones y controles
- 8 `Tabs`.
- `ExportLauncher` (header) + `ExportButton` por `CardHeader`.
- Encabezados de columna ordenables.
- `FilterBar` de fechas (+ Limpiar) en reportes temporales.
- KPIs (no clicables aquí; son informativos).

### Tablas/tarjetas/formularios/componentes
- `PageHeader`, `KpiCard`, `Tabs`, `FilterBar`, `DataTable` (con `mobileCard`), `Badge`, `StatusBadge`, `HelpNote`, `ExportButton`, `ExportLauncher`. Definiciones y CSV en `src/pages/reports/definitions.ts` y `csv.ts`.
- Sin formularios de entrada.

### Campos de formularios
No aplica. (El "formulario" es solo el rango de fechas.) Columnas CSV por reporte definidas en `csv.ts` (p. ej. supplierCsv, categoryCsv, buyerCsv, openCsv, rotationCsv, marginCsv, alertCsv, perfCsv).

### Estados posibles (existentes / no aplican por datos mock)
- **OC abiertas** (`OPEN_PO_STATUSES`): draft, pending_approval, approved, sent, confirmed, partially_received, with_difference, delayed. **Atrasada** = estado `delayed` o `delayedDays>0` o fecha esperada ya pasada vs `TODAY_ISO`.
- **Productos**: "sin venta" (0 ventas 30d con stock → capital detenido) vs "crítico" (con venta y cobertura ≤ lead time).
- **Cumplimiento proveedor**: verde ≥85%, ámbar 70–84%, rojo <70%.
- **emptyMessage** por tabla (p. ej. "No hay OC para los filtros actuales", "No hay líneas de OC para desglosar por categoría en el rango").
- No hay estados de carga/errores (todo derivado en memoria de mocks).

### Navegación hacia otras pantallas
- No se detectan enlaces de navegación salientes desde las filas (los reportes son de consulta/exportación). **Nota**: a diferencia de otras pantallas, aquí no hay `Link` a producto/proveedor.

### Flujo funcional completo
1. El usuario elige un reporte (Tab).
2. Si es temporal, acota por rango de fechas; los KPIs globales y la tabla se recalculan (`scopedOrders`).
3. Ordena por la columna de interés (top/bottom).
4. Exporta a CSV para trabajar en Excel.

### Reglas de negocio inferibles
- **Compras por categoría**: las OC no guardan categoría; se une cada línea con su producto por SKU y se suma `cantidad × costo unitario`. Solo aportan OC con líneas (se informa "X de N OC tienen líneas").
- **Monto comprado** = suma de `totalAmount` de las OC en alcance.
- **Categorías activas** = categorías de productos con venta 30d > 0 o stock > 0.
- **Cobertura** = `coverageDays(stock, ventas30)`; **crítico** si cobertura ≤ lead time del proveedor.
- **Capital detenido** = stock × costo (solo para "sin venta").
- **Fechas**: usan `TODAY_ISO` (constante mock), no la fecha real.

### Validaciones
No aplica (sin entradas de escritura; solo rango de fechas y orden).

### Permisos/restricciones
- Ruta sin `RoleGate`. Reportes consolidados de toda la operación (no filtrados por el comprador logueado). **Suposición**: accesibles a comprador y líder por igual.

### Dudas/definiciones pendientes
- Duplicidad de botones de exportación (header `ExportLauncher` + `ExportButton` por reporte): ambos exportan lo mismo. **Suposición**: redundancia por diseño.
- Reportes no enlazan a fichas (producto/proveedor). ¿Deseado? **Definición pendiente**.
- Alcance del filtro de fechas: solo 4 de 8 reportes lo usan; los otros (rotación, margen, alertas de producto, cumplimiento) son "estado actual" sin dimensión temporal. **Confirmado en código.**

---

## RESUMEN DEL MÓDULO "Mi plan"

### Objetivo
Dar al comprador una vista integral de **su propio plan de trabajo y desempeño**: cómo va (score, nivel, metas), qué problemas atender (alertas), qué está detectando el terreno (señales de ventas), qué aprender de sus compras (calidad + decisiones) y qué resultados consolidados existen (reportes). Combina gestión operativa, gamificación motivacional y aprendizaje/auditoría, con foco en "cómo mejorar", evaluación justa (atribución de causas) y trazabilidad.

### Pantallas
1. **Mi desempeño / Metas** (`/mi-desempeno`): score, liga, temporada, retos, premios, metas, ranking anonimizado, "cómo subir mi score".
2. **Alertas** (`/alertas`): bandeja de problemas comerciales con acción sugerida y gestión de estado.
3. **Señales de Ventas** (`/senales-ventas`): recepción y gestión de señales de terreno, con conversación, decisión y trazabilidad; captura en modo vendedor.
4. **Aprendizaje de compra** (`/aprendizaje`, `?tab=decisiones`): fusión de Calidad de compra (días comprados vs objetivo) e Historial de decisiones (auditoría).
5. **Resultados** (`/reportes`): 8 reportes consolidados exportables a CSV.

### Flujo principal
El comprador entra por **Metas** para ver su estado y su "foco de hoy" → atiende **Alertas** (problemas que requieren acción, muchas convertibles en OC) → revisa **Señales de Ventas** (lo que el terreno reporta, que decide/convierte/rechaza) → consulta su **Aprendizaje de compra** para no repetir errores → y usa **Resultados** para reportes consolidados y exportación. El hilo conductor es: medir desempeño → actuar sobre problemas y señales → aprender → reportar.

### Funcionalidades principales
- Score de desempeño, ligas/niveles, temporada y "cómo subir mi score" con impacto en puntos.
- Atribución justa de causas de quiebres (comprador/proveedor/demanda).
- Bandeja de alertas con acción sugerida contextual y gestión de estado (persistida en localStorage).
- Gestión completa de señales de ventas: flujo de estados, conversión a compra, conversación, asignación, rechazo con motivo y timeline de trazabilidad; captura rápida (modal modo vendedor).
- Aprendizaje: clasificación de calidad de compra (corta/saludable/alta/sobrecompra) e historial auditable de decisiones (sugerido vs comprado, motivo, resultado, aprendizaje).
- Reportes consolidados (8) con orden, filtro de fechas y exportación CSV.

### Funcionalidades secundarias
- Gamificación: retos de la semana, novedades/feed de competición, insignias, premios en juego.
- KPIs comparativos vs promedio del equipo y ranking anonimizado.
- Analítica agregada de señales (top productos, tiendas, más solicitados).
- Diferenciación de alcance por rol en Aprendizaje (comprador vs líder).

### Dependencias con otros módulos
- **Comprar / Reposición** (`/comprar/decisiones`): destino del "foco de hoy" y de acciones de alertas/señales.
- **Órdenes de compra / Borradores** (`/comprar/borradores`, `/comprar/seguimiento`): las alertas y señales alimentan el borrador de OC (`OcDraftContext`) y enlazan a seguimiento.
- **Productos** (`/productos/:sku`): enlaces desde alertas, señales, calidad de compra y decisiones; el modal de señales busca en el surtido (`productService`).
- **Proveedores** (`/proveedores`, ficha): enlaces desde alertas, calidad, decisiones; reporte de cumplimiento.
- **Venta no capturada** (`/venta-no-capturada`): destino de alertas de oportunidad.
- **Recomendaciones de compra** (`mockRecommendations`): usadas para la acción sugerida de alertas y la conversión de señales.
- **Reglas de compra** (`mockRules`): objetivo de cobertura para clasificar la calidad de compra.
- **Módulo Líder** (`/equipo/*`): comparte datos de equipo (scores, alertas de equipo, ranking) pero está fuera de este módulo y protegido por `RoleGate allow="lider"`.
- **Contextos globales**: `RoleContext` (comprador/líder), `BuyerContext` (comprador actual), `SignalsContext`, `OcDraftContext`, `PurchaseFlowContext`, `ToastContext`, `NotificationContext` (notificaciones enlazan a `/alertas` y `/senales-ventas`).

> **Nota transversal (datos mock)**: toda la información es simulada y vive en memoria/`localStorage`; las fechas se calculan contra `TODAY_ISO` (constante), no contra la fecha real del sistema. No hay backend, autenticación real de ventas, carga asíncrona ni manejo de errores de red. Las persistencias (estado de alertas, señales, premios, rol) son por navegador.
