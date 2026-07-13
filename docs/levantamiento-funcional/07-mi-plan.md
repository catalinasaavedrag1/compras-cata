# Módulo: Mi plan

> Levantamiento funcional realizado **solo desde el frontend** (React + TypeScript, datos mock). Todo lo aquí descrito se basa en el código leído; donde algo no puede determinarse desde el código se marca como **"Definición pendiente"** o **"Suposición"**.

El módulo **"Mi plan"** (grupo de navegación `plan` en `src/components/layout/navItems.tsx`, etiqueta lateral **"Mi plan"**, icono `IconBulb`, ruta raíz `/mi-desempeno`, hint *"Metas, presupuesto, acciones y resultados"*) agrupa el desempeño personal del comprador, sus alertas, las señales que recibe de ventas, su aprendizaje de compra y los reportes de resultados.

Está compuesto por 5 pantallas (5 ítems de menú). Etiquetas y hints **exactos** del menú:

| Ítem menú (label) | Ruta (`to`) | Hint del menú | Icono | `secondary` | `badge` | Pantalla / componente |
|-------------------|-------------|---------------|-------|-------------|---------|-----------------------|
| **Metas** | `/mi-desempeno` | "Tu score, metas del mes y foco de hoy" | `IconBulb` | no | — | `MyPerformancePage` |
| **Alertas** | `/alertas` | "Problemas que requieren atención del comprador" | `IconAlerts` | no | `alertas` | `AlertsPage` |
| **Señales ventas** | `/senales-ventas` | "Lo que ventas detecta en terreno: quiebres, demanda y oportunidades" | `IconSignal` | no | `senales` | `SalesSignalsPage` |
| **Aprendizaje de compra** | `/aprendizaje` (acepta `?tab=decisiones`) | "Calidad de las compras e historial de decisiones: qué se compró bien y qué aprender" | `IconCheck` | **sí** | — | `AprendizajePage` (fusiona `PurchaseQualityPage` + `DecisionsPage`) |
| **Resultados** | `/reportes` | "Reportes consolidados de compras, OC, rotación, márgenes y proveedores" | `IconDashboard` | **sí** | — | `ReportsPage` |

- Los ítems marcados `secondary: true` (Aprendizaje y Resultados) se muestran en un bloque secundario/"extra" del `Sidebar` y `MobileNav` (separados de los 3 primarios). Los 3 primeros son primarios.
- El módulo declara `badgeKeys: ["alertas", "senales"]`: el icono del módulo agrega los contadores de badges de Alertas y Señales. Los ítems Alertas y Señales tienen su propio `badge` (`alertas` / `senales`) con conteo dinámico.

Notas de navegación relevantes (de `src/routes/AppRoutes.tsx`, líneas ~145–257):
- Ninguna de estas 5 rutas está protegida por `RoleGate`; están accesibles a cualquier rol autenticado (envueltas en `RequireAuth`). Las **únicas** rutas con `RoleGate allow="lider"` son las de `/equipo/*` (Panel del equipo y Alertas del equipo), fuera de este módulo.
- Rutas legadas que redirigen a este módulo (`<Navigate replace>`): `/calidad-compra` → `/aprendizaje`; `/decisiones` → `/aprendizaje?tab=decisiones`.
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
Mostrar al comprador su **score** de desempeño, su **nivel/liga**, su **posición frente al equipo** (anonimizada) y, sobre todo, **cómo subir** ese score. Combina desempeño personal, gamificación (ligas, temporada, retos, premios), metas del mes y evaluación justa de quiebres. Descripción de la página (`PageHeader`): *"Tu score, tu nivel y tu posición frente al equipo. No solo el problema: también cómo subir. El ranking de los demás está anonimizado."*

### Tipo de usuario
Comprador (visión "mía", en primera persona: "Tu score", "Tus retos"). Accesible también para el líder por ruta, pero la vista está redactada para el comprador. El comprador "yo" se resuelve por `useBuyer()` (nombre del comprador seleccionado): `me = buyers.find(b => b.name === buyerName) ?? getBuyer(CURRENT_BUYER_ID)`. Datos mock: lista `buyers` de `mockBuyers`.

### Descripción detallada
Página de solo lectura (no hay formularios). Toda la información se **deriva** de los datos mock del comprador y del equipo mediante utilidades de `utils/teamScore` y `utils/buyerAttribution`. El encuadre es deliberadamente positivo ("no solo el problema: también cómo subir") y el ranking del resto del equipo está **anonimizado** ("Comprador A/B/C…").

### Información que muestra
- **Foco de hoy**: la palanca de mayor impacto para subir el score (primer elemento de `improvements`), con el consejo (`SCORE_ADVICE`) y los puntos ganables (`+N pts`). Es un enlace a reposición. Muestra `improvements[0].advice` o, si no hay consejo, "Mejora tu {label en minúscula}".
- **Score gauge**: score 0–100 en un anillo `conic-gradient` (ángulo `score*3.6°`), color según `scoreColor`, badge de **Nivel {liga}**, tendencia "{trendText} vs semana anterior" (`trendColor`), barra de progreso hacia la siguiente liga con "Faltan **N pts** para {liga}", y sparkline del historial (`me.scoreHist`).
- **Tarjetas resumen** (3): "Tu posición" (`#pos` de N compradores), "Percentil" (`percentileSimilarLoad`, subtítulo "vs carga similar"), "Cumpl. metas" (`me.goalComp`%, subtítulo "objetivos del mes").
- **Encuadre positivo** (card con 💪): frase "Vas **#pos de N** en general" y, si el mejor ranking específico (`bestRank`) está en top 3, "— y eres **#1 del equipo / #k** en {margen bruto / reducción de quiebres / rotación saludable / recuperación del mes}" (mapa `RANK_PHRASE`).
- **Tus indicadores vs promedio del equipo** (4 KPIs): **Fill Rate**, **Nivel de servicio** (SLA), **Tiempo reposición** (días), **Quiebres**; cada uno con el valor propio y "eq. {promedio}", coloreado verde/rojo según `good` (mejor o igual que el promedio del equipo `teamAggregate`). Nota: Quiebres compara `me.stockouts <= agg.stockouts/agg.n`; el resto compara ≥ (Fill/SLA) o ≤ (tiempo reposición).
- **Tu temporada** (banner degradado): "🏆 {SEASON.name}", "Cierra en N días" (`daysToClose(SEASON.to)`), nivel actual y "Te faltan N pts para {liga}" (o "Estás en la cima"), y bloque "Si cerrara hoy": movimiento de liga (`seasonStatus` → `SEASON_MOVE_CFG`: flecha + label Ascenso/Descenso/Mantiene) con `from.name → to.name`.
- **Causa de tus quiebres**: barra apilada e ítems con la atribución (`buyerAttribution`) en 3 causas — "Tu decisión" (rojo), "Proveedor" (ámbar), "Demanda" (azul/brand) — con conteo, porcentaje y descripción; nota de justicia (`fairNote`) y, si `scoreAdjust > 0`, "**Estos quiebres no deberían penalizar tu score.**"
- **Cómo subir mi score**: hasta 3 dimensiones más débiles ponderadas por impacto, cada una con badge `+N pts` y consejo.
- **Tus reconocimientos**: insignias del mes que el comprador lidera (`badgesOf` filtradas a `winner.id === me.id`), o mensaje "Aún no lideras ninguna insignia. Revisa 'Cómo subir mi score' para acercarte."
- **Tus retos de la semana**: `ChallengeList` con los challenges del comprador (equipo, duelos donde participa como `aId`/`bId`, o rachas propias `streak`).
- **Tus novedades**: `CompetitionFeed` filtrado al comprador (`f.buyerId === me.id`).
- **Premios en juego**: premios (`rewards` desde `localStorage` `compras:rewards`, default `defaultRewards`), con quién los va ganando (`winnerByCriterion`) y "¡Lo vas ganando tú!" vs "Va ganando: {otro}". Subtítulo: "Definidos por tu líder este mes."
- **Mis metas del mes**: filas de metas (`GoalRow`) con `me.goals`.
- **Ranking del equipo**: lista ordenada por score descendente, con medallas 🥇🥈🥉 para top 3 (resto número), mostrando "Tú" resaltado (`bg-brand-50`) y el resto como "Comprador {letra}" (anonimizado), con el score de cada uno coloreado por `scoreColor`. Subtítulo: "Anonimizado — solo ves tu posición y el resto resumido."

