# Módulo: Equipo y Líder

> Levantamiento funcional basado exclusivamente en el código del frontend (React + TypeScript, datos mock). Documento en español. Cuando algo no está definido en el código se marca como **Definición pendiente** o **Suposición**. Todos los datos provienen de arreglos mock; no hay backend real.

## Contexto del módulo

Conjunto de pantallas que dan al **Líder de Compras** una visión transversal (cross-comprador) del equipo: desempeño agregado, alertas priorizadas, fichas de compradores, competencia/ranking gamificado, metas (OKRs) y equilibrio de carga con reasignación.

### Restricción de permisos (RoleGate) — aplica a TODO el módulo

Todas las rutas de este módulo están envueltas por `<RoleGate allow="lider">` en `src/routes/AppRoutes.tsx` (líneas 146-193, 6 rutas: `/equipo`, `/equipo/alertas`, `/equipo/compradores`, `/equipo/ranking`, `/equipo/metas`, `/equipo/carga`). El componente `RoleGate` (`src/components/layout/RoleGate.tsx`) obtiene el rol actual con `useRole()`:

- Si `role === allow` (es decir `role === "lider"`), renderiza la pantalla (`children`).
- Si el rol es distinto (p. ej. `comprador`), NO muestra la pantalla; en su lugar renderiza un contenedor `div.py-10` con un `EmptyState`:
  - Título: "Sección del Líder de Compras".
  - Descripción: "Esta vista muestra datos de todo el equipo (varios compradores). Tu rol actual es Comprador, que solo accede a su propia cartera."
  - Botón "Volver al inicio" (`Button`) que navega a `/`.

**Nota:** todas estas rutas están además dentro de `RequireAuth` (exigen sesión) y se cargan con `React.lazy` + `Suspense` (cada página en su propio chunk; fallback `PageSkeleton`). El `RoleGate` NO redirige la URL: el usuario sin permiso permanece en la ruta pero ve el `EmptyState` (la URL de equipo sigue visible en la barra).

Además, en la navegación (`src/components/layout/navItems.tsx`) los módulos de equipo se agrupan como "Módulos EXTRA solo del Líder de Compras (visión de equipo y cross-comprador)". Al cambiar de rol, el `Topbar` (`src/components/layout/Topbar.tsx`, función `switchRole`, líneas 69-73) redirige: `lider → /equipo`, `comprador → /`.

**Roles del sistema:** `comprador` y `lider` (tipo `Role` en `RoleContext`). Estas 6 pantallas son exclusivas del rol **lider**.

### Fuentes de datos mock comunes

- `src/data/mockBuyers.ts` (`buyers`, `getBuyer(id)`): lista de **5 compradores** — `andrea` (Andrea Muñoz), `maria` (María González), `catalina` (Catalina Saavedra), `juan` (Juan Pérez), `felipe` (Felipe Rojas) — con score, carga, indicadores y metas. Tipo `Buyer` en `src/types/team.ts`.
- `src/data/mockLeaderAlerts.ts` (`leaderAlerts`): **6 alertas** del líder. Tipo `LeaderAlert`.
- `src/data/mockSuppliers.ts` (`suppliers`): proveedores (usado en carga).
- `src/data/mockChallenges.ts` (`SEASON`, `PREV_SEASON_NAME`, `challenges`): temporada y **5 retos**.
- `src/data/mockRewards.ts` (`defaultRewards` [3 premios], `REWARD_CRITERIA` [5 criterios], tipo `Reward`): premios configurables.
- `src/data/mockSeasonHistory.ts` (`seasonHistory`): temporadas anteriores.
- `src/data/mockCompetitionFeed.ts` (`competitionFeed`): novedades del equipo.
- Lógica de cálculo: `src/utils/teamScore.ts` (score, ligas, carga, OKR, temporada, badges, ganadores de premio).
- `src/utils/constants.ts`: `TODAY_ISO = "2026-06-24"` ("hoy" de la demo). Es una fecha fija del mock; NO usa la fecha real del sistema. Afecta `daysToClose`.
- `SignalsContext` (solicitudes/señales) usado en la pantalla de carga.

### Constantes y umbrales transversales (`teamScore.ts`)

- **`scoreLabel(s)`:** ≥90 Excelente · ≥80 Muy bueno · ≥70 Bueno · ≥55 Debe mejorar · <55 Crítico.
- **`scoreColor(s)`:** ≥90 `#059669` (verde) · ≥80 `#1b3bad` (azul) · ≥70 `#b45309` · ≥55 `#d97706` (ámbar) · <55 `#be123c` (rojo).
- **`scoreTone(s)`** (badge): ≥90 green · ≥80 blue · ≥55 amber · <55 red.
- **`LEAGUES` / `leagueOf(score)`:** Bronce 0–59 (slate, `#a16207`) · Plata 60–74 (blue, `#64748b`) · Oro 75–84 (amber, `#d97706`) · Elite 85–94 (violet, `#7c3aed`) · Leyenda 95–100 (green, `#059669`). `leagueOf` también devuelve `next` y `ptsToNext` (no usados en estas pantallas).
- **`WORKLOAD_CFG` (5 niveles categóricos):** `muy_baja` "Muy baja" (slate) · `baja` "Baja" (blue) · `normal` "Normal" (green) · `alta` "Alta" (amber) · `critica` "Crítica" (red).
- **`workloadBarColor(pct)` (numérico, independiente del nivel categórico):** ≥90 `#f43f5e` (rojo) · ≥75 `#f59e0b` (ámbar) · <75 `#10b981` (verde). **Importante:** el _texto/badge_ de carga usa `WORKLOAD_CFG[b.workload]` (campo categórico del mock) mientras que el _color de la barra_ usa `workloadBarColor(b.workloadPct)` (umbral numérico); son dos sistemas distintos y pueden no coincidir visualmente.
- **`byWorkloadDesc`:** ordena por `WORKLOAD_ORDER` (critica 0 → alta 1 → normal 2 → baja 3 → muy_baja 4), es decir de crítica a muy baja.
- **`trendText(t)`:** t>0 `+N pts` · t<0 `-N pts` · t=0 "Sin cambio". **`trendColor`:** +verde `#059669` / −rojo `#e11d48` / 0 gris `#94a3b8`.
- **`stockoutRate(b)`** = `round((stockouts / products) · 1000)/10` (%, 1 decimal); 0 si products=0.
- **`recovery(b)`** = último − primer valor de `scoreHist` (6 semanas).
- **`teamAggregate(bs)`:** promedios (score, goalArea=goalComp, fillRate, sla, replen=replenDays) y sumas (stockouts, critical, overstock, pending, openPO, categories, suppliers, brands, products, sales, savings); `n` = nº de compradores.

### Componentes compartidos relevantes

- `BuyerDetailDrawer` (`src/components/business/BuyerDetailDrawer.tsx`): panel lateral (Drawer) con la ficha completa del comprador. Se abre desde el Panel, Alertas, Compradores y Ranking. Ver detalle en "Ficha del comprador (Drawer compartido)".
- `PageHeader`, `Card/CardHeader/CardBody`, `KpiCard`, `Badge`, `Button`, `Modal`, `Input`, `Select`, `EmptyState`, `Drawer`, `ChallengeList`, `CompetitionFeed`, `Sparkline`, íconos (`IconAlerts`, `IconChevronRight`, `IconArrowRight`, `IconInfo`, `IconSales`).
- `BUYER_TONE_AV` (alias de `PILL_TONE`/`TONE_AV` en `utils/tone`): mapa tono→clases del avatar de iniciales.

---

## Pantalla 1: Panel del equipo

### Nombre
Panel del equipo (Team Dashboard).

### Ruta(s)
`/equipo` — Archivo: `src/pages/TeamDashboardPage.tsx`. Protegida por `RoleGate allow="lider"`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Dar al líder una vista de una sola pantalla del estado del área de compras "hoy", priorizando primero las excepciones que requieren su atención y luego los indicadores agregados, el mejor/peor desempeño y la carga del equipo.