### Secciones/bloques
1. `PageHeader` (título + descripción).
2. Banner "Foco de hoy" (condicional a que exista `improvements[0]`).
3. Grid `[1fr_1.4fr]`: Score gauge (izq.) + [3 tarjetas resumen, encuadre positivo, KPIs vs equipo] (der.).
4. Banner "Tu temporada".
5. Card "Causa de tus quiebres".
6. Grid `[1.4fr_1fr]`: "Cómo subir mi score" + "Tus reconocimientos".
7. "Tus retos de la semana".
8. Grid `[1.4fr_1fr]`: "Tus novedades" + "Premios en juego".
9. Grid `[1.4fr_1fr]`: "Mis metas del mes" + "Ranking del equipo".

### Filtros disponibles
Ninguno. La pantalla no expone filtros, buscador ni rango de fechas.

### Acciones del usuario
- Clic en **"Foco de hoy"** (bloque completo es un `Link`) → navega a `/comprar/decisiones` (reposición), con texto de CTA "Ir a reposición →". Es el único CTA de navegación explícito de la página.
- Los componentes `ChallengeList` / `CompetitionFeed` pueden tener interacción propia (no revisada aquí — **Definición pendiente** sobre su interactividad interna).

### Botones y controles
- Enlace/bloque "Foco de hoy → Ir a reposición".
- No hay botones de formulario, toggles, selects ni tabs. Toda la interacción de estado (rewards) es de lectura; los `rewards` solo se **leen** de localStorage (no se editan aquí).

### Tablas/tarjetas/formularios/componentes
- Componentes UI: `PageHeader`, `Card/CardBody`, `Badge`, `Sparkline` y `GoalRow` (importados de `BuyerDetailDrawer`), `ChallengeList`, `CompetitionFeed`.
- Sin tablas (`DataTable`) ni formularios.

### Campos de formularios
No aplica (no hay formularios).

### Estados posibles (existentes / no aplican por datos mock)
- **Score/nivel/tendencia/temporada**: dependen del `Buyer` mock (`me.score`, `me.trend`, `me.prevSeasonScore`, `me.scoreHist`, `me.breakdown`, `me.goalComp`, `me.fillRate`, `me.sla`, `me.replenDays`, `me.stockouts`). Movimiento de temporada: Ascenso/Descenso/Mantiene.
- **Barra a siguiente liga**: solo se muestra si existe `next` (no en la liga máxima "Leyenda").
- **Reconocimientos**: estado "sin insignias lideradas" (mensaje alternativo) vs con insignias.
- **Causa de quiebres**: solo pinta slices con `count > 0`; nota de ajuste condicional a `scoreAdjust > 0`.
- **Premios**: "lo vas ganando tú" vs "va ganando: {otro}" (o "—" si no hay ganador).
- No hay estados de carga/errores/paginación (datos mock en memoria).

### Navegación hacia otras pantallas
- "Foco de hoy" → `/comprar/decisiones` (fuera del módulo; Comprar/Reposición).
- No hay otros enlaces salientes explícitos en esta página (los internos dependen de subcomponentes `ChallengeList`/`CompetitionFeed`).

### Flujo funcional completo
1. Se resuelve el comprador "yo" (`useBuyer`).
2. Se calculan, en render, agregados de equipo (`teamAggregate`), liga (`leagueOf`), percentil (`percentileSimilarLoad`), mejoras (`improvements`), insignias (`badgesOf`), temporada (`seasonStatus`), retos, feed y premios (todo derivado).
3. El usuario ve su estado y su "foco de hoy"; el único paso accionable es ir a reposición para ejecutar la mejora sugerida.

### Reglas de negocio inferibles
- **Ligas** (`LEAGUES`): Bronce 0–59, Plata 60–74, Oro 75–84, Elite 85–94, Leyenda 95–100.
- **Puntos a siguiente liga** (`ptsToNext`) = `next.min - score`. Ancho de barra = `((score - league.min) / (next.min - league.min)) * 100`, acotado a [6, 100].
- **Mejoras / "cómo subir score"**: por cada dimensión del `breakdown`, `target = min(95, valor+15)`, `pts = round((target−valor)*peso/100)`; se muestran las de `pts ≥ 1`, ordenadas desc por pts, top 3.
- **Percentil por carga similar**: compara con compradores de `workloadPct` dentro de ±20; si el grupo < 3, compara contra todos (según `percentileSimilarLoad`).
- **Atribución de quiebres** (`buyerAttribution`): proveedor 25–55%, demanda 10–30%, resto comprador; determinista por hash del id; `scoreAdjust = round(externos*0.8)`. Regla explícita en UI: "No todo quiebre es culpa del comprador".
- **Ranking anonimizado**: solo se identifica "Tú"; los demás son "Comprador {String.fromCharCode(65 + i)}" donde `i` es el índice en la lista ordenada. **Nota**: como la etiqueta usa el índice global (incluyendo la posición del propio comprador), la secuencia de letras "salta" la posición del usuario (p. ej. si eres 2º, verás A, [Tú], C, D…). Encuadre para no exponer a pares.
- **Insignias del mes** (`badgesOf`): mejor margen, menos quiebres, mejor rotación, mayor mejora, mejor sobrestock, mejor negociador (ahorro).
- **Premios** (`winnerByCriterion`): criterios general/mejora/quiebres/margen/rotación.

### Validaciones
No aplica (sin entradas de usuario).

### Permisos/restricciones
- Ruta sin `RoleGate`: accesible a comprador y líder. La vista está redactada para el comprador (primera persona). **Suposición**: el líder normalmente usaría el módulo "Líder" (`/equipo/*`).
- El ranking de terceros está intencionalmente anonimizado.

### Dudas/definiciones pendientes
- Interactividad interna de `ChallengeList` y `CompetitionFeed` (no revisada en profundidad). **Definición pendiente**.
- Origen real de `SEASON`, `challenges`, `competitionFeed`, `rewards` (mock/localStorage). En producción tendrían backend. **Suposición**.
- Los premios se "definen por el líder", pero desde esta pantalla no se editan (solo se leen de `compras:rewards`); su edición estaría en una pantalla del rol líder. **Definición pendiente**.

---

## Pantalla 2 — Alertas comerciales

### Nombre
Alertas comerciales (título **"Alertas comerciales"**; menú **"Alertas"**).

### Ruta(s)
- `/alertas`

### Módulo
Mi plan.

### Objetivo funcional
Bandeja tipo "inbox" de **problemas comerciales que requieren atención del comprador**, cada uno con descripción, recomendación y una **acción sugerida concreta** según su tipo (agregar a OC, ver órdenes, revisar proveedor, ver venta no capturada, ver producto). Permite gestionar el estado (en revisión / resuelta). Descripción de página: *"Problemas que requieren tu atención, con acción sugerida."*

### Tipo de usuario
Comprador (redacción "tu atención"). Ruta sin restricción de rol. Datos mock: `alerts` de `mockAlerts` (semilla `seedAlerts`), con **override de estado persistido** en `localStorage` (`compras:alert-status`) vía `useLocalStorage`.

### Descripción detallada
Layout maestro-detalle: barra de filtros → 4 KPIs clicables → tabs por estado → lista (inbox agrupada por antigüedad) + panel de detalle (escritorio) o `Drawer` (móvil). El estado de cada alerta puede cambiarse y se recuerda por navegador.

### Información que muestra
- **KPIs** (4, clicables): "Alertas activas" (`new + in_review`, tono warn), "Severidad alta" (`high` y activa, tono bad), "En revisión" (tono info), "Resueltas" (tono good).
- **Resumen de filtros** (en `FilterBar`): "N alerta(s) · M alta severidad · K en revisión".
- **Lista (inbox)** — por alerta (`AlertRow`): `SeverityBadge`, grupo de tipo (`TYPE_GROUP` con tono), indicador "No leída" (punto brand si status `new`), fecha (`formatDate`), entidad relacionada (`relatedEntity`, negrita si no leída), descripción (`line-clamp-2`), `StatusBadge kind="alert"` y botón de acción sugerida inline.
- **Detalle** (`AlertDetail`): `SeverityBadge`, tipo (`ALERT_TYPE_LABELS`), `StatusBadge`, fecha; entidad (enlace a `/productos/{relatedSku}` si hay SKU, si no título plano); descripción; bloque **Recomendación** (`alert.recommendation`); botones de acción; bloque "Detalle" con **Responsable**, **Fecha** y **SKU** (mono, solo si `relatedSku`).

### Secciones/bloques
1. `PageHeader`.
2. `FilterBar` (filtros).
3. Grid de 4 `KpiCard`.
4. `Tabs` por estado (con conteos).
5. Lista agrupada por tiempo + Detalle (escritorio) / `Drawer` (móvil), o `EmptyState` (si `filtered.length === 0`).

### Filtros disponibles
En `FilterBar`:
- **Buscador**: placeholder "Buscar por producto, proveedor o SKU" (`filterAlerts` por query).
- **Rango de fechas**: label "Fecha de alerta" (`inRange` sobre `a.date`).
- **Select Severidad**: Alta / Media / Baja (`high`/`medium`/`low`).
- **Select Tipo de alerta**: las 16 claves de `ALERT_TYPE_LABELS`: Quiebre de stock, Riesgo de quiebre, Sobrestock, Margen bajo, Costo aumentado, Proveedor atrasado, Producto sin venta, Alta demanda inesperada, Producto sin proveedor, OC atrasada, Compra sugerida alta, Stock muerto, Costo sin actualizar, Sin compra reciente, Temporada próxima, Oportunidad no capturada.
- **Select Responsable**: derivado de los `responsible` únicos de la semilla (ordenado `localeCompare es`).
- Botón **Limpiar** (resetea query, tipo, severidad, responsable y fechas).
- **Tabs** (filtran el listado por estado, no son parte de la barra): **Activas** (new+in_review), **Nuevas**, **En revisión**, **Resueltas**, **Ignoradas**.

Nota: la barra controla KPIs, conteos y listado (`byFilters`); la pestaña filtra adicionalmente por estado sobre ese subconjunto (`filtered`).

### Acciones del usuario
- Seleccionar una alerta (clic en la fila) → muestra el detalle y abre `Drawer` en móvil.
- **Acción sugerida** por alerta (`actionForAlert`, en este orden de prioridad):
  1. Si hay recomendación de compra para el SKU (`recommendations` con `suggestedQuantity > 0`): botón "**Agregar a OC**" (agrega al borrador vía `useOcDraft.addItem`; si ya está, "**Agregado a OC**" deshabilitado). Toast de éxito con enlace "Ver borrador OC" → `/comprar/borradores`.
  2. `po_delayed` → "**Ver órdenes de compra**" → `/comprar/seguimiento`.
  3. `supplier_delay` → "**Revisar proveedor**" → `/proveedores`.
  4. `lost_opportunity` / `no_recent_purchase` → "**Ver venta no capturada**" → `/venta-no-capturada`.
  5. Con `relatedSku` (sin recomendación) → "**Ver producto**" → `/productos/{sku}`.
  6. Si nada aplica → sin botón de acción.
- **Marcar en revisión** (solo si status `new`) → `setStatus(id, "in_review")` + toast "Alerta marcada en revisión".
- **Marcar resuelta** (si status ≠ `resolved` y ≠ `ignored`) → `setStatus(id, "resolved")` + toast "Alerta marcada como resuelta".
- Clic en KPIs: "Alertas activas" → tab active; "Severidad alta" → `severity=high` + tab active; "En revisión" → tab in_review; "Resueltas" → tab resolved. Cambio de pestaña por `Tabs`.

### Botones y controles
- 4 `KpiCard` clicables (con estado `active`).
- `Tabs` (5).
- Buscador, 3 selects (Severidad, Tipo de alerta, Responsable), rango de fechas, botón Limpiar.
- Filas de lista clicables + botón de acción inline.
- En detalle: botón de acción primaria, "Marcar en revisión", "Marcar resuelta".
- `Drawer` móvil (título "Detalle de alerta", cerrar).

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `FilterBar`, `KpiCard`, `Tabs`, `Card`, `Drawer`, `EmptyState`, `Button`, `SeverityBadge` (de `PriorityBadge`), `StatusBadge`, `Badge`. Subcomponentes locales `AlertRow` y `AlertDetail`, y helper `groupByTime`.
- No hay `DataTable` ni formulario de entrada; el "detalle" es una tarjeta de lectura + botones.

### Campos de formularios
No aplica (no hay formularios; solo cambios de estado por botón y filtros).

### Estados posibles (existentes / no aplican por datos mock)
- **Estados de alerta** (`AlertStatus`): `new`, `in_review`, `resolved`, `ignored`. La pestaña "Activas" = new + in_review.
  - Existentes por datos mock: la semilla incluye al menos `new` e `in_review`. `ignored` **existe como estado/tab/select pero no hay acción en la UI para asignarlo** (no hay botón "Ignorar"); solo podría venir precargado en el mock. **Definición pendiente** sobre cómo se marca "Ignorada".
  - `resolved` e `in_review` se alcanzan desde la UI (botones del detalle).
- **Severidad**: high/medium/low (`SeverityBadge`).
- **Agrupación temporal** (`groupByTime`): Hoy / Ayer / Esta semana (≤7 d) / Anteriores, calculada contra `TODAY_ISO`.
- **EmptyState**: dos variantes — "No hay alertas activas" (tab active, con CTA "Ir a reposición" → `/comprar/decisiones`) y "Sin alertas en esta vista" (resto).
- No hay estados de carga/errores (mock + localStorage).

### Navegación hacia otras pantallas
- `/comprar/borradores`, `/comprar/seguimiento`, `/proveedores`, `/venta-no-capturada`, `/productos/{sku}` (según acción/tipo).
- `/comprar/decisiones` desde el CTA del `EmptyState` activo.

### Flujo funcional completo
1. El comprador entra a la bandeja; ve KPIs y alertas activas ordenadas por severidad (high→medium→low) y agrupadas por antigüedad.
2. Filtra/busca según necesidad; selecciona una alerta.
3. Lee descripción + recomendación; ejecuta la acción sugerida (p. ej. agregar a OC) o navega al recurso relacionado.
4. Marca la alerta en revisión y/o resuelta; el estado persiste en `localStorage`.

### Reglas de negocio inferibles
- **Orden de la lista**: por severidad (high→medium→low).
- **Activas** = new + in_review.
- **Alta severidad (KPI/`highCount`)** = severidad high y estado activo (new o in_review).
- **`TYPE_GROUP`** mapea los 16 tipos a 6 grupos con tono: Stock (stockout, stockout_risk, overstock, dead_stock, no_sales), OC (po_delayed), Proveedor (supplier_delay, no_supplier), Demanda (unexpected_demand, high_suggested_purchase, season_approaching), Margen (low_margin, cost_increase, outdated_cost), Oportunidad (no_recent_purchase, lost_opportunity).
- La acción sugerida **prioriza convertir la alerta en compra** cuando existe recomendación con cantidad > 0.

### Validaciones
- No hay validación de entrada. Único control: botón "Agregar a OC" se **deshabilita** si el SKU ya está en el borrador (`hasItem`).

### Permisos/restricciones
- Ruta sin `RoleGate`. Redactada para comprador. **Suposición**: alertas del equipo completo se ven en `/equipo/alertas` (rol líder, con `RoleGate`).
- Persistencia de estado por navegador (localStorage), no por usuario/backend.

### Dudas/definiciones pendientes
- No existe acción para marcar "Ignorada" desde la UI. **Definición pendiente**.
- El campo `responsible` sugiere que las alertas no son necesariamente del comprador logueado (aparecen varios responsables en el mock); la barra permite filtrar por responsable pero no filtra por "mías" automáticamente. **Suposición**: en `/alertas` se ven todas y el filtro por responsable es manual.
- Origen de `alert.recommendation` (texto por alerta) vs `recommendations` de reposición: son fuentes distintas. **Definición pendiente**.

---

## Pantalla 3 — Señales de Ventas

### Nombre
Señales de Ventas (título **"Señales de Ventas"**; menú **"Señales ventas"**).

### Ruta(s)
- `/senales-ventas`

### Módulo
Mi plan.

### Objetivo funcional
Canalizar lo que el **equipo de ventas** detecta en terreno (quiebres, demanda, oportunidades, errores de precio, sugerencias) hacia el comprador. El comprador **recibe, analiza con datos de apoyo, conversa, decide** (convierte en compra, avanza el flujo o rechaza) y **todo queda registrado** (timeline/trazabilidad). Incluye captura rápida de señales (modo vendedor). Descripción: *"Lo que el equipo de ventas detecta en el terreno: quiebres, demanda y oportunidades. Recíbelas, analízalas y decide — todo queda registrado."*

### Tipo de usuario
- **Comprador**: recibe y gestiona señales (bandeja, detalle, decisión, conversación, asignación).
- **Vendedor (modo)**: reporta señales mediante el modal, identificándose entre una lista fija de 6 vendedores. El "modo vendedor" es un badge del modal ("Modo vendedor"); **no** hay un rol de sesión "vendedor" (los roles de sesión son comprador/líder).

Datos mock: `useSignals()` (`SignalsContext`: semilla del servicio + creadas + parches en `localStorage` `compras:signals`).