### Tipo de usuario
Solo rol **lider** (RoleGate).

### Descripción detallada
Página compuesta por: un "hero" con el score promedio del equipo; una tarjeta de excepciones ("Requiere tu atención"); una grilla de KPIs agregados; dos tarjetas de "Mejor desempeño"/"Necesita apoyo"; y una tarjeta de "Carga del equipo" con barras por comprador. Los agregados se calculan con `teamAggregate(buyers)`. Descripción del `PageHeader`: "Cómo está funcionando el área de compras hoy. Primero las excepciones, luego los indicadores."

### Información que muestra
- **Hero (score del equipo):**
  - Etiqueta "Score promedio del equipo", score promedio grande (`a.avgScore`) + "/100" y etiqueta cualitativa (`scoreLabel`, en verde esmeralda).
  - "Compradores" (`a.n` = 5).
  - "Venta del equipo" (`formatCurrencyCompact(a.sales)`).
  - "Ahorro negociado" (`formatCurrencyCompact(a.savings)`).
- **Requiere tu atención (excepciones):** hasta 4 alertas ordenadas por severidad (high, medium, low), cada fila con título (`e.title`), línea "`e.buyer ?? "Área"` · `e.action`" y badge de severidad (Alta/Media/Baja). Borde izquierdo de 3px coloreado (rojo `#f43f5e` / ámbar `#f59e0b` / gris `#94a3b8`). Enlace "Ver todas (N)" donde **N = cantidad de alertas `high`** (no el total de alertas).
- **KPIs (8 tarjetas `KpiCard`, todas con `IconAlerts`):**
  1. Cumplimiento de metas (`a.goalArea%`), sub "Meta del área: 85%", tono `good` si ≥85 si no `warn`.
  2. Fill Rate del área (`a.fillRate%`), sub "Pedidos completos", `good` si ≥90 si no `warn`.
  3. Nivel de servicio (`a.sla%`), sub "Cumplimiento SLA", `good` si ≥90 si no `warn`.
  4. Quiebres totales (`formatNumber(a.stockouts)`), sub "`a.critical` críticos", tono `bad`.
  5. Compras pendientes (`a.pending`), sub "`a.openPO` OC abiertas", tono `warn`.
  6. Tiempo de reposición (`a.replen` + " d"), sub "Promedio del equipo", tono `info`.
  7. Sobrestock (`a.overstock`), sub "SKUs sobre el máximo", tono `neutral`.
  8. Productos gestionados (`a.products`), sub "`a.categories` categorías · `a.suppliers` prov.", tono `neutral`.
- **Mejor desempeño:** top 2 compradores por score descendente (`PerfRow`); avatar (iniciales), nombre, subtítulo = categorías (`b.categories.join(" · ")`), score coloreado (`scoreColor`) y tendencia (`trendText`/`trendColor`).
- **Necesita apoyo:** bottom 2 por score (invertidos, peor primero); subtítulo "`b.stockouts` quiebres · carga `WORKLOAD_CFG[b.workload].label`".
- **Carga del equipo:** los 5 compradores ordenados por carga descendente (`byWorkloadDesc`), con avatar, nombre, barra de progreso `workloadPct` coloreada por `workloadBarColor` y etiqueta "`WORKLOAD_CFG[b.workload].label` `b.workloadPct`%".

### Secciones/bloques
1. Encabezado (`PageHeader`): "Panel del equipo" + descripción.
2. Hero score + tarjeta de excepciones (grid `[1fr_2fr]` en desktop).
3. Grilla de 8 KPIs (`KpiCard`).
4. Tarjetas "Mejor desempeño" / "Necesita apoyo".
5. Tarjeta "Carga del equipo".
6. `BuyerDetailDrawer` (oculto hasta seleccionar).

### Filtros disponibles
Ninguno. No hay filtros ni búsqueda en esta pantalla.

### Acciones del usuario
- Clic en un comprador de "Mejor desempeño"/"Necesita apoyo" → abre `BuyerDetailDrawer`.
- Clic en una excepción → `openByName(e.buyer)`: si el nombre corresponde a un comprador de `buyers`, abre su drawer; si `buyer` es null o no se encuentra, navega a `/equipo/carga`.
- "Ver todas (N)" → navega a `/equipo/alertas`.
- "Equilibrar carga" (en Carga del equipo) → navega a `/equipo/carga`.
- Cerrar drawer.

### Botones y controles
- Botón enlace "Ver todas (N)" (texto brand-600).
- Botón enlace "Equilibrar carga" con `IconChevronRight`.
- Filas-botón (`<button>`) de compradores (`PerfRow`) y de excepciones.

### Tablas / tarjetas / formularios / componentes
- Tarjetas: hero (div con gradiente `#1f2a5a→#3b2f7a`), `Card` de excepciones, `KpiCard` ×8, `Card` mejor/peor, `Card` de carga.
- Componente auxiliar interno `PerfRow` (fila de desempeño).
- `BuyerDetailDrawer`. No hay tablas ni formularios.

### Campos de formularios
No aplica (sin formularios).

### Estados posibles
- **Con datos:** siempre hay datos mock (5 buyers y 6 leaderAlerts), por lo que la pantalla siempre muestra contenido.
- **Vacío / sin resultados:** no implementado (no hay manejo explícito de lista vacía).
- **Carga (loading):** no aplica (datos síncronos en memoria; el `Suspense` de ruta muestra `PageSkeleton` solo durante la carga del chunk).
- **Error:** no aplica.
- **Drawer abierto/cerrado:** estado `sel` (`Buyer | null`).
- Tonos condicionales de KPIs según umbrales (good/warn/bad/info/neutral).

### Navegación hacia otras pantallas
- `/equipo/alertas` (ver todas las alertas).
- `/equipo/carga` (equilibrar carga; también fallback de `openByName` cuando la excepción no tiene comprador identificable).
- `BuyerDetailDrawer` → botón interno "Equilibrar carga de este comprador" navega a `/equipo/carga`.

### Flujo funcional completo
1. El líder entra a `/equipo`.
2. `teamAggregate` calcula agregados sobre `buyers`.
3. Se ordenan compradores por score (top/bottom) y por carga; se toman las 4 alertas más severas.
4. El líder revisa excepciones → decide actuar (drawer del comprador o ir a carga/alertas).
5. Revisa KPIs y balance de carga; puede saltar a alertas o a reasignación.

### Reglas de negocio inferibles
- Prioridad visual: primero excepciones, luego indicadores (declarado en la descripción).
- Umbrales de KPI: cumplimiento de metas 85%, Fill Rate 90%, SLA 90%.
- Orden de severidad: high(0) < medium(1) < low(2).
- "Ver todas (N)" cuenta solo alertas `high`, no el total.
- Score promedio y demás agregados son promedios/sumas simples del equipo (`teamAggregate`).
- Carga ordenada de crítica a muy baja.

### Validaciones
No hay entradas de usuario; no hay validaciones.

### Permisos / restricciones
Exclusiva del rol **lider** vía `RoleGate allow="lider"` (ruta `/equipo`).

### Dudas / definiciones pendientes
- **Definición pendiente:** manejo de estados vacíos (equipo sin compradores, sin alertas).
- **Suposición:** los umbrales (85/90/90) son metas del área fijas; no hay configuración visible para cambiarlos.
- La acción de excepción para alertas sin comprador siempre lleva a carga; **Definición pendiente** si eso es correcto para todos los tipos "de Área".

---

## Pantalla 2: Alertas del equipo

### Nombre
Alertas del equipo.