### Descripción detallada
Bandeja tipo inbox con analítica agregada, filtros ricos, KPIs, tabs por estado del flujo y panel de detalle completo con acciones de decisión, conversación comprador↔vendedor, asignación e historial. Las señales son explícitamente **de terreno** (badge "Terreno"), no alertas automáticas.

### Información que muestra
- **FlowStrip**: 5 pasos numerados — "Ventas reporta" › "Comprador recibe" › "Analiza con datos" › "Decide" › "Queda registrado".
- **KPIs** (5): **Nuevas** (`status=new`, info), **Quiebres reportados** (`STOCKOUT_TYPES` y estado activo, bad), **Por revisar** (new+in_review, warn), **Aceptadas** (`accepted`, good), **Venta perdida est.** (suma de `estimatedLostSale` en señales activas, formato CLP compacto, bad; sin `onClick`).
- **Resumen de señales** (analítica, 3 `MiniBar`/`BarList`): "Top productos reportados" (conteo por `productName`, top 5), "Top tiendas con señales" (conteo por `store`, top 5), "Productos más solicitados" (suma de `customersAsking`, top 5, display "{n} clientes").
- **Bandeja** — por señal (`SignalRow`): badge de prioridad (`SIGNAL_PRIORITY`), tipo corto (`SIGNAL_TYPE.short`), badge "**Terreno**", punto "Sin revisar" (status new), badge "**Para mí**" (si `assignedBuyer === buyer`), fecha, nombre de producto, comentario (`line-clamp-2`), `StatusBadge` de estado (`SIGNAL_STATUS`), y "{canal} · {tienda}".
- **Detalle** (`SignalDetail`): cabecera (tipo con `SIGNAL_TYPE.label`, "Terreno", "Prioridad {label}", estado); producto (enlace a `/productos/{sku}` o título con badge "Producto nuevo"); "{categoría} · {marca} · {canal} · {tienda}"; motivo del reporte ("Reportado por {vendedor}" + fecha/hora + comentario); **Solicitud de compra** (editable); evidencia (badges: "{n} cliente(s) preguntó", "Venta perdida ~{CLP}", nota); "Acción recomendada por ventas" (`recommendedAction`); **Datos de apoyo para decidir** (6 stats); toolbar de decisión; asignación; conversación; historial/timeline.

### Secciones/bloques
1. `PageHeader` con acción header "Reportar señal" (`IconPlus`).
2. `FlowStrip`.
3. `FilterBar`.
4. Grid de 5 `KpiCard`.
5. Card "Resumen de señales" (3 mini-barras).
6. `Tabs` (6) con conteos.
7. Bandeja + `SignalDetail` (escritorio) / `Drawer` "Detalle de la señal" (móvil), o `EmptyState`.
8. `ReportSignalModal` (modal de captura).

### Filtros disponibles
En `FilterBar`:
- **Buscador**: placeholder "Buscar por producto, SKU, categoría o vendedor" (busca en `productName`, `sku`, `category`, `reportedBy`).
- **Toggles** (2): "**Asignadas a mí**" (`mine`, compara `assignedBuyer === buyer`), "**Sólo quiebres**" (`onlyStockout`, `STOCKOUT_TYPES`).
- **Selects** (6): **Prioridad** (Alta/Media/Baja), **Tipo de señal** (10 claves de `SIGNAL_TYPE`), **Canal** (Tienda/Web/Marketplace/Call center), **Tienda / punto** (derivado de señales), **Categoría** (derivado), **Comprador** (asignados derivados).
- **Rango de fechas**: label "Fecha de la señal".
- Botón **Limpiar** (`clearFilters`, resetea todo lo anterior incluidos ambos toggles).
- **Tabs** (6): "Por revisar" (new+in_review), "En gestión" (`IN_PROGRESS_STATUSES`: sourcing/quoted/awaiting_customer/purchased), "Aprobadas" (accepted), "Resueltas", "Rechazadas", "Todas".

### Acciones del usuario
- **Reportar señal** (header o CTA del EmptyState → abre `ReportSignalModal`, modo vendedor).
- Seleccionar señal (bandeja → detalle / drawer móvil).
- **Convertir en compra** (`convert`): agrega ítem al borrador de OC (`useOcDraft.addItem`), marca la señal como convertida (`markConverted`, evento en timeline), toast con enlace a `/comprar/borradores`. Botón "Convertir en compra"; si ya está en borrador → "**En borrador de OC**" deshabilitado. Solo aparece si existe `ocItem`.
- **Avanzar el flujo** (`advance`, solo si la señal está abierta; texto según estado, mapa `STEP`): new→in_review ("Marcar en revisión"), in_review→sourcing ("Consultar proveedor"), sourcing→quoted ("Registrar cotización"), quoted→awaiting_customer ("Esperar respuesta cliente"), awaiting_customer→accepted ("Aprobar"), accepted→purchased ("Marcar comprado"), purchased→resolved ("Marcar resuelto").
- **Rechazar** (solo si abierta): botón "Rechazar" → textarea "¿Por qué rechazas esta señal?" + "Confirmar rechazo" (variant danger) / "Cancelar" → estado `rejected` (`reject`), toast "Señal rechazada con motivo".
- **Editar/Completar "Solicitud de compra"**: botón "Editar" (si hay datos) o "Completar" → grid de 6 inputs → "Guardar" (`updateRequest`) / "Cancelar".
- **Asignar comprador**: select "Comprador asignado" (opciones = `buyers` + "Sin asignar") o "Asignármela" en `MoreActions` → `assign`.
- **Conversar con ventas**: input "Responder como {buyer}…" + botón "Enviar" (o Enter) → `addMessage` (role `buyer`, autor = comprador).
- **MoreActions** (menú ⋯): "Ver historial del producto" (`/productos/{sku}`) y "Ver ventas recientes" (`/productos/{sku}?tab=ventas`) — solo si hay `sku` —, más "Asignármela" (siempre).
- Ver/ocultar **historial** ("+ Ver / − Ocultar historial ({n})"), timeline ordenado desc.
- KPIs y toggles clicables cambian pestañas/filtros (Nuevas→to_review; Quiebres→toggle stockout+to_review; Por revisar→to_review sin stockout; Aceptadas→accepted).

### Botones y controles
- Botón header "Reportar señal".
- 5 `KpiCard` (4 clicables; "Venta perdida est." sin click), 6 `Tabs`, `FilterBar` (buscador, 2 toggles, 6 selects, rango, Limpiar).
- En detalle: "Convertir en compra", botón de avance de flujo, "Rechazar" (→ textarea + "Confirmar rechazo"/"Cancelar"), "Editar/Completar" solicitud (+ inputs + Guardar/Cancelar), select de asignación, `MoreActions`, input+Enviar de conversación, toggle historial, enlace "Ver ficha completa del producto".
- `Modal` de reporte (ver campos abajo) con footer "Cancelar" / "Enviar señal".

### Tablas/tarjetas/formularios/componentes
- Componentes: `PageHeader`, `FilterBar`, `KpiCard`, `BarList`/`MiniBar`, `Tabs`, `Card`, `Drawer`, `EmptyState`, `Badge`, `Button`, `SignalDetail`, `ReportSignalModal`, `MoreActions`, `StatusBadge` (interno de row vía `SIGNAL_STATUS`). Subcomponentes locales: `FlowStrip`, `SignalRow`, `MiniBar`, helpers `aggCount`/`aggSum`/`groupByTime`.
- Formularios: modal de reporte y sub-formularios en el detalle (solicitud de compra, mensaje, rechazo, asignación).

### Campos de formularios
**Modal "Reportar señal de ventas"** (`ReportSignalModal`, badge "Modo vendedor"; descripción "Avisa al comprador lo que estás viendo en el terreno. Toma menos de 30 segundos."). Secciones numeradas:
- **1 · ¿Qué estás viendo?** (Tipo, botones en orden `TYPE_ORDER`): Quiebre (`stockout`), Sin stock (`asked_no_stock`), Muy pedido (`high_demand`), Demanda (`unexpected_demand`), Reponer (`restock`), Precio (`price_error`), Campaña (`campaign`), Liquidar (`liquidation`), Baja rotación (`low_rotation`), Nuevo (`customer_suggested`). Cada tipo muestra su `hint`.
- **2 · Producto**: buscador en surtido ("Buscar por nombre, SKU o marca", sugerencias top 6, `pickProduct`) **o** toggle "Producto nuevo (sin SKU)" → input "Nombre del producto sugerido" + select "Categoría…". Elegir "Sugerido por cliente" fuerza producto nuevo.
- **3 · Origen + prioridad**: **Canal** (Tienda/Web/Marketplace/Call center) y **Tienda/Punto** (si `store`: select "Balmaceda San Javier" / "Chorrillos San Javier"; si no, punto fijo: Tienda Web / Marketplace / Call center). **Prioridad** (Alta/Media/Baja) — **sugerida automáticamente** (`suggestPriority`, etiqueta "Sugerida automáticamente") salvo que el usuario la toque (`priorityTouched`); muestra `suggestion.reason`.
- **4 · ¿Qué pasó?** (comentario, obligatorio marcado con `*`, textarea).
- **Evidencia (opcional, plegable)**: "Clientes que preguntaron" (número), "Venta perdida estimada (CLP)" (número), "Nota / link / foto" (texto).
- **Reportado por** (select de 6 vendedores fijos): Rodrigo Fuentes, Camila Tapia, Sebastián Reyes, Paola Núñez, Diego Carrasco, Valentina Soto.
- Al enviar, `recommendedAction` se rellena automáticamente con el `hint` del tipo; `category` cae a "Sin categoría" si vacío.

**Sub-formulario "Solicitud de compra"** (en detalle, `ReqInput`): Cliente (texto), Cantidad (número), Fecha requerida (date), Precio objetivo (número CLP), Proveedor sugerido (texto), Costo cotizado (número CLP).

**Rechazo**: textarea "¿Por qué rechazas esta señal?".

**Conversación**: input de texto libre "Responder como {buyer}…".

### Estados posibles (existentes / no aplican por datos mock)
- **Estados de señal** (`SignalStatus` → `SIGNAL_STATUS`): new ("Solicitado"), in_review ("En revisión"), sourcing ("Consultando proveedor"), quoted ("Cotizado"), awaiting_customer ("Esperando cliente"), accepted ("Aprobado"), purchased ("Comprado"), rejected ("Rechazado"), resolved ("Resuelto"). Todos alcanzables desde la UI vía el flujo `STEP` + rechazo.
- "Para mí" (asignada al comprador actual), "Sin asignar".
- Producto nuevo (sin SKU, badge verde) vs producto del surtido (enlace).
- Sección "Motivo del rechazo" visible solo si `status === rejected` y hay `rejectionReason`.
- `EmptyState`: "No hay señales en esta vista" (con CTA "Reportar señal").
- No hay estados de carga/errores (mock + localStorage).

### Navegación hacia otras pantallas
- `/comprar/borradores` (tras convertir), `/productos/{sku}` y `/productos/{sku}?tab=ventas` (desde detalle/MoreActions/enlaces).

### Flujo funcional completo
1. Ventas reporta una señal (modal); nace en estado `new` con timeline y (según servicio) primer mensaje del vendedor. Al enviar, la página conmuta a pestaña "Por revisar", selecciona la señal y muestra toast "Señal enviada al comprador" con enlace "Ver señal".
2. El comprador la recibe en "Por revisar"; la analiza con los datos de apoyo y la conversación.
3. Decide: la **convierte en compra** (→ ítem en borrador OC + `markConverted`), la **avanza** por el flujo de gestión, o la **rechaza** con motivo.
4. Puede completar la "Solicitud de compra", asignarla a un comprador y conversar con ventas.
5. Cada acción deja evento en el timeline (trazabilidad). Todo persiste en `localStorage`.

### Reglas de negocio inferibles
- **Prioridad sugerida** (`suggestPriority`): **Alta** si quiebre (`stockout`/`asked_no_stock`) con `customersAsking ≥ 3` o sin stock, o `price_error`; **Media** si quiebre (con algo de stock) o demanda (`high_demand`/`unexpected_demand`/`restock`) con ≥3 solicitudes, o demanda al alza; **Baja** para observaciones/sugerencias.
- **Orden de bandeja**: por prioridad (high→medium→low), luego fecha descendente.
- **Venta perdida (KPI)** suma solo señales activas (no resolved/rejected).
- **Convertir** (`ocItem` en `SignalDetail`) usa la recomendación del SKU si existe (`suggestedQuantity>0`); si no, calcula cantidad desde el producto: `max(1, (maxStock−totalStock) si >0, si no round(salesLast30Days*1.5) || 10)`.
- **Margen esperado** = `(targetPrice − quotedCost)/targetPrice*100`; se marca tono "bad" si < 20%.
- **Señales "abiertas"** (`isOpen`) = todo excepto resolved/rejected (habilita convertir/avanzar/rechazar).
- **Datos de apoyo** (6): Stock disp. (bad si ≤0), Venta 30d, Rotación (×), Margen (%), Quiebres 30d (warn si >0), Tiendas afect. (nº); chips con tiendas afectadas.

### Validaciones
- **Reportar** (`canSubmit`): `productName.trim().length > 1`, `comment.trim().length > 2`, y (si producto nuevo) `category.trim().length > 0`. Botón "Enviar señal" deshabilitado si no cumple.
- **Rechazo**: `rejectReason.trim().length ≥ 3` (botón "Confirmar rechazo" deshabilitado si no).
- **Mensaje**: no se envía si `draft.trim()` está vacío.
- **Convertir**: deshabilitado si el SKU ya está en el borrador de OC (`alreadyInOc`).

### Permisos/restricciones
- Ruta sin `RoleGate`: accesible a comprador/líder. La captura de señal es "modo vendedor" pero cualquiera con acceso a la pantalla puede abrir el modal (no hay gating por rol de sesión).
- Toggle "Asignadas a mí" y autoría de mensajes usan el comprador actual (`useBuyer`), no el rol.
- Persistencia por navegador (localStorage), no por usuario/backend.

### Dudas/definiciones pendientes
- No hay rol de sesión "vendedor"; el reporte se hace en "modo vendedor" con lista fija de 6 vendedores. **Definición pendiente** sobre autenticación real de ventas.
- `reportDefaults` está fijado en `undefined` en esta página (el modal soporta `defaults` por producto, usado en otras pantallas como Ficha de producto). **Suposición**.
- Lista de tiendas del modal está hardcodeada (2 tiendas: Balmaceda / Chorrillos San Javier). **Definición pendiente** sobre catálogo real de puntos.

---

## Pantalla 4 — Aprendizaje de compra (Calidad + Historial de decisiones)

### Nombre
Aprendizaje de compra (título **"Aprendizaje de compra"**; menú **"Aprendizaje de compra"**, marcado `secondary`).

### Ruta(s)
- `/aprendizaje` (sub-pestaña "Calidad de compra" por defecto, `tab=calidad`).
- `/aprendizaje?tab=decisiones` (sub-pestaña "Historial de decisiones").
- Redirecciones legadas: `/calidad-compra` → `/aprendizaje`; `/decisiones` → `/aprendizaje?tab=decisiones`.

### Módulo
Mi plan.

### Objetivo funcional
Vista única de **aprendizaje** que fusiona dos ángulos (descripción de página: *"¿Se compró corto, saludable o de más? Sugerido vs comprado y su resultado — para no repetir errores."*):
1. **Calidad de compra**: ¿se compró corto, saludable o de más? Compara "días comprados" (cantidad ÷ venta diaria) vs el rango objetivo de cobertura de cada producto.
2. **Historial de decisiones**: auditoría de qué sugería el sistema, qué se compró, por qué se desvió y cómo resultó — "para no repetir errores".

### Tipo de usuario
- **Comprador**: ve **solo sus** compras/decisiones (filtrado `buyerName === buyer`).
- **Líder**: ve las de **todo el equipo** (`role === "lider"`).

Datos mock: `purchaseQualityLines()` (derivadas de `mockPurchaseOrders` + `mockProducts` + `mockRules`) y `usePurchaseFlow().decisions` (base `mockDecisions`).

### Descripción detallada
`AprendizajePage` renderiza un `PageHeader` común y un `Tabs` de dos sub-pestañas; embebe `<PurchaseQualityPage embedded />` o `<DecisionsPage embedded />` según `?tab`. El estado de pestaña se guarda en la URL (`useUrlState("tab", "calidad")`; cualquier valor distinto de "decisiones" cae a "calidad").

### Información que muestra
**Sub-pestaña "Calidad de compra"** (`PurchaseQualityPage`):
- KPIs (5): **Líneas evaluadas** (`all.length`), **Compras saludables** (con descripción "{%} del total", % sobre líneas con venta), **Compras cortas**, **Compras altas**, **Sobrecompras**.
- Tabla (`DataTable`, `mobileCard`): **Producto** (enlace a `/productos/{sku}`, con `poNumber · buyerName`), **Proveedor** (enlace `supplierPath`, oculto en móvil), **Comprado** (u.), **Días comprados** ("—" si sin_venta), **Objetivo** (rango "objMin–objMax d", oculto móvil), **Monto** (CLP compacto, oculto móvil), **Resultado** (`Badge` con `PURCHASE_CLASS`).