### Ruta(s)
`/equipo/alertas` — Archivo: `src/pages/TeamAlertsPage.tsx`. Protegida por `RoleGate allow="lider"`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Concentrar las alertas que requieren la intervención del líder, explicando para cada una qué pasa, por qué importa y qué hacer, con un botón de acción que enruta a la pantalla adecuada.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Lista vertical de tarjetas de alerta (`leaderAlerts`) ordenadas por severidad. Cada tarjeta muestra severidad, tipo, comprador afectado, título, detalle, un recuadro "Por qué importa" (impacto según tipo) y un botón de acción contextual. Descripción del `PageHeader`: "Lo que necesita tu intervención como líder. Cada alerta dice qué pasa, por qué importa y qué hacer."

### Información que muestra
- **Resumen (3 badges con punto `dot`):** conteo por severidad — "N de alta prioridad" (tone red), "N media" (amber), "N baja" (slate). Cuenta sobre `leaderAlerts` completo.
- **Por cada alerta (`Card` p-4):**
  - Barra lateral vertical de color según severidad (`accent`: rojo `#f43f5e` / ámbar `#f59e0b` / gris `#94a3b8`).
  - Badge "Severidad `Alta/Media/Baja`".
  - Etiqueta de tipo en mayúsculas (`TYPE_LABEL`): Desempeño, Sobrecarga, Baja carga, Quiebres, Sin responsable, Meta en riesgo, Proveedor.
  - Separador "·" y comprador afectado (`a.buyer` o "Área").
  - Título (`a.title`) y detalle (`a.detail`).
  - Recuadro ámbar (`bg-amber-50`) con `IconAlerts` y "**Por qué importa:** `IMPACT[a.type]`".
  - Columna derecha: etiqueta "Acción" + `Button size="sm"` con texto `a.action` e `IconArrowRight`.

### Tipos de alerta (mock) y su impacto (`IMPACT`)
`perf_drop` (Desempeño) → "Riesgo de seguir bajando si no hay apoyo a tiempo." · `overload` (Sobrecarga) → "Mayor probabilidad de quiebres y errores por exceso de trabajo." · `underload` (Baja carga) → "Capacidad desaprovechada que podría aliviar a otros." · `stockouts` (Quiebres) → "Venta perdida activa en sus categorías." · `no_owner` (Sin responsable) → "Nadie está reponiendo ni negociando esa categoría." · `goal_risk` (Meta en riesgo) → "La meta no se cumpliría al cierre del período." · `no_supplier` (Proveedor) → "No se puede generar reposición sin proveedor."

Alertas mock actuales (6): LA-1 perf_drop/high (Felipe Rojas, "Ver ficha y agendar 1:1"), LA-2 overload/high (Catalina Saavedra, "Reasignar carga"), LA-3 stockouts/high (Juan Pérez, "Revisar reposición"), LA-4 no_owner/medium (Área, "Decohogar", "Asignar comprador"), LA-5 goal_risk/medium (María González, "Revisar meta"), LA-6 underload/low (Felipe Rojas, "Balancear equipo"). → Resumen resultante: **3 alta · 2 media · 1 baja**.

### Secciones/bloques
1. `PageHeader` "Alertas del equipo".
2. Fila de badges-resumen por severidad.
3. Lista de tarjetas de alerta (ordenadas high→medium→low).
4. `BuyerDetailDrawer`.

### Filtros disponibles
Ninguno. No hay filtros ni buscador. Las alertas solo se ordenan por severidad (no configurable).

### Acciones del usuario
- Clic en el botón de acción de una alerta → función `handle(a)`, que enruta según el tipo:
  - `overload` / `underload` / `no_owner` → `/equipo/carga`.
  - `goal_risk` → `/equipo/metas`.
  - `no_supplier` → `/proveedores` (fuera del módulo).
  - Otro tipo con comprador (`a.buyer` encontrado en `buyers`) → abre `BuyerDetailDrawer`.
  - Sin coincidencia y sin comprador → `/equipo/compradores`.
- Cerrar drawer.

### Botones y controles
- Botón de acción por alerta (`Button size="sm"` con texto dinámico `a.action` e `IconArrowRight`).
- Badges de resumen (no interactivos).

### Tablas / tarjetas / formularios / componentes
- `Card` por alerta; `Badge`; `Button`; `BuyerDetailDrawer`. Sin tablas ni formularios.

### Campos de formularios
No aplica.

### Estados posibles
- **Con datos:** lista de 6 alertas mock.
- **Vacío:** no implementado (sin manejo de lista vacía).
- **Loading / Error:** no aplica (datos en memoria).
- **Drawer abierto/cerrado** (`sel`).

### Navegación hacia otras pantallas
- `/equipo/carga`, `/equipo/metas`, `/equipo/compradores`, `/proveedores` (fuera del módulo, hacia módulo de Proveedores).
- `BuyerDetailDrawer` (y su botón interno hacia `/equipo/carga`).

### Flujo funcional completo
1. El líder entra a `/equipo/alertas`.
2. Ve el resumen por severidad y la lista ordenada (high primero).
3. Lee qué pasa, por qué importa y la acción recomendada.
4. Pulsa la acción → se le lleva a la pantalla correspondiente o se abre la ficha del comprador para resolver.

### Reglas de negocio inferibles
- Cada tipo de alerta tiene un destino de acción predefinido (enrutamiento por tipo, no por el texto del botón).
- Las alertas de carga (sobrecarga/baja carga/sin responsable) se resuelven en la pantalla de carga.
- Alertas de meta → metas; de proveedor → proveedores.
- Orden fijo por severidad (high→medium→low).

### Validaciones
No aplica (sin entradas).

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`, ruta `/equipo/alertas`).

### Dudas / definiciones pendientes
- **Definición pendiente:** no existe acción de "descartar", "marcar como resuelta" ni persistencia del estado de una alerta; son de solo lectura + navegación.
- **Definición pendiente:** estado vacío cuando no hay alertas.
- **Suposición:** `no_supplier` lleva a un módulo externo (`/proveedores`); dependencia con ese módulo.

---

## Pantalla 3: Compradores

### Nombre
Compradores.

### Ruta(s)
`/equipo/compradores` — Archivo: `src/pages/BuyersPage.tsx`. Protegida por `RoleGate allow="lider"`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Mostrar una ficha ejecutiva (tarjeta) por cada comprador con sus KPIs clave, nivel/liga y carga, permitiendo abrir el detalle completo.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Grilla de tarjetas (1 / 2 / 3 columnas según ancho `sm`/`xl`) con los 5 compradores ordenados por score descendente. Cada tarjeta es un `<button>` que abre el `BuyerDetailDrawer`. Descripción del `PageHeader`: "Ficha ejecutiva de cada comprador. Haz clic para ver su detalle, KPIs, metas y evolución."

### Información que muestra
Por tarjeta de comprador:
- Avatar con iniciales (clases por `tone` vía `BUYER_TONE_AV`).
- Nombre y categorías (`b.categories.join(" · ")`).
- Score (2xl, coloreado por `scoreColor`) y tendencia (`trendText`/`trendColor`).
- Badge "Nivel `<liga>`" (`leagueOf(b.score).league.name`, tono `league.tone`).
- Badge "Carga `<nivel>`" (`WORKLOAD_CFG[b.workload]`, tono correspondiente).
- Mini-grilla de 4 métricas: Fill Rate (`b.fillRate%`, slate), Quiebres (`b.stockouts`, rose-700), Pendientes (`b.pending`, amber-700), Alertas (`b.alerts`, rose-600).

### Secciones/bloques
1. `PageHeader` "Compradores".
2. Grilla de tarjetas de comprador.
3. `BuyerDetailDrawer`.

### Filtros disponibles
Ninguno. No hay filtros, buscador ni ordenamiento configurable (orden fijo por score descendente).

### Acciones del usuario
- Clic en una tarjeta → abre `BuyerDetailDrawer` del comprador.
- Cerrar drawer.

### Botones y controles
- Cada tarjeta es un `<button>`. No hay otros controles.

### Tablas / tarjetas / formularios / componentes
- Tarjetas de comprador (botones); `Badge`; `BuyerDetailDrawer`. Sin tablas ni formularios.

### Campos de formularios
No aplica.

### Estados posibles
- **Con datos:** grilla de 5 compradores mock.
- **Vacío / Loading / Error:** no aplica / no implementado.
- **Drawer abierto/cerrado** (`sel`).

### Navegación hacia otras pantallas
- Vía `BuyerDetailDrawer` → botón interno a `/equipo/carga`.

### Flujo funcional completo
1. El líder entra a `/equipo/compradores`.
2. Escanea las fichas ordenadas por score.
3. Abre el detalle de un comprador para revisar KPIs, desglose de score, evolución y metas.

### Reglas de negocio inferibles
- Orden por score descendente (mejor primero).
- La liga se deriva del score (`leagueOf`); el badge de carga del campo categórico `b.workload`.

### Validaciones
No aplica.

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`, ruta `/equipo/compradores`).