**Sub-pestaña "Historial de decisiones"** (`DecisionsPage`):
- KPIs (4): **Decisiones registradas** (`all.length`), **Compró bien** (`bueno`), **Sobrecompras** (`sobrestock`), **Compras cortas** (`corto`).
- Lista de tarjetas por decisión: producto (enlace) + badge de resultado (`OUTCOME_META`); "{fecha} · {comprador}" + "aprobó {approvedBy}" (si ≠ "—") + proveedor (enlace); grid **Sugerido** / **Comprado** / **Desvío** (u. y %, coloreado: violeta si +, rosa si −, gris si 0); **Motivo** (`reason`); **Resultado** (con "({resultDays}d)" si >0) (`resultText`); **Aprendizaje** (destacado verde si `learning !== "—"`).

### Secciones/bloques
1. `PageHeader` (común, con descripción; **sin** `InfoHint` en modo embebido).
2. `Tabs` (Calidad de compra / Historial de decisiones).
3. Contenido embebido de la sub-pestaña activa (KPIs + `FilterBar` + tabla/lista).

### Filtros disponibles
**Calidad de compra** (`useUrlState`):
- Buscador: "Buscar producto, OC, comprador o proveedor" (`q`).
- Select **Resultado** (`PurchaseClass`, `tipo`): Compra corta, Saludable, Compra alta, Sobrecompra, Sin venta.
- Botón Limpiar.

**Historial de decisiones** (`useUrlState`):
- Buscador: "Buscar producto, comprador o proveedor" (`q`).
- Select **Resultado** (`DecisionOutcome`, `resultado`): Compró bien, Sobrecompró, Compró corto, En medición.
- Botón Limpiar.

### Acciones del usuario
- Cambiar de sub-pestaña (persiste en URL `?tab`).
- Filtrar/buscar en cada sub-pestaña (persiste en URL).
- Navegar a productos (`/productos/{sku}`) y proveedores (`supplierPath`) desde enlaces.
- No hay acciones de escritura (ambas vistas son de lectura/auditoría).

### Botones y controles
- `Tabs` (2).
- Buscador + select Resultado + Limpiar (en cada sub-pestaña).
- Enlaces a producto/proveedor.
- `InfoHint` (ayuda) definido en los headers propios de cada sub-pantalla — **pero solo cuando NO están embebidas**: en `AprendizajePage` van `embedded`, por lo que se omite su `PageHeader`/`help`. El `InfoHint` ("Qué son los días comprados" / "Qué guarda cada decisión") **no se muestra** dentro de la vista fusionada. **Nota importante.**

### Tablas/tarjetas/formularios/componentes
- `PageHeader`, `Tabs`, `KpiCard`, `FilterBar`, `Badge`, `DataTable` (Calidad), `Card/CardBody` (Decisiones), `EmptyState` (Decisiones), `InfoHint` (no visible en modo embebido).
- Sin formularios de entrada.

### Campos de formularios
No aplica (solo buscador y select de filtro).

### Estados posibles (existentes / no aplican por datos mock)
- **Clase de compra** (`PurchaseClass` → `PURCHASE_CLASS`): corta ("Compra corta", rojo), saludable ("Saludable", verde), alta ("Compra alta", ámbar), sobrecompra ("Sobrecompra", violeta), sin_venta ("Sin venta", neutral). Presencia depende del mock.
- **Resultado de decisión** (`DecisionOutcome` → `OUTCOME_META`): bueno ("Compró bien", verde), sobrestock ("Sobrecompró", violeta), corto ("Compró corto", rojo), pendiente ("En medición", neutral).
- **EmptyState** en Decisiones ("Sin decisiones"). Calidad usa el render/emptyMessage por defecto de la tabla.
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
- **Días comprados** (`diasComprados`) = `round(quantity ÷ dailyDemand)` con `dailyDemand = monthlySales/30`.
- **Objetivo** = `targetInventoryDays` de la regla aplicable (`resolveRuleForProduct`), o **45** por defecto; rango objetivo = `[round(obj*0.7), round(obj*1.3)]`.
- **Clasificación** (`purchaseQualityLines`): `sin_venta` si `dailyDemand ≤ 0`; `corta` si `dias < objMin`; `saludable` si `dias ≤ objMax`; `alta` si `dias ≤ objMax*1.8`; `sobrecompra` si mayor.
- **% saludables** = `round(saludable / conVenta * 100)` sobre líneas con venta (excluye "sin venta").
- **Alcance por rol**: comprador solo evalúa sus compras; líder ve todo el equipo (regla explícita en `PurchaseQualityPage` y `DecisionsPage`).
- **Decisiones**: `diff = purchasedQty − suggestedQty`; `diffPct = round(diff/suggestedQty*100)`; guardan motivo del desvío, `approvedBy` ("—" si nadie), `resultText`/`resultDays` y `learning`.

### Validaciones
No aplica (sin entradas de escritura).

### Permisos/restricciones
- Ruta sin `RoleGate`, pero el **contenido depende del rol** (`useRole`): comprador ve lo suyo, líder ve todo. Restricción funcional clave del módulo.

### Dudas/definiciones pendientes
- Al embeber, se pierde el `InfoHint` explicativo ("días comprados" / "qué guarda cada decisión"). ¿Intencional? **Definición pendiente**.
- Relación entre "Calidad de compra" (derivada de OC+reglas) y "Historial de decisiones" (mock curado): fuentes distintas, no se cruzan. **Suposición**.
- `usePurchaseFlow().decisions` puede incluir decisiones generadas por el flujo de compra además de `mockDecisions`; origen completo no verificado. **Definición pendiente**.

---

## Pantalla 5 — Resultados (Reportes consolidados)

### Nombre
Reportes consolidados (título **"Reportes consolidados"**; menú **"Resultados"**, marcado `secondary`).

### Ruta(s)
- `/reportes`

### Módulo
Mi plan.

### Objetivo funcional
Centralizar **reportes operativos y estratégicos** de compras, inventario y proveedores, cada uno **exportable a CSV (Excel)**. Todo se **deriva** de los datos mock existentes mediante agregaciones en `useMemo` (sin inventar campos). Descripción: *"Reportes operativos y estratégicos de compras, inventario y proveedores. Cada tabla se puede exportar a CSV (Excel)."*

### Tipo de usuario
Comprador / Líder (ruta sin restricción). Los reportes NO filtran por comprador logueado: son **consolidados de toda la operación** (p. ej. "Compras por comprador" lista a todos). **Suposición**: pensado como cierre/resultados del módulo, útil a ambos roles.

### Descripción detallada
Una sola página con `Tabs` que conmuta entre 8 reportes (`REPORTS`); 4 KPIs globales arriba; filtro de fechas solo para reportes con datos temporales (OC). Cada reporte es una `DataTable` ordenable con botón de exportación CSV (uno en el header de página vía `ExportLauncher` y otro por reporte vía `ExportButton`, ambos "Exportar CSV").

### Información que muestra
- **KPIs globales** (4): **Monto comprado** (`totalBought` = suma `totalAmount` de OC en alcance; descripción "En el rango"/"Total OC"), **Órdenes de compra** (`scopedOrders.length`), **Proveedores** (distintos con compras), **Categorías activas** (categorías con `salesLast30Days>0` o `availableStock>0`).
- **8 reportes** (detalle de columnas y CSV abajo).

### Secciones/bloques
1. `PageHeader` con `ExportLauncher` (exporta el reporte visible).
2. Grid de 4 `KpiCard` globales.
3. `Tabs` (8 reportes).
4. `FilterBar` de fechas (solo reportes temporales; buscador deshabilitado).
5. Bloque del reporte activo (a veces con `HelpNote` y/o KPIs propios) + `DataTable` con `ExportButton` en el `CardHeader`.

### Filtros disponibles
- **Rango de fechas** (`FilterBar`, `range`): solo para `compras_proveedor`, `compras_categoria`, `compras_comprador`, `oc_abiertas` (por `createdAt` de la OC). Sin rango = todas las OC. Label "Todas las fechas"; summary "{n} OC en el rango · monto {CLP}"; botón Limpiar.
- **Ordenamiento por columna** (sort) en cada tabla, independiente por reporte (toggle asc/desc vía `makeToggleSort`; desc por defecto salvo el estado inicial de cada `useState`).
- No hay buscador de texto (el `FilterBar` de fechas tiene `onSearchChange` vacío y `searchValue=""`).

### Acciones del usuario
- Cambiar de reporte (Tabs).
- Ajustar rango de fechas (reportes temporales).
- Ordenar por cualquier columna `sortable`.
- **Exportar CSV** (header `ExportLauncher` y/o `ExportButton` por reporte; ambos descargan el mismo reporte visible).
- No hay enlaces de navegación salientes desde las filas (a diferencia de otras pantallas; no hay `Link` a producto/proveedor).

### Botones y controles
- 8 `Tabs`.
- `ExportLauncher` (header) + `ExportButton` por `CardHeader`.
- Encabezados de columna ordenables.
- `FilterBar` de fechas (+ Limpiar) en reportes temporales.
- KPIs (informativos, no clicables).

### Tablas/tarjetas/formularios/componentes
- `PageHeader`, `KpiCard`, `Tabs`, `FilterBar`, `DataTable` (con `mobileCard` y `rowClassName`), `Badge`, `StatusBadge`, `HelpNote`, `ExportButton`, `ExportLauncher`. Definiciones de reportes en `src/pages/reports/definitions.ts`; columnas CSV en `src/pages/reports/csv.ts`.
- Sin formularios de entrada.

### Campos de formularios
No aplica. (El "formulario" es solo el rango de fechas.) Columnas CSV por reporte en `csv.ts` — **detalle de los 8 reportes** (columnas de tabla vs columnas CSV):

1. **Compras por proveedor** (`compras_proveedor`, temporal). Tabla: Proveedor, Nº OC, Monto comprado, Monto prom. OC. CSV (`supplierCsv`): Proveedor, Nº OC, Monto comprado, Monto promedio OC. Sort inicial `total desc`. Agregado: suma `totalAmount` por `supplierName`.
2. **Compras por categoría** (`compras_categoria`, temporal). Tabla: Categoría, Nº líneas, Unidades, Monto comprado. CSV (`categoryCsv`): Categoría, Nº líneas, Unidades, Monto comprado. `HelpNote` explica que se une cada línea de OC con su producto por SKU (`cantidad × costo unitario`) y que "**{ordersWithLines}** de {N} OC en el rango tienen líneas". Sort inicial `total desc`.
3. **Compras por comprador** (`compras_comprador`, temporal). Tabla: Comprador, Nº OC, Monto comprado, Monto prom. OC. CSV (`buyerCsv`): Comprador, Nº OC, Monto comprado, Monto promedio OC. Agregado por `buyerName`. Sort inicial `total desc`.
4. **OC abiertas / atrasadas** (`oc_abiertas`, temporal). KPIs propios (3): OC abiertas, OC atrasadas (bad si >0), Monto pendiente. Tabla: OC (número, mono), Proveedor (oculto móvil), Estado (`StatusBadge`), Fecha esperada, Atraso (badge "{n} d" / "Vencida" / "En plazo"), Monto (oculto móvil). Filas atrasadas resaltadas (`bg-rose-50/40`). CSV (`openCsv`): OC, Proveedor, **Comprador**, Estado, **Fecha creación**, Fecha esperada, Atrasada (Sí/No), Días de atraso, Monto. **Nota**: el CSV incluye Comprador y Fecha creación que **no** están en la tabla. Sort inicial `expected asc`.
5. **Rotación e inventario** (`rotacion`, no temporal). Tabla: Producto (nombre + SKU), Categoría (oculto móvil), Rotación (año), Días inventario (ámbar si ≥180; "+999 d" si ≥999), Stock disp. (oculto móvil), Venta 30d (oculto móvil). CSV (`rotationCsv`): SKU, Producto, Categoría, Rotación (año), Días inventario, Stock disponible, Venta 30d. Sort inicial `rotation asc`. Fuente: todos los `products`.
6. **Margen por categoría** (`margen_categoria`, no temporal). Tabla: Categoría, Nº SKUs (oculto móvil), Margen prom. (ámbar si <20%), Valor inventario (oculto móvil). CSV (`marginCsv`): Categoría, Nº SKUs, Margen promedio %, Valor inventario. Agregado: `avgMargin = marginSum/count`, `inventoryValue = Σ cost*availableStock`. Sort inicial `avgMargin asc`.
7. **Productos sin venta / críticos** (`alertas_producto`, no temporal). KPIs propios (2): Sin venta (30d) (warn si >0), Críticos (bad si >0). Tabla: Producto (nombre + SKU · categoría), Motivo (badge "Sin venta (30d) con stock" violeta / "Crítico (cobertura ≤ lead time)" rojo), Stock disp. (oculto móvil), Cobertura ("+999 d" si ≥999; oculto móvil), Capital detenido (rosa si >0, "—" si 0). CSV (`alertCsv`): SKU, Producto, Categoría, Motivo, Stock disponible, Cobertura (días), Capital detenido. Sort inicial `frozen desc`.
8. **Cumplimiento de proveedores** ("peores", `peores_proveedores`, no temporal). `HelpNote`: "Verde ≥ 85%, ámbar 70–84%, rojo < 70%". Tabla: Proveedor, Cumplimiento (badge por umbral), Lead time (oculto móvil), OC abiertas (oculto móvil), Monto pendiente (oculto móvil), Estado (`StatusBadge kind="supplier"`). CSV (`perfCsv`): Proveedor, Cumplimiento %, Lead time (días), OC abiertas, Monto pendiente, Estado. Sort inicial `compliance asc`. Fuente: `suppliers`.

### Estados posibles (existentes / no aplican por datos mock)
- **OC abiertas** (`OPEN_PO_STATUSES`): draft, pending_approval, approved, sent, confirmed, partially_received, with_difference, delayed. **Atrasada** = estado `delayed` o `delayedDays>0` o `daysToExpected < 0` (fecha esperada pasada vs `TODAY_ISO`).
- **Productos**: "sin venta" (0 ventas 30d con stock → capital detenido) vs "crítico" (con venta y cobertura ≤ lead time). Un producto sin stock y sin venta no entra en ninguno.
- **Cumplimiento proveedor**: verde ≥85%, ámbar 70–84%, rojo <70%.
- **emptyMessage** por tabla ("No hay OC para los filtros actuales", "No hay líneas de OC para desglosar por categoría en el rango", "No hay OC abiertas para los filtros actuales", "No hay productos sin venta ni críticos").
- No hay estados de carga/errores (todo derivado en memoria de mocks).

### Navegación hacia otras pantallas
- No se detectan enlaces de navegación salientes desde las filas (los reportes son de consulta/exportación). A diferencia de otras pantallas, aquí no hay `Link` a producto/proveedor.

### Flujo funcional completo
1. El usuario elige un reporte (Tab).
2. Si es temporal, acota por rango de fechas; los KPIs globales y la tabla se recalculan (`scopedOrders`).
3. Ordena por la columna de interés (top/bottom).
4. Exporta a CSV para trabajar en Excel.

### Reglas de negocio inferibles
- **Compras por categoría**: las OC no guardan categoría; se une cada línea con su producto por SKU (`getProductBySku`) y se suma `quantity × unitCost`. Solo aportan OC con líneas ("X de N OC tienen líneas"); las sin líneas o SKU desconocido caen a "Sin categoría".
- **Monto comprado** = suma de `totalAmount` de las OC en alcance.
- **Categorías activas** = categorías de productos con `salesLast30Days > 0` o `availableStock > 0`.
- **Cobertura** = `coverageDays(availableStock, salesLast30Days)`; **crítico** si `cobertura ≤ supplierLeadTimeDays`.
- **Capital detenido** = `availableStock × cost` (solo para "sin venta").
- **`daysBetween(expectedDate, TODAY_ISO)`** define `daysToExpected` (negativo = atrasado).
- **Fechas**: usan `TODAY_ISO` (constante mock), no la fecha real.

### Validaciones
No aplica (sin entradas de escritura; solo rango de fechas y orden).

### Permisos/restricciones
- Ruta sin `RoleGate`. Reportes consolidados de toda la operación (no filtrados por el comprador logueado). **Suposición**: accesibles a comprador y líder por igual.