### Dudas / definiciones pendientes
- **Definición pendiente:** falta de filtros/búsqueda por categoría, carga o liga (podría ser deseable con muchos compradores).
- **Definición pendiente:** estado vacío.

---

## Pantalla 4: Competencia / Ranking

### Nombre
Competencia del equipo (Ranking).

### Ruta(s)
`/equipo/ranking` — Archivo: `src/pages/RankingPage.tsx`. Protegida por `RoleGate allow="lider"`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Capa de gamificación: posicionar a los compradores según el score global (0–100), mostrar la temporada en curso, rankings por dimensión, reconocimientos, movimientos de liga, retos, premios configurables, temporadas anteriores y novedades del equipo.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Pantalla larga con múltiples bloques. Incluye una explicación de la fórmula del score, un banner de temporada con podio, KPIs del equipo, ranking general, rankings destacados, reconocimientos del mes, movimientos de liga, retos de la semana, premios configurables (con Modal CRUD), temporadas anteriores y un feed de novedades. **Es la única pantalla del módulo con persistencia local (premios en localStorage) y con formulario/Modal de escritura.** Descripción del `PageHeader`: "Posición según el score global (0–100). No es solo quién vende más: el score pondera venta, margen, quiebres, rotación, OC y sobrestock para que la comparación sea justa."