### Dudas/definiciones pendientes
- Duplicidad de botones de exportación (header `ExportLauncher` + `ExportButton` por reporte): ambos exportan lo mismo. **Suposición**: redundancia por diseño (acceso desde header y desde la tabla).
- El CSV de OC abiertas exporta más columnas (Comprador, Fecha creación) que la tabla visible. **Nota confirmada en código.**
- Reportes no enlazan a fichas (producto/proveedor). ¿Deseado? **Definición pendiente**.
- Alcance del filtro de fechas: solo 4 de 8 reportes lo usan (`dateScopesReport`); los otros (rotación, margen, alertas de producto, cumplimiento) son "estado actual" sin dimensión temporal. **Confirmado en código.**

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
- Gestión completa de señales de ventas: flujo de 9 estados, conversión a compra, conversación, asignación, rechazo con motivo y timeline de trazabilidad; captura rápida (modal modo vendedor).
- Aprendizaje: clasificación de calidad de compra (corta/saludable/alta/sobrecompra/sin venta) e historial auditable de decisiones (sugerido vs comprado, motivo, resultado, aprendizaje).
- Reportes consolidados (8) con orden, filtro de fechas (4 de 8) y exportación CSV.

### Funcionalidades secundarias
- Gamificación: retos de la semana, novedades/feed de competición, insignias, premios en juego.
- KPIs comparativos vs promedio del equipo y ranking anonimizado.
- Analítica agregada de señales (top productos, tiendas, más solicitados).
- Diferenciación de alcance por rol en Aprendizaje (comprador vs líder).

### Dependencias con otros módulos
- **Comprar / Reposición** (`/comprar/decisiones`): destino del "foco de hoy" y del CTA de alertas.
- **Órdenes de compra / Borradores / Seguimiento** (`/comprar/borradores`, `/comprar/seguimiento`): las alertas y señales alimentan el borrador de OC (`OcDraftContext`) y enlazan a seguimiento.
- **Productos** (`/productos/:sku`, `?tab=ventas`): enlaces desde alertas, señales, calidad de compra y decisiones; el modal de señales busca en el surtido (`productService`).
- **Proveedores** (`/proveedores`, ficha `supplierPath`): enlaces desde alertas, calidad, decisiones; reporte de cumplimiento.
- **Venta no capturada** (`/venta-no-capturada`): destino de alertas de oportunidad.
- **Recomendaciones de compra** (`mockRecommendations` / `recommendationService`): usadas para la acción sugerida de alertas y la conversión de señales.
- **Reglas de compra** (`mockRules` / `resolveRuleForProduct`): objetivo de cobertura para clasificar la calidad de compra.
- **Módulo Líder** (`/equipo/*`): comparte datos de equipo (scores, alertas de equipo, ranking) pero está fuera de este módulo y protegido por `RoleGate allow="lider"`.
- **Contextos globales**: `RoleContext` (comprador/líder), `BuyerContext` (comprador actual), `SignalsContext`, `OcDraftContext`, `PurchaseFlowContext`, `ToastContext`, `NotificationContext` (notificaciones enlazan a `/alertas` y `/senales-ventas` — badges `alertas`/`senales` del menú).

> **Nota transversal (datos mock)**: toda la información es simulada y vive en memoria/`localStorage`; las fechas se calculan contra `TODAY_ISO` (constante), no contra la fecha real del sistema. No hay backend, autenticación real de ventas, carga asíncrona ni manejo de errores de red. Las persistencias (estado de alertas, señales, premios, rol, filtros en URL) son por navegador.

---

## Verificación de cobertura

Repaso de que no falte nada relevante, contrastado contra el código:

**Pantallas y sub-pestañas**
- 5 pantallas cubiertas + 2 sub-pestañas de Aprendizaje (`?tab=calidad` por defecto, `?tab=decisiones`). ✔
- Redirecciones legadas `/calidad-compra` y `/decisiones` documentadas. ✔
- `secondary: true` de Aprendizaje y Resultados (bloque secundario del menú) documentado. ✔

**Controles con etiqueta exacta**
- Alertas: 4 KPIs (Alertas activas, Severidad alta, En revisión, Resueltas), 5 tabs (Activas, Nuevas, En revisión, Resueltas, Ignoradas), buscador, 3 selects (Severidad, Tipo de alerta, Responsable), rango "Fecha de alerta", Limpiar, y labels de acción (Agregar a OC / Agregado a OC / Ver órdenes de compra / Revisar proveedor / Ver venta no capturada / Ver producto / Marcar en revisión / Marcar resuelta). ✔
- Señales: header "Reportar señal", 5 KPIs, 6 tabs, 2 toggles, 6 selects, rango "Fecha de la señal", labels de flujo `STEP` (7), "Convertir en compra"/"En borrador de OC", "Rechazar"/"Confirmar rechazo", "Editar/Completar", "Enviar", `MoreActions` (Ver historial del producto / Ver ventas recientes / Asignármela). ✔
- Modal de reporte: 4 secciones numeradas + evidencia plegable + "Reportado por"; los 6 vendedores y las 2 tiendas listados; footer Cancelar/Enviar señal. ✔
- Aprendizaje: 2 tabs, buscadores y selects de Resultado exactos por sub-pestaña. ✔
- Reportes: 8 tabs, `ExportLauncher`/`ExportButton` ("Exportar CSV"), rango de fechas, orden por columna. ✔

**Campos de formulario**
- Modal de señal, solicitud de compra (6 campos), rechazo, mensaje: todos con tipo (texto/número/date). ✔
- No hay formularios en Mi desempeño ni Reportes (solo filtros/rango). ✔

**Columnas de tabla, KPIs y tarjetas**
- Todas las columnas de las tablas de Calidad, Decisiones (tarjetas) y los 8 reportes documentadas, incluyendo `hideOnMobile`, umbrales de color y valores especiales ("+999 d", "—", "Vencida"/"En plazo"). ✔

**Los 8 reportes**
- Nombre, temporalidad (4 temporales / 4 estado actual), columnas de tabla, columnas CSV, KPIs propios (OC abiertas, alertas de producto), `HelpNote` (categoría, cumplimiento), sort inicial y agregación. ✔
- Discrepancia CSV vs tabla en "OC abiertas" (CSV añade Comprador y Fecha creación) señalada. ✔

**Navegación con destino exacto**
- Metas → `/comprar/decisiones`. Alertas → `/comprar/borradores`, `/comprar/seguimiento`, `/proveedores`, `/venta-no-capturada`, `/productos/{sku}`, `/comprar/decisiones`. Señales → `/comprar/borradores`, `/productos/{sku}`, `/productos/{sku}?tab=ventas`. Aprendizaje → `/productos/{sku}`, `supplierPath`. Reportes → sin enlaces salientes de fila. ✔

**Reglas de negocio con umbrales/constantes reales**
- Ligas (0–59/60–74/75–84/85–94/95–100), fórmula de mejoras (`min(95,val+15)`, peso), percentil ±20, atribución (25–55% / 10–30%, `*0.8`), prioridad sugerida de señales, clasificación de calidad (`objMin`/`objMax`, `*1.8`, obj 45 por defecto), umbrales de cumplimiento (85/70), margen esperado (<20%), días inventario (≥180 ámbar, ≥999 "+999 d"). ✔

**Estados reales vs inexistentes por mock**
- `AlertStatus` "ignored" existe pero sin acción de UI para asignarlo (marcado). ✔
- `SignalStatus` (9) todos alcanzables por UI. ✔
- Sin estados de carga/error/red en ninguna pantalla (mock + localStorage). ✔

**Permisos (RoleGate / rol)**
- Ninguna ruta del módulo usa `RoleGate`; solo `/equipo/*` (fuera del módulo). ✔
- Diferenciación real por rol solo en Aprendizaje (comprador ve lo suyo, líder ve todo) vía `useRole`. ✔
- Reportes y las demás pantallas no filtran por rol. ✔

**Validaciones**
- Alertas: solo deshabilitar "Agregar a OC" si ya en borrador. Señales: `canSubmit`, rechazo ≥3, mensaje no vacío, convertir deshabilitado si ya en OC. Aprendizaje/Reportes/Metas: sin validaciones (lectura). ✔

**Dudas / definiciones pendientes** — recogidas por pantalla: interactividad de `ChallengeList`/`CompetitionFeed`, edición de premios, marcado de "Ignorada", origen de recomendaciones, autenticación de vendedores, catálogo de tiendas, pérdida de `InfoHint` embebido, origen de `decisions`, redundancia de exportación, ausencia de enlaces en reportes. ✔

**Puntos observados adicionalmente (no en la versión previa)**
- Anonimización del ranking con `String.fromCharCode(65+i)` usa índice global, por lo que la letra "salta" la posición del propio comprador (nota en Reglas de negocio de la Pantalla 1).
- Badges de menú (`alertas`, `senales`) y `badgeKeys` del módulo agregan contadores dinámicos.
- El KPI "Venta perdida est." de Señales es el único no clicable de su fila.
- CSV de OC abiertas exporta columnas ausentes en la tabla.