### Información que muestra
- **Explicación del score (banner info brand):** "**Score** = 30% cumplimiento de venta · 20% margen · 20% reducción de quiebres · 15% rotación · 10% cumplimiento de OC · 5% gestión de sobrestock. Hay rankings por dimensión para que cada quien pueda destacar en lo suyo." (texto declarativo; no hay cálculo del score global en este archivo — `b.score` viene del mock).
- **Temporada en curso (hero gradiente):** "🏆 `SEASON.name`" = "Temporada Junio 2026"; "Cierra en `daysToClose(SEASON.to)` días" — con `TODAY_ISO = 2026-06-24` y `SEASON.to = 2026-06-30` → **6 días**; texto "Al cierre se confirman ascensos y descensos de liga. Los 3 primeros reciben reconocimiento del mes."; podio con los 3 primeros por score (medallas 🥇🥈🥉, primer nombre `b.name.split(" ")[0]`, `b.score` pts).
- **KPIs del equipo (3 `KpiCard`):** Score promedio (`agg.avgScore` pts, tono info) · Tasa de quiebres (promedio de `stockoutRate(b)`, 1 decimal es-CL, tono bad) · Margen promedio (promedio de `b.margin`, 1 decimal, tono good).
- **Ranking general:** los 5 compradores ordenados por score desc. Posición (medalla si top 3, si no `i+1`), avatar, nombre, badge de liga (`league.name`), tendencia, subtítulo ("Líder del equipo" para el #1 o "A `gap` pts del #`i`" donde `gap = sorted[i-1].score − b.score`), y score grande coloreado (`scoreColor`). El #1 tiene fondo destacado (`#fffdf5`).
- **Rankings destacados (`RANKING_DEFS`, 4 tarjetas con top 3 cada una):**
  - "Mejor margen bruto" (`b.margin`, "%").
  - "Menor tasa de quiebres" (`stockoutRate`, **asc**, "%").
  - "Mayor rotación saludable" (`b.rotation`, "x").
  - "Mayor mejora vs mes anterior" (`recovery` = último − primer valor de `scoreHist`, "pts").
- **Reconocimientos del mes (`badgesOf`, 6 insignias 🏅):** Mejor margen (`b.margin`) · Menos quiebres (`stockoutRate` asc) · Mejor rotación (`b.rotation`) · Mayor mejora (`recovery`) · Mejor sobrestock (`b.overstock` **asc**, "SKUs") · Mejor negociador (`b.savings`, "$N M"). Cada tarjeta muestra label, nombre del ganador y valor.
- **Movimientos de liga (vs `PREV_SEASON_NAME` = Mayo 2026):** por comprador (orden score desc), liga anterior → liga actual (`seasonStatus` compara `leagueOf(prevSeasonScore)` con `leagueOf(score)`) y badge Ascenso ▲ (green) / Descenso ▼ (red) / Mantiene = (slate) según `SEASON_MOVE_CFG`.
- **Retos de la semana (`challenges`, 5 mock):** renderizados por `ChallengeList`. Tipos: `team` (reto de equipo con `progress` 0–100 y `targetText`), `duel` (duelo 1v1 por `metric` entre `aId`/`bId` con `leaderId`), `streak` (racha `weeks`/`goalWeeks` con `reward`).
- **Premios de la temporada (configurables):** tarjetas de premios (`rewards`, persistidos en localStorage clave `compras:rewards`, default `defaultRewards` [3]). Cada tarjeta: emoji 🎁, título, recompensa, criterio (`critLabel`) y "Va ganando: `<comprador>`" (`winnerByCriterion`). Botón "Editar" por tarjeta y "+ Agregar premio".
- **Temporadas anteriores (`seasonHistory`):** por temporada: nombre, campeón (`getBuyer(championId)`: avatar 🥇 + nombre + "Campeón · `championScore` pts") y podio (🥇🥈🥉 con primeros nombres de `s.podium`).
- **Novedades del equipo:** `CompetitionFeed` con `competitionFeed`.

### Secciones/bloques
1. `PageHeader` "Competencia del equipo".
2. Banner informativo de la fórmula del score.
3. Hero de temporada + podio.
4. 3 KPIs del equipo.
5. Ranking general.
6. Rankings destacados (4 tarjetas).
7. Reconocimientos del mes (6).
8. Movimientos de liga.
9. Retos de la semana (`ChallengeList`).
10. Premios de la temporada (+ Modal).
11. Temporadas anteriores.
12. Novedades del equipo (`CompetitionFeed`).
13. `Modal` de premio y `BuyerDetailDrawer`.

### Filtros disponibles
Ninguno. No hay filtros; los ordenamientos son fijos por dimensión.

### Acciones del usuario
- Clic en cualquier fila/tarjeta de comprador (ranking general, rankings destacados, reconocimientos, movimientos de liga, "Va ganando") → abre `BuyerDetailDrawer`.
- "+ Agregar premio" → abre Modal con un premio nuevo vacío (`id: r<Date.now()>`, `criterion: "general"`, título/premio vacíos).
- "Editar" en una tarjeta de premio → abre Modal con ese premio.
- En el Modal: cambiar criterio, título, premio; Guardar (valida), Cancelar, Eliminar (solo si el id ya existe en `rewards`).
- Cerrar drawer/modal.

### Botones y controles
- `Button` "+ Agregar premio" (secondary, sm).
- Botón "Editar" (texto brand-600) por premio.
- Modal: `Select` (criterio), `Input` (título), `Input` (premio); footer con `Button` Eliminar (danger, solo edición), Cancelar (secondary), Guardar.
- Filas-botón de compradores en varios bloques.

### Tablas / tarjetas / formularios / componentes
- KPIs (`KpiCard`), `Card`, `Badge`, `Button`, `Modal`, `Input`, `Select`.
- `ChallengeList`, `CompetitionFeed`, `BuyerDetailDrawer`.
- **Formulario:** dentro del Modal de premio.
- Sin tablas HTML; todo son listas/tarjetas.

### Campos de formularios (Modal de premio)
- **Criterio** (`Select`): opciones `REWARD_CRITERIA` — Campeón general (mayor score) / Mayor recuperación del mes / Menor tasa de quiebres / Mejor margen bruto / Mayor rotación saludable. Valores internos: `general` / `mejora` / `quiebres` / `margen` / `rotacion`.
- **Título** (`Input`, texto): placeholder "Ej: Campeón de la temporada". Obligatorio (trim).
- **Premio / recompensa** (`Input`, texto): placeholder "Ej: Bono $150.000 + día libre". Obligatorio (trim).
- Título del Modal: "Editar premio" si el id existe en `rewards`, si no "Nuevo premio". Descripción: "Define el criterio y la recompensa. El ganador se calcula solo según el desempeño."

### Estados posibles
- **Con datos:** siempre (mock).
- **Modal abierto/cerrado** (`rewardForm`: `Reward | null`).
- **Modo Modal:** "Nuevo premio" (id no existente en `rewards`) vs "Editar premio" (id existente → muestra botón Eliminar).
- **Persistencia:** premios en `localStorage["compras:rewards"]` vía `useLocalStorage`; sobreviven recarga (el resto de datos son mock estáticos en memoria).
- **Toasts:** advertencia ("Completa el título y el premio"), éxito ("Premio guardado" / "Premio eliminado").
- **Vacío / Loading / Error:** no implementado / no aplica.
- **Drawer abierto/cerrado** (`sel`).

### Navegación hacia otras pantallas
- No navega a otras rutas directamente (salvo el botón interno del `BuyerDetailDrawer` → `/equipo/carga`).

### Flujo funcional completo
1. El líder entra a `/equipo/ranking`.
2. Revisa la temporada en curso, el podio y los KPIs.
3. Explora el ranking general y los rankings por dimensión; abre fichas de compradores.
4. Revisa reconocimientos, movimientos de liga y retos.
5. Configura premios: agrega/edita/elimina (persisten en localStorage). El ganador se recalcula automáticamente según el criterio (`winnerByCriterion`).
6. Consulta temporadas anteriores y el feed de novedades.

### Reglas de negocio inferibles
- **Fórmula del score global (declarada, no calculada aquí):** 30% venta / 20% margen / 20% quiebres / 15% rotación / 10% OC / 5% sobrestock. El valor `b.score` es dato del mock.
- **Ligas por score (`LEAGUES`):** Bronce 0–59, Plata 60–74, Oro 75–84, Elite 85–94, Leyenda 95–100.
- **Movimiento de liga:** compara `leagueOf(prevSeasonScore)` vs `leagueOf(score)` por índice de liga (ascenso/descenso/mantiene).
- **Ganador de premio (`winnerByCriterion`):** general=mayor `score`, mejora=mayor `recovery`, quiebres=menor `stockoutRate`, margen=mayor `margin`, rotacion=mayor `rotation`.
- **Reconocimientos del mes (`badgesOf`):** el mejor de cada dimensión, incluyendo sobrestock (menor) y ahorro (mayor).
- **Rankings destacados** usan `asc` según la métrica (quiebres ascendente; resto descendente).
- **`daysToClose`:** `max(0, round((SEASON.to − TODAY_ISO)/día))`. Con las constantes actuales = 6.
- Al cierre de temporada se "confirman" ascensos/descensos y se reconoce a los 3 primeros (texto; no hay lógica de cierre real).

### Validaciones
- Guardar premio: exige `title` y `reward` no vacíos (con `trim()`); si faltan, muestra `toast.warning("Completa el título y el premio")` y no guarda.
- Criterio siempre tiene valor (select con opciones fijas; default `general`).

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`, ruta `/equipo/ranking`). Los premios son "configurables por el líder" (comentario en código).

### Dudas / definiciones pendientes
- **Definición pendiente:** el cierre de temporada, la confirmación de ascensos/descensos y la entrega de reconocimientos no tienen lógica de negocio real (solo textos/mock).
- **Suposición:** el podio y ganadores se recalculan en vivo desde `buyers`; no hay "congelado" al cierre.
- **Definición pendiente:** los premios persisten solo en localStorage del navegador (no backend); no se comparten entre usuarios ni con otros dispositivos.
- **Observación:** los criterios `margen` y `rotacion` existen en `REWARD_CRITERIA` pero no tienen premio por defecto en `defaultRewards` (solo `general`, `mejora`, `quiebres`).
- `ChallengeList` y `CompetitionFeed` son componentes de presentación; su lógica interna no se documenta aquí en detalle.

---

## Pantalla 5: Metas / OKRs

### Nombre
Metas del equipo (OKRs).

### Ruta(s)
`/equipo/metas` — Archivo: `src/pages/GoalsPage.tsx`. Protegida por `RoleGate allow="lider"`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Mostrar quién va ganando y quién está en riesgo en el cumplimiento de metas (OKRs), con un score OKR ponderado por comprador y la acción de mayor impacto para subir.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Un leaderboard de OKR por comprador (barra de avance + nivel), filtros por comprador y por estado de meta, y tarjetas por comprador con un medidor circular del score OKR, badges de nivel/estado, reconocimientos, la meta de mayor impacto y el listado de metas activas. Descripción del `PageHeader`: "Quién va ganando, quién está en riesgo y qué hacer para subir. El score OKR es el avance ponderado por el peso de cada meta."

### Información que muestra
- **Encabezado con resumen (`action` del PageHeader):** "Promedio `<teamAvg>`" (promedio de `okrScore` del equipo, redondeado) y "`<riskN>` en riesgo" (nº de metas con status `risk` sobre todas las metas del equipo, rose-600).
- **Leaderboard (`Card`):** 5 compradores ordenados por `okrScore` desc; posición (🥇🥈🥉 top 3 o `i+1`), avatar, nombre, nivel OKR (`okrLevel`) con color (`LEVEL_COLOR`: Elite `#7c3aed` / Oro `#d97706` / En curso `#1f49d6` / Riesgo `#e11d48`), tendencia (`trendText`/`trendColor`), barra de progreso (`okr%`, color por nivel) y valor OKR (xl).
- **Tarjetas por comprador (filtradas por el select de comprador):**
  - Medidor circular (`conic-gradient` `okr*3.6deg`) con el score OKR al centro y color por nivel.
  - Avatar, nombre, posición "#`i+1` de `<N>`", distancia ("a `distance` pts del #`i`") o "lidera el equipo" (para el #1).
  - Badges: nivel OKR (`okrLevel`) y estado general (`okrState`: Crítico ≥2 metas en riesgo / En observación =1 / Sin riesgo =0).
  - Reconocimientos propios (`recogOf`, insignias 🏅): "Mejor OKR" (mayor `okrScore`), "Mayor mejora" (mayor `b.trend`), "Menos quiebres" (menor `stockoutRate`), "Mejor Fill Rate" (mayor `b.fillRate`), "Mejor margen" (mayor `b.margin`). Cada métrica adjudica un único líder.
  - "⬆ Mayor impacto": la meta activa (no cumplida) de mayor `goalImpact(weight, pct)`, con "+N pts" recuperables. **Se calcula sobre TODAS las metas del comprador (`b.goals`), ignorando el filtro de estado.**
  - Metas activas (no cumplidas, tras filtro): nombre, badge de estado (Cumplida green / En curso blue / En riesgo red), barra de avance (`g.pct`, color `goalBar`: verde ≥80, ámbar ≥50, rojo <50), progreso `current/target`, "peso `weight`%" y "· +impacto" si `impact>0`.
  - Contador de metas cumplidas ("✓ N cumplida(s)") si `doneCount>0`.

### Secciones/bloques
1. `PageHeader` "Metas del equipo (OKRs)" con resumen (promedio / en riesgo).
2. Card leaderboard.
3. Fila de filtros ("Ver:").
4. Grilla de tarjetas por comprador (1 / 2 columnas en `xl`).

(No incluye `BuyerDetailDrawer` en esta pantalla — las tarjetas no son clicables.)

### Filtros disponibles
- **Comprador** (`Select`, estado `comprador`, default "all"): "Todos los compradores" + un ítem por comprador (`b.id`). Filtra qué tarjetas se muestran (no afecta el leaderboard).
- **Estado de meta** (`Select`, estado `estado`, default "all"): "Todas las metas" / "Solo en riesgo" (`risk`) / "Solo en curso" (`on_track`) / "Solo cumplidas" (`done`). Filtra las metas visibles dentro de cada tarjeta; si una tarjeta queda sin metas visibles (`visible.length === 0`), no se renderiza (`return null`).

### Acciones del usuario
- Cambiar filtro de comprador.
- Cambiar filtro de estado de meta.
- (No hay drawer ni navegación; pantalla de solo lectura + filtros.)

### Botones y controles
- Dos `Select` (comprador, estado). No hay botones de acción ni edición de metas.

### Tablas / tarjetas / formularios / componentes
- `Card`, `Badge`, `Select`. Medidor circular con CSS `conic-gradient`. Sin tablas ni formularios de escritura.

### Campos de formularios
No aplica (los `Select` son filtros, no un formulario de datos).

### Estados posibles
- **Con datos:** siempre (mock).
- **Filtrado sin resultados en una tarjeta:** la tarjeta se omite. Si ningún comprador tiene metas del estado filtrado, la grilla queda vacía **sin mensaje de "sin resultados"** (no implementado).
- **Estado de meta:** done / on_track / risk.
- **Nivel OKR:** Elite / Oro / En curso / Riesgo.
- **Estado del comprador:** Crítico / En observación / Sin riesgo.
- **Loading / Error:** no aplica.

### Navegación hacia otras pantallas
Ninguna directa desde esta pantalla. (Las alertas `goal_risk` de la pantalla de Alertas navegan HACIA aquí.)

### Flujo funcional completo
1. El líder entra a `/equipo/metas`.
2. Revisa el leaderboard OKR y el promedio/en-riesgo del equipo.
3. Filtra por comprador y/o estado de meta.
4. En cada tarjeta identifica la acción de mayor impacto y las metas activas/en riesgo.

### Reglas de negocio inferibles
- **Score OKR (`okrScore`)** = `round(Σ(pct·weight) / Σweight)`; 0 si no hay pesos.
- **Nivel OKR (`okrLevel`):** Elite ≥85 (violet), Oro ≥70 (amber), En curso ≥50 (blue), Riesgo <50 (red).
- **Estado del comprador (`okrState`):** ≥2 metas en riesgo = Crítico (red); =1 = En observación (amber); =0 = Sin riesgo (green).
- **Impacto de meta (`goalImpact(weight, pct)`)** = `round(weight·(100−pct)/100)` = pts de OKR recuperables si la meta llega a 100%.
- **Orden de metas** dentro de la tarjeta (`GOAL_ORDER`): risk(0) → on_track(1) → done(2), y a igual estado por `goalImpact` desc.
- Cada reconocimiento adjudica un único líder por métrica.
- Colores de barra de meta (`goalBar`): verde ≥80, ámbar ≥50, rojo <50.

### Validaciones
No aplica (solo filtros).

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`, ruta `/equipo/metas`).

### Dudas / definiciones pendientes
- **Definición pendiente:** no hay edición/creación de metas desde esta vista (solo lectura); ¿el líder debería poder ajustar metas/pesos?
- **Definición pendiente:** estado "sin resultados" global cuando el filtro no arroja tarjetas.
- **Suposición:** el "período" de las metas (`from`/`to` en `BuyerGoal`) no se muestra en esta pantalla.
- **Observación:** "Mayor impacto" ignora el filtro de estado (siempre calcula sobre `b.goals`), por lo que puede referir una meta que no está listada bajo el filtro activo.

---

## Pantalla 6: Carga & reasignación

### Nombre
Carga & reasignación.

### Ruta(s)
`/equipo/carga` — Archivo: `src/pages/WorkloadPage.tsx`. Protegida por `RoleGate allow="lider"`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Visualizar la carga laboral (0–100%) de cada comprador y equilibrarla reasignando categorías, proveedores o solicitudes a otro comprador, o dando de baja a un comprador y redistribuyendo su trabajo.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Grilla de tarjetas por comprador (ordenadas por carga desc) con barra de carga, factores que la componen, y controles para reasignar elementos granulares. Dos Modales: "Reasignar `<tipo>`" (con simulación de impacto en el destino) y "Dar de baja y redistribuir" (con criterios de redistribución y simulación de impacto en el equipo). Descripción del `PageHeader`: "La carga (0–100%) pondera categorías, proveedores, SKUs, OC abiertas, compras pendientes y quiebres. Equilibra moviendo categorías o redistribuyendo al dar de baja a alguien."

### Información que muestra
- **Leyenda de niveles (`LEVELS`, 4 puntos de color hardcodeados):** Baja (`#3366f2`), Normal (`#10b981`), Alta (`#f59e0b`), Crítica (`#f43f5e`). **Nota:** la leyenda solo lista 4 niveles, mientras `WORKLOAD_CFG` define 5 (falta "Muy baja"); además estos colores de leyenda son propios de la página y no coinciden 1:1 con las tonos de badge de `WORKLOAD_CFG`.
- **Por tarjeta de comprador (orden `byWorkloadDesc`):**
  - Avatar, nombre, badge "Carga `<nivel>` · `<pct>`%" (nivel/tono de `WORKLOAD_CFG[b.workload]`).
  - Barra de carga (`workloadPct`, color por `workloadBarColor`).
  - 6 factores (grid): Categorías (`b.categories.length`), Proveedores (`b.suppliers`), SKUs (`formatNumber(b.products)`), OC abiertas (`b.openPO`), Compras pend. (`b.pending`), Quiebres (`b.stockouts`).
  - Título "Reasignar a otro comprador" y grupos reasignables (`ReassignGroup`, chips): Categorías (`b.categories`), Proveedores (`suppliersOf(b)` — proveedores no `inactive` cuyas categorías intersectan las del comprador, máx 6), Solicitudes (`requestsOf(b)` — `signals` con `assignedBuyer === b.name` y status ≠ resolved/rejected, máx 6, muestra `productName`).
  - Botón "Dar de baja y redistribuir".
- **Modal Reasignar `<tipo>`:** por cada otro comprador (destino), avatar, nombre, "Carga actual `<nivel>` · `pct`% → **`newPct`%** (+`share` pts)", botón "Asignar aquí" y barra simulada (`workloadBarColor(newPct)`).
- **Modal Dar de baja:** descripción con lo que dejará el comprador ("`N` categorías · `N` proveedores · `N` productos · `N` compras pendientes"); selector de 4 criterios de redistribución (botones-tarjeta); e impacto simulado por comprador ("+`add` pts → `newPct`%" con barra).

### Secciones/bloques
1. `PageHeader` "Carga & reasignación".
2. Card de leyenda de niveles.
3. Grilla de tarjetas por comprador (1 / 2 columnas en `xl`).
4. Modal "Reasignar `<tipo>`".
5. Modal "Dar de baja y redistribuir".

### Filtros disponibles
Ninguno. No hay filtros; orden fijo por carga descendente.

### Acciones del usuario
- Clic en un chip de categoría/proveedor/solicitud → abre Modal "Reasignar `<tipo>`" con ese elemento (`label`), tipo (`kind`) y comprador origen (`from`).
- En el Modal Reasignar: "Asignar aquí" en un destino → `toast.success("<tipo> “<label>” reasignada de <origen> a <destino>")` y cierra el modal. **No modifica datos reales.**
- Clic en "Dar de baja y redistribuir" → abre Modal de baja (modo inicial "carga").
- En el Modal de baja: seleccionar criterio (equitativa / carga / especialidad / manual); "Confirmar redistribución" → `toast.success("Trabajo de <comprador> redistribuido entre el equipo")` y cierre; "Cancelar" → cierra.
- Cerrar modales.

### Botones y controles
- Chips-botón por elemento reasignable (componente interno `ReassignGroup`; el `title` del chip es "Reasignar `<kind>`: `<it>`"; hover coloreado por tipo: categoría brand, proveedor violet, solicitud amber).
- `Button` "Dar de baja y redistribuir" (secondary, sm) por tarjeta.
- Modal Reasignar: `Button size="sm"` "Asignar aquí" por destino.
- Modal de baja: 4 botones-tarjeta de criterio (selección visual con borde brand), `Button` Cancelar (secondary) y "Confirmar redistribución".

### Tablas / tarjetas / formularios / componentes
- `Card`, `Badge`, `Button`, `Modal`. Componente interno `ReassignGroup`.
- Barras de carga (divs). Sin tablas ni inputs de texto; la "selección" de criterio es por botones-tarjeta.

### Campos de formularios
No hay inputs de texto. El Modal de baja usa una selección de **criterio de redistribución** (estado `offboard.mode`):
- **equitativa** — "Distribución equitativa": "Reparte por igual entre los demás compradores."
- **carga** — "Por carga laboral": "Asigna primero a quienes tienen menos carga."
- **especialidad** — "Por especialidad": "Asigna según categorías afines a cada comprador."
- **manual** — "Manual": "Tú decides el destino de cada categoría."

### Estados posibles
- **Con datos:** siempre (mock). Las solicitudes provienen de `SignalsContext` (pueden variar según señales).
- **Grupo reasignable vacío:** `ReassignGroup` no se renderiza si `items.length === 0` (p. ej. comprador sin solicitudes activas o sin proveedores afines).
- **Modal Reasignar abierto/cerrado** (`reassign`: `ReassignState | null`).
- **Modal de baja abierto/cerrado** (`offboard`: `OffboardState | null`) con `mode` seleccionado.
- **Toasts** de éxito al reasignar/redistribuir.
- **Loading / Error / persistencia:** no aplica — las acciones NO mutan los datos mock (solo muestran toast). Los cambios de carga son simulados/visuales dentro del modal.

### Navegación hacia otras pantallas
Ninguna ruta directa desde esta pantalla. (El `BuyerDetailDrawer` de otras pantallas y las alertas de carga navegan HACIA aquí.)

### Flujo funcional completo
1. El líder entra a `/equipo/carga` (o llega desde una alerta de sobrecarga/baja carga/sin responsable, o desde el drawer de un comprador).
2. Revisa la carga y los factores de cada comprador.
3. Para equilibrar: elige un elemento (categoría/proveedor/solicitud) de un comprador sobrecargado → Modal Reasignar → revisa el impacto simulado en cada destino → "Asignar aquí" (toast, cierre).
4. Alternativamente: "Dar de baja y redistribuir" → elige criterio → revisa impacto simulado → "Confirmar redistribución" (toast, cierre).

### Reglas de negocio inferibles
- **Carga (0–100%)** pondera categorías, proveedores, SKUs, OC abiertas, compras pendientes y quiebres (declarado; el valor `workloadPct` es dato del mock, no se recalcula).
- **Peso del impacto por tipo al reasignar (`weight`):** categoría **0.9** > proveedor **0.4** > solicitud **0.15**.
- **Cálculo de "share"** al reasignar: `round((from.workloadPct / max(1, from.categories.length)) · weight)`; nueva carga destino `newPct = min(100, t.workloadPct + share)`. **Quirk:** el denominador es siempre `from.categories.length` incluso para proveedor/solicitud.
- **Redistribución al dar de baja:**
  - modo `carga`: se ordena a los demás por `workloadPct` asc; el primero (menor carga) recibe `round(workloadPct_baja · 0.5)`, el resto recibe `round((workloadPct_baja · 0.5) / (arr.length − 1))`.
  - otros modos (equitativa/especialidad/manual): reparto uniforme `round(workloadPct_baja / arr.length)` sin reordenar.
  - Tope de carga 100% en todos los casos.
- Proveedores reasignables: solo no `inactive` y con categorías en común (máx 6). Solicitudes reasignables: señales asignadas al comprador, no resueltas ni rechazadas (máx 6).

### Validaciones
No hay validación de formularios (no hay inputs). El único "requisito" es seleccionar el destino (Asignar aquí) o confirmar la redistribución.

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`, ruta `/equipo/carga`).

### Dudas / definiciones pendientes
- **Definición pendiente (importante):** las acciones NO persisten ni mutan datos; solo muestran toast. En una implementación real, reasignar/dar de baja debería actualizar carga, asignaciones y el resto de módulos.
- **Definición pendiente:** el modo "manual" no abre un flujo de asignación categoría-por-categoría (solo cambia el criterio de la simulación, que en la práctica se comporta igual que equitativa/especialidad).
- **Suposición:** los pesos (0.9/0.4/0.15) y el reparto 50% son heurísticas de demo, no reglas de negocio confirmadas.
- **Definición pendiente:** qué ocurre con las metas, alertas y OC del comprador dado de baja.
- **Observación:** los modos `especialidad` y `equitativa` producen el mismo cálculo de impacto que se muestra (no hay lógica diferenciada por categorías afines en la simulación).

---

## Ficha del comprador (Drawer compartido)

Componente `BuyerDetailDrawer` (`src/components/business/BuyerDetailDrawer.tsx`). Usado por Panel del equipo, Alertas, Compradores y Ranking (NO por Metas ni por Carga; Carga usa sus propios modales). Recibe `buyer: Buyer | null` y `onClose`; si `buyer` es null no renderiza nada.

- **Encabezado (`Drawer`):** título = nombre; descripción = categorías (`join(" · ")`); footer con `Button` "Equilibrar carga de este comprador" → navega a `/equipo/carga`.
- **Score + chips:** avatar (`TONE_AV`), score 3xl coloreado (`scoreColor`), "Nivel `<liga>`" (`leagueOf`), badge "Carga `<nivel>` · `pct`%", tendencia "`trendText` vs sem. anterior".
- **Asignaciones (4):** Productos (`formatNumber`), Proveedores, Marcas, Metas (`goalComp%`).
- **Indicadores (12, con tonos condicionales good/warn/bad):**
  1. Fill Rate (`formatPercent`, good si ≥90 si no warn).
  2. Nivel de servicio (good si ≥90 si no warn).
  3. Quiebres (bad si >6 si no warn).
  4. Quiebres críticos (bad si >2 si no good).
  5. Sobrestock (sin tono).
  6. Compras pendientes (warn).
  7. OC abiertas (sin tono).
  8. T. reposición ("`replenDays` d", bad si >14).
  9. Rotación ("`rotation`x").
  10. Ventas categorías (`formatCurrencyCompact`, good).
  11. Ahorro negociación (`formatCurrencyCompact`, good).
  12. Crecimiento (`formatPercent` con signo, good si ≥0 si no bad).
- **Desglose del score:** barras por factor (`buyer.breakdown`: `label`/`value`/`weight`), color `goalBar(value)` (verde ≥80, ámbar ≥50, rojo <50), con valor y peso %.
- **Evolución del score (6 semanas):** `Sparkline` SVG (color por defecto `#1f49d6`) a partir de `scoreHist` + los 6 valores debajo.
- **Metas individuales:** `GoalRow` por meta (indicador, avance con barra `goalBar`, badge de estado Cumplida/En curso/En riesgo, `current / target`).

Estados: abierto/cerrado (`buyer | null`). Sin edición: es de solo lectura salvo el botón de navegación a carga.

---

## RESUMEN DEL MÓDULO

### Objetivo
Entregar al **Líder de Compras** una visión transversal y accionable del equipo: monitorear desempeño agregado y por comprador, priorizar alertas, gestionar competencia/gamificación (ranking, ligas, premios, retos), seguir metas (OKRs) y equilibrar la carga laboral mediante reasignación o redistribución.

### Pantallas
1. **Panel del equipo** (`/equipo`) — dashboard con score, excepciones, KPIs, top/bottom y carga.
2. **Alertas del equipo** (`/equipo/alertas`) — alertas priorizadas con acción contextual.
3. **Compradores** (`/equipo/compradores`) — fichas ejecutivas por comprador.
4. **Competencia / Ranking** (`/equipo/ranking`) — gamificación: ranking, ligas, reconocimientos, retos, premios configurables, temporadas.
5. **Metas / OKRs** (`/equipo/metas`) — leaderboard OKR, filtros y tarjetas por comprador.
6. **Carga & reasignación** (`/equipo/carga`) — carga por comprador y acciones de equilibrio.

Todas protegidas por `RoleGate allow="lider"` (rutas `/equipo/*`, `AppRoutes.tsx` líneas 146-193).

### Flujo principal
El líder entra al **Panel del equipo**, revisa las **excepciones** y salta a **Alertas** para el detalle. Desde una alerta actúa: abre la **ficha del comprador** (drawer), o va a **Carga** (sobrecarga/baja carga/sin responsable) o a **Metas** (meta en riesgo). En **Carga** reasigna categorías/proveedores/solicitudes o da de baja y redistribuye. Complementariamente usa **Compradores** para revisar fichas y **Ranking** para gestionar la competencia y los premios.

### Funcionalidades principales
- Score agregado del equipo y por comprador; ligas por score (Bronce→Leyenda).
- Alertas del líder priorizadas por severidad con enrutamiento por tipo.
- Ficha detallada del comprador (12 indicadores, desglose de score, evolución 6 semanas, metas).
- OKRs: score ponderado, niveles, estado de riesgo y acción de mayor impacto.
- Equilibrio de carga: reasignación granular y baja+redistribución con simulación de impacto.
- Gamificación: ranking general, rankings por dimensión, 6 reconocimientos, movimientos de liga, retos, temporadas, feed y premios configurables (persistidos en localStorage).

### Funcionalidades secundarias
- Filtros por comprador/estado en Metas.
- Toasts de confirmación (reasignación, baja, premios).
- Podio y KPIs de temporada en Ranking.
- Historial de temporadas anteriores y novedades del equipo.

### Dependencias con otros módulos
- **Rol / RoleContext:** todo el módulo depende del rol `lider` (RoleGate). El `Topbar` redirige al líder a `/equipo` al cambiar de rol.
- **Módulo Proveedores** (`/proveedores`): destino de la acción de alertas `no_supplier`; los proveedores reasignables se leen de `mockSuppliers`.
- **Módulo Señales / Solicitudes** (`SignalsContext`): las "Solicitudes" reasignables en Carga provienen de las señales de venta asignadas al comprador (relación con `SalesSignalsPage`).
- **Datos mock compartidos:** `mockBuyers` alimenta prácticamente todas las pantallas (incluida "Mi desempeño" del comprador, según comentario del tipo `team.ts`).
- **Constante temporal:** `TODAY_ISO = "2026-06-24"` (`utils/constants.ts`) alimenta `daysToClose` en Ranking.
- **Persistencia local:** premios del Ranking en `localStorage` (`compras:rewards`); el resto de datos son estáticos en memoria.
- **Nota transversal:** las acciones de reasignación/redistribución y las alertas NO mutan estado ni persisten (solo toasts/navegación); es un levantamiento sobre datos mock.

---

## Verificación de cobertura

| Elemento | Estado |
|---|---|
| Pantalla 1 Panel (`/equipo`) — 18 encabezados | ✅ Cubierta, RoleGate documentado |
| Pantalla 2 Alertas (`/equipo/alertas`) | ✅ Cubierta, 6 alertas y enrutamiento por tipo |
| Pantalla 3 Compradores (`/equipo/compradores`) | ✅ Cubierta |
| Pantalla 4 Ranking (`/equipo/ranking`) | ✅ Cubierta, Modal CRUD + localStorage |
| Pantalla 5 Metas (`/equipo/metas`) | ✅ Cubierta, 2 filtros |
| Pantalla 6 Carga (`/equipo/carga`) | ✅ Cubierta, 2 Modales |
| Drawer ficha del comprador (`BuyerDetailDrawer`) | ✅ 12 indicadores + umbrales de tono documentados |
| RoleGate `allow="lider"` por pantalla | ✅ En cada sección "Permisos" + contexto |
| Etiquetas exactas de controles/botones | ✅ "Ver todas (N)", "Equilibrar carga", "+ Agregar premio", "Asignar aquí", "Dar de baja y redistribuir", "Confirmar redistribución", etc. |
| Campos de formulario (Modal premio) | ✅ Criterio/Título/Premio con placeholders y validación |
| Columnas/KPIs/tarjetas | ✅ 8 KPIs Panel, 3 KPIs Ranking, 4 métricas por tarjeta de comprador, 6 factores de carga |
| Navegación con destino exacto | ✅ Rutas por tipo de alerta y por drawer |
| Constantes/umbrales reales | ✅ score/ligas/OKR/carga/pesos de reasignación/`daysToClose` |
| Persistencia vs toast | ✅ Premios→localStorage; reasignación/baja/alertas→solo toast/navegación |
| Estados reales vs inexistentes | ✅ vacío/loading/error marcados "no implementado" |
| Validaciones | ✅ Solo en Modal de premio (título+premio no vacíos) |

### Constantes y hallazgos clave verificados contra código
- **5 compradores** (`andrea`, `maria`, `catalina`, `juan`, `felipe`) y **6 alertas** mock.
- `TODAY_ISO = "2026-06-24"` es fecha fija del mock (no la fecha real del sistema); con `SEASON.to = "2026-06-30"` → "Cierra en **6 días**".
- **Dos sistemas de carga independientes:** badge/etiqueta desde `WORKLOAD_CFG[b.workload]` (categórico, 5 niveles) vs color de barra desde `workloadBarColor(b.workloadPct)` (numérico, umbrales 75/90). La leyenda de la pantalla de Carga solo muestra 4 niveles (omite "Muy baja").
- Pesos de reasignación **0.9 / 0.4 / 0.15** y reparto **50%** en baja por carga; `share` divide siempre por `from.categories.length`.
- Premios persisten en `localStorage["compras:rewards"]`; criterios `margen`/`rotacion` existen pero sin premio por defecto.
- "Mayor impacto" en Metas se calcula sobre `b.goals` completo, ignorando el filtro de estado.
- `RoleGate` NO redirige la URL: muestra `EmptyState` in-situ para roles sin permiso.

### Definiciones pendientes destacadas (transversales)
- Ninguna acción de escritura del módulo (reasignar, dar de baja, resolver/descartar alertas, editar metas) persiste ni muta datos, salvo los **premios** del Ranking (localStorage local, sin backend ni sincronización entre usuarios).
- No hay manejo de estados vacíos / loading / error en ninguna pantalla (datos mock siempre presentes).
- El cierre de temporada, ascensos/descensos y reconocimientos son textos declarativos sin lógica de negocio real.
- Modo "manual" de redistribución y modos `equitativa`/`especialidad` no tienen simulación diferenciada real.
