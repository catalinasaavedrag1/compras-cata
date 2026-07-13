# Módulo: Equipo y Líder

> Levantamiento funcional basado exclusivamente en el código del frontend (React + TypeScript, datos mock). Documento en español. Cuando algo no está definido en el código se marca como **Definición pendiente** o **Suposición**. Todos los datos provienen de arreglos mock; no hay backend real.

## Contexto del módulo

Conjunto de pantallas que dan al **Líder de Compras** una visión transversal (cross-comprador) del equipo: desempeño agregado, alertas priorizadas, fichas de compradores, competencia/ranking gamificado, metas (OKRs) y equilibrio de carga con reasignación.

### Restricción de permisos (RoleGate) — aplica a TODO el módulo

Todas las rutas de este módulo están envueltas por `<RoleGate allow="lider">` en `src/routes/AppRoutes.tsx` (líneas 147-192). El componente `RoleGate` (`src/components/layout/RoleGate.tsx`) obtiene el rol actual con `useRole()`:

- Si `role === "lider"`, renderiza la pantalla (`children`).
- Si el rol es distinto (p. ej. `comprador`), NO muestra la pantalla; en su lugar renderiza un `EmptyState` con:
  - Título: "Sección del Líder de Compras".
  - Descripción: "Esta vista muestra datos de todo el equipo (varios compradores). Tu rol actual es Comprador, que solo accede a su propia cartera."
  - Botón "Volver al inicio" que navega a `/`.

Además, en la navegación (`src/components/layout/navItems.tsx`) los módulos de equipo se agrupan como "Módulos EXTRA solo del Líder de Compras (visión de equipo y cross-comprador)". Al cambiar de rol, el `Topbar` (`src/components/layout/Topbar.tsx`, línea 72) redirige al líder a `/equipo`.

**Roles del sistema:** `comprador` y `lider` (tipo `Role` en `RoleContext`). Estas 6 pantallas son exclusivas del rol **lider**.

### Fuentes de datos mock comunes

- `src/data/mockBuyers.ts` (`buyers`, `getBuyer`): lista de compradores con score, carga, indicadores y metas. Tipo `Buyer` en `src/types/team.ts`.
- `src/data/mockLeaderAlerts.ts` (`leaderAlerts`): alertas del líder. Tipo `LeaderAlert`.
- `src/data/mockSuppliers.ts` (`suppliers`): proveedores (usado en carga).
- `src/data/mockChallenges.ts` (`SEASON`, `PREV_SEASON_NAME`, `challenges`): temporada y retos.
- `src/data/mockRewards.ts` (`defaultRewards`, `REWARD_CRITERIA`, tipo `Reward`): premios configurables.
- `src/data/mockSeasonHistory.ts` (`seasonHistory`): temporadas anteriores.
- `src/data/mockCompetitionFeed.ts` (`competitionFeed`): novedades del equipo.
- Lógica de cálculo: `src/utils/teamScore.ts` (score, ligas, carga, OKR, temporada, badges).
- `SignalsContext` (solicitudes/señales) usado en la pantalla de carga.

### Componentes compartidos relevantes

- `BuyerDetailDrawer` (`src/components/business/BuyerDetailDrawer.tsx`): panel lateral (Drawer) con la ficha completa del comprador. Se abre desde casi todas las pantallas del módulo al hacer clic en un comprador. Ver detalle en la sección "Ficha del comprador (Drawer compartido)" más abajo.
- `PageHeader`, `Card/CardHeader/CardBody`, `KpiCard`, `Badge`, `Button`, `Modal`, `Input`, `Select`, `EmptyState`, `Drawer`, íconos (`IconAlerts`, `IconChevronRight`, `IconArrowRight`, `IconInfo`, `IconSales`).

---

## Pantalla 1: Panel del equipo

### Nombre
Panel del equipo (Team Dashboard).

### Ruta(s)
`/equipo` — Archivo: `src/pages/TeamDashboardPage.tsx`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Dar al líder una vista de una sola pantalla del estado del área de compras "hoy", priorizando primero las excepciones que requieren su atención y luego los indicadores agregados, el mejor/peor desempeño y la carga del equipo.

### Tipo de usuario
Solo rol **lider** (RoleGate).

### Descripción detallada
Página compuesta por: un "hero" con el score promedio del equipo; una tarjeta de excepciones ("Requiere tu atención"); una grilla de KPIs agregados; dos tarjetas de "Mejor desempeño"/"Necesita apoyo"; y una tarjeta de "Carga del equipo" con barras por comprador. Los agregados se calculan con `teamAggregate(buyers)`.

### Información que muestra
- **Hero (score del equipo):**
  - Score promedio del equipo (`a.avgScore`, 0–100) y etiqueta cualitativa (`scoreLabel`: Excelente / Muy bueno / Bueno / Debe mejorar / Crítico).
  - Nº de compradores (`a.n`).
  - Venta del equipo (`formatCurrencyCompact(a.sales)`).
  - Ahorro negociado (`formatCurrencyCompact(a.savings)`).
- **Requiere tu atención (excepciones):** hasta 4 alertas ordenadas por severidad (high, medium, low), con título, comprador (o "Área" si `buyer` es null), acción sugerida y badge de severidad (Alta/Media/Baja). Enlace "Ver todas (N)" donde N = cantidad de alertas `high`.
- **KPIs (8 tarjetas):**
  1. Cumplimiento de metas (`a.goalArea%`), sub "Meta del área: 85%", tono good si ≥85 si no warn.
  2. Fill Rate del área (`a.fillRate%`), sub "Pedidos completos", good si ≥90 si no warn.
  3. Nivel de servicio (`a.sla%`), sub "Cumplimiento SLA", good si ≥90 si no warn.
  4. Quiebres totales (`a.stockouts`), sub "N críticos", tono bad.
  5. Compras pendientes (`a.pending`), sub "N OC abiertas", tono warn.
  6. Tiempo de reposición (`a.replen` días), sub "Promedio del equipo", tono info.
  7. Sobrestock (`a.overstock`), sub "SKUs sobre el máximo", tono neutral.
  8. Productos gestionados (`a.products`), sub "N categorías · N prov.", tono neutral.
- **Mejor desempeño:** top 2 compradores por score descendente; muestra avatar (iniciales), nombre, categorías, score coloreado (`scoreColor`) y tendencia (`trendText`/`trendColor`).
- **Necesita apoyo:** bottom 2 por score (invertidos); subtítulo "N quiebres · carga <nivel>".
- **Carga del equipo:** todos los compradores ordenados por carga descendente (`byWorkloadDesc`), con barra de progreso `workloadPct` coloreada por `workloadBarColor` (verde <75, ámbar 75–89, rojo ≥90) y etiqueta "<nivel> <pct>%".

### Secciones/bloques
1. Encabezado (`PageHeader`): "Panel del equipo" + descripción.
2. Hero score + tarjeta de excepciones (grid 1fr/2fr).
3. Grilla de 8 KPIs (`KpiCard`).
4. Tarjetas "Mejor desempeño" / "Necesita apoyo".
5. Tarjeta "Carga del equipo".
6. `BuyerDetailDrawer` (oculto hasta seleccionar).

### Filtros disponibles
Ninguno. No hay filtros ni búsqueda en esta pantalla.

### Acciones del usuario
- Clic en un comprador de "Mejor desempeño"/"Necesita apoyo" → abre `BuyerDetailDrawer`.
- Clic en una excepción → `openByName`: si la alerta tiene comprador válido, abre su drawer; si no (alerta de "Área"/sin comprador), navega a `/equipo/carga`.
- "Ver todas (N)" → navega a `/equipo/alertas`.
- "Equilibrar carga" (en Carga del equipo) → navega a `/equipo/carga`.
- Cerrar drawer.

### Botones y controles
- Botón enlace "Ver todas (N)".
- Botón enlace "Equilibrar carga" con `IconChevronRight`.
- Filas-botón de compradores y de excepciones.

### Tablas / tarjetas / formularios / componentes
- Tarjetas: hero (div estilizado), `Card` de excepciones, `KpiCard` x8, `Card` mejor/peor, `Card` de carga.
- Componente auxiliar interno `PerfRow` (fila de desempeño).
- `BuyerDetailDrawer`. No hay tablas ni formularios.

### Campos de formularios
No aplica (sin formularios).

### Estados posibles
- **Con datos:** siempre hay datos mock (buyers y leaderAlerts no vacíos), por lo que la pantalla siempre muestra contenido.
- **Vacío / sin resultados:** no implementado (no aplica con datos mock; no hay manejo explícito de lista vacía).
- **Carga (loading):** no aplica (datos síncronos en memoria).
- **Error:** no aplica.
- **Drawer abierto/cerrado:** estado `sel` (Buyer | null).
- Tonos condicionales de KPIs según umbrales (good/warn/bad/info/neutral).

### Navegación hacia otras pantallas
- `/equipo/alertas` (ver todas las alertas).
- `/equipo/carga` (equilibrar carga; también fallback de excepciones de "Área").
- `BuyerDetailDrawer` → botón interno navega a `/equipo/carga`.

### Flujo funcional completo
1. El líder entra a `/equipo`.
2. `teamAggregate` calcula agregados sobre `buyers`.
3. Se ordenan compradores por score (top/bottom) y por carga; se toman las 4 alertas más severas.
4. El líder revisa excepciones → decide actuar (drawer del comprador o ir a carga/alertas).
5. Revisa KPIs y balance de carga; puede saltar a alertas o a reasignación.

### Reglas de negocio inferibles
- Prioridad visual: primero excepciones, luego indicadores (declarado en la descripción).
- Umbrales de KPI: metas 85%, Fill Rate 90%, SLA 90%.
- Orden de severidad: high(0) < medium(1) < low(2).
- Score promedio y demás agregados son promedios/sumas simples del equipo (`teamAggregate`).
- Carga ordenada de crítica a muy baja.

### Validaciones
No hay entradas de usuario; no hay validaciones.

### Permisos / restricciones
Exclusiva del rol **lider** vía `RoleGate allow="lider"`.

### Dudas / definiciones pendientes
- **Definición pendiente:** manejo de estados vacíos (equipo sin compradores, sin alertas).
- **Suposición:** los umbrales (85/90/90) son metas del área fijas; no hay configuración visible para cambiarlos.
- La acción de excepción para alertas sin comprador siempre lleva a carga; **Definición pendiente** si eso es correcto para todos los tipos "de Área".

---

## Pantalla 2: Alertas del equipo

### Nombre
Alertas del equipo.

### Ruta(s)
`/equipo/alertas` — Archivo: `src/pages/TeamAlertsPage.tsx`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Concentrar las alertas que requieren la intervención del líder, explicando para cada una qué pasa, por qué importa y qué hacer, con un botón de acción que enruta a la pantalla adecuada.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Lista vertical de tarjetas de alerta (`leaderAlerts`) ordenadas por severidad. Cada tarjeta muestra severidad, tipo, comprador afectado, título, detalle, un recuadro "Por qué importa" (impacto según tipo) y un botón de acción contextual.

### Información que muestra
- **Resumen (badges con punto):** conteo de alertas por severidad — "N de alta prioridad" (red), "N media" (amber), "N baja" (slate).
- **Por cada alerta:**
  - Barra lateral de color según severidad (rojo/ámbar/gris).
  - Badge "Severidad <Alta/Media/Baja>".
  - Etiqueta de tipo (`TYPE_LABEL`): Desempeño, Sobrecarga, Baja carga, Quiebres, Sin responsable, Meta en riesgo, Proveedor.
  - Comprador afectado (`a.buyer` o "Área").
  - Título (`a.title`) y detalle (`a.detail`).
  - Recuadro ámbar "Por qué importa:" con el impacto (`IMPACT` según tipo).
  - Botón de acción con el texto `a.action` e `IconArrowRight`.

### Tipos de alerta (mock) y su impacto
`perf_drop` (Desempeño), `overload` (Sobrecarga), `underload` (Baja carga), `stockouts` (Quiebres), `no_owner` (Sin responsable), `goal_risk` (Meta en riesgo), `no_supplier` (Proveedor). Cada tipo tiene un texto de impacto fijo en `IMPACT`.

Alertas mock actuales (6): LA-1 perf_drop/high (Felipe Rojas), LA-2 overload/high (Catalina Saavedra), LA-3 stockouts/high (Juan Pérez), LA-4 no_owner/medium (Área, "Decohogar"), LA-5 goal_risk/medium (María González), LA-6 underload/low (Felipe Rojas).

### Secciones/bloques
1. `PageHeader` "Alertas del equipo".
2. Fila de badges-resumen por severidad.
3. Lista de tarjetas de alerta.
4. `BuyerDetailDrawer`.

### Filtros disponibles
Ninguno. No hay filtros ni buscador. Las alertas solo se ordenan por severidad (no configurable).

### Acciones del usuario
- Clic en el botón de acción de una alerta → función `handle(a)`, que enruta según el tipo:
  - `overload` / `underload` / `no_owner` → `/equipo/carga`.
  - `goal_risk` → `/equipo/metas`.
  - `no_supplier` → `/proveedores`.
  - Otro tipo con comprador (`a.buyer`) → abre `BuyerDetailDrawer` del comprador.
  - Sin coincidencia y sin comprador → `/equipo/compradores`.
- Cerrar drawer.

### Botones y controles
- Botón de acción por alerta (`Button size="sm"` con texto dinámico `a.action`).
- Badges de resumen (no interactivos).

### Tablas / tarjetas / formularios / componentes
- `Card` por alerta; `Badge`; `Button`; `BuyerDetailDrawer`. Sin tablas ni formularios.

### Campos de formularios
No aplica.

### Estados posibles
- **Con datos:** lista de 6 alertas mock.
- **Vacío:** no implementado (no aplica con mock; sin manejo de lista vacía).
- **Loading / Error:** no aplica (datos en memoria).
- **Drawer abierto/cerrado.**

### Navegación hacia otras pantallas
- `/equipo/carga`, `/equipo/metas`, `/equipo/compradores`, `/proveedores` (fuera del módulo, hacia módulo de Proveedores).
- `BuyerDetailDrawer` (y su botón interno hacia `/equipo/carga`).

### Flujo funcional completo
1. El líder entra a `/equipo/alertas`.
2. Ve el resumen por severidad y la lista ordenada (high primero).
3. Lee qué pasa, por qué importa y la acción recomendada.
4. Pulsa la acción → se le lleva a la pantalla correspondiente o se abre la ficha del comprador para resolver.

### Reglas de negocio inferibles
- Cada tipo de alerta tiene un destino de acción predefinido (enrutamiento por tipo).
- Las alertas de carga (sobrecarga/baja carga/sin responsable) se resuelven en la pantalla de carga.
- Alertas de meta → metas; de proveedor → proveedores.
- Orden fijo por severidad.

### Validaciones
No aplica (sin entradas).

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`).

### Dudas / definiciones pendientes
- **Definición pendiente:** no existe acción de "descartar", "marcar como resuelta" ni persistencia del estado de una alerta; son de solo lectura + navegación.
- **Definición pendiente:** estado vacío cuando no hay alertas.
- **Suposición:** `no_supplier` lleva a un módulo externo (`/proveedores`); dependencia con ese módulo.

---

## Pantalla 3: Compradores

### Nombre
Compradores.

### Ruta(s)
`/equipo/compradores` — Archivo: `src/pages/BuyersPage.tsx`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Mostrar una ficha ejecutiva (tarjeta) por cada comprador con sus KPIs clave, nivel/liga y carga, permitiendo abrir el detalle completo.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Grilla de tarjetas (1–3 columnas según ancho) con todos los compradores ordenados por score descendente. Cada tarjeta es un botón que abre el `BuyerDetailDrawer`.

### Información que muestra
Por tarjeta de comprador:
- Avatar con iniciales (color por `tone`).
- Nombre y categorías (`b.categories.join(" · ")`).
- Score (grande, coloreado por `scoreColor`) y tendencia (`trendText`/`trendColor`).
- Badge "Nivel <liga>" (`leagueOf(b.score)`: Bronce/Plata/Oro/Elite/Leyenda).
- Badge "Carga <nivel>" (`WORKLOAD_CFG`).
- Mini-grilla de 4 métricas: Fill Rate (%), Quiebres, Pendientes, Alertas.

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
- **Con datos:** grilla de compradores mock.
- **Vacío / Loading / Error:** no aplica / no implementado.
- **Drawer abierto/cerrado.**

### Navegación hacia otras pantallas
- Vía `BuyerDetailDrawer` → botón interno a `/equipo/carga`.

### Flujo funcional completo
1. El líder entra a `/equipo/compradores`.
2. Escanea las fichas ordenadas por score.
3. Abre el detalle de un comprador para revisar KPIs, desglose de score, evolución y metas.

### Reglas de negocio inferibles
- Orden por score descendente (mejor primero).
- La liga se deriva del score (`leagueOf`).

### Validaciones
No aplica.

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`).

### Dudas / definiciones pendientes
- **Definición pendiente:** falta de filtros/búsqueda por categoría, carga o liga (podría ser deseable con muchos compradores).
- **Definición pendiente:** estado vacío.

---

## Pantalla 4: Competencia / Ranking

### Nombre
Competencia del equipo (Ranking).

### Ruta(s)
`/equipo/ranking` — Archivo: `src/pages/RankingPage.tsx`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Capa de gamificación: posicionar a los compradores según el score global (0–100), mostrar la temporada en curso, rankings por dimensión, reconocimientos, movimientos de liga, retos, premios configurables, temporadas anteriores y novedades del equipo.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Pantalla larga con múltiples bloques. Incluye una explicación de la fórmula del score, un banner de temporada con podio, KPIs del equipo, ranking general, rankings destacados, reconocimientos del mes, movimientos de liga, retos de la semana, premios configurables (con Modal CRUD), temporadas anteriores y un feed de novedades. Es la única pantalla del módulo con persistencia local (premios) y con un formulario/Modal.

### Información que muestra
- **Explicación del score (banner info):** fórmula = 30% cumplimiento de venta · 20% margen · 20% reducción de quiebres · 15% rotación · 10% cumplimiento de OC · 5% gestión de sobrestock.
- **Temporada en curso (hero):** nombre (`SEASON.name` = "Temporada Junio 2026"), "Cierra en N días" (`daysToClose(SEASON.to)`), texto explicativo de ascensos/descensos, y podio con los 3 primeros por score (medallas 🥇🥈🥉, primer nombre, pts).
- **KPIs del equipo (3):** Score promedio (`agg.avgScore` pts), Tasa de quiebres (promedio de `stockoutRate`), Margen promedio (promedio de `b.margin`).
- **Ranking general:** todos los compradores ordenados por score desc. Muestra posición (medalla si top 3, si no número), avatar, nombre, badge de liga, tendencia, subtítulo ("Líder del equipo" para el #1 o "A N pts del #<i>"), y score grande coloreado. El #1 tiene fondo destacado.
- **Rankings destacados (`RANKING_DEFS`):** 4 tarjetas con top 3 cada una:
  - Mejor margen bruto (`b.margin`).
  - Menor tasa de quiebres (`stockoutRate`, ascendente).
  - Mayor rotación saludable (`b.rotation`).
  - Mayor mejora vs mes anterior (`recovery` = último − primer valor de `scoreHist`).
- **Reconocimientos del mes (`badgesOf`):** 6 insignias, cada una con el mejor de una dimensión: Mejor margen, Menos quiebres, Mejor rotación, Mayor mejora, Mejor sobrestock, Mejor negociador (ahorro).
- **Movimientos de liga (vs Mayo 2026):** por comprador, liga anterior → liga actual (`seasonStatus` compara `prevSeasonScore` con `score`) y badge Ascenso ▲ / Descenso ▼ / Mantiene =.
- **Retos de la semana (`challenges`):** renderizados por `ChallengeList`. Tipos: `team` (reto de equipo con progreso), `duel` (duelo 1v1 por métrica), `streak` (racha con meta de semanas). 5 retos mock.
- **Premios de la temporada (configurables):** tarjetas de premios (`rewards`, persistidos en localStorage clave `compras:rewards`, default `defaultRewards`). Cada tarjeta: emoji 🎁, título, recompensa, criterio (`critLabel`) y "Va ganando: <comprador>" (`winnerByCriterion`). Botón "Editar" por tarjeta y "+ Agregar premio".
- **Temporadas anteriores (`seasonHistory`):** por temporada: nombre, campeón (avatar + nombre + "Campeón · N pts") y podio (🥇🥈🥉 con primeros nombres).
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
9. Retos de la semana.
10. Premios de la temporada (+ Modal).
11. Temporadas anteriores.
12. Novedades del equipo.
13. `Modal` de premio y `BuyerDetailDrawer`.

### Filtros disponibles
Ninguno. No hay filtros; los ordenamientos son fijos por dimensión.

### Acciones del usuario
- Clic en cualquier fila/tarjeta de comprador (ranking general, rankings destacados, reconocimientos, movimientos de liga, "Va ganando") → abre `BuyerDetailDrawer`.
- "+ Agregar premio" → abre Modal con un premio nuevo vacío (`criterion: "general"`).
- "Editar" en una tarjeta de premio → abre Modal con ese premio.
- En el Modal: cambiar criterio, título, premio; Guardar (valida), Cancelar, Eliminar (si es existente).
- Cerrar drawer/modal.

### Botones y controles
- `Button` "+ Agregar premio" (secondary, sm).
- Botón "Editar" por premio.
- Modal: `Select` (criterio), `Input` (título), `Input` (premio); `Button` Guardar, Cancelar, Eliminar (danger, solo edición).
- Filas-botón de compradores en varios bloques.

### Tablas / tarjetas / formularios / componentes
- KPIs (`KpiCard`), `Card`, `Badge`, `Button`, `Modal`, `Input`, `Select`.
- `ChallengeList`, `CompetitionFeed`, `BuyerDetailDrawer`.
- **Formulario:** dentro del Modal de premio.
- Sin tablas HTML; todo son listas/tarjetas.

### Campos de formularios (Modal de premio)
- **Criterio** (`Select`, requerido implícitamente): opciones `REWARD_CRITERIA` — Campeón general (mayor score), Mayor recuperación del mes, Menor tasa de quiebres, Mejor margen bruto, Mayor rotación saludable.
- **Título** (`Input`, texto): placeholder "Ej: Campeón de la temporada". Obligatorio.
- **Premio / recompensa** (`Input`, texto): placeholder "Ej: Bono $150.000 + día libre". Obligatorio.

### Estados posibles
- **Con datos:** siempre (mock).
- **Modal abierto/cerrado** (`rewardForm` Buyer/Reward | null).
- **Modo Modal:** "Nuevo premio" (id no existente en `rewards`) vs "Editar premio" (id existente → muestra botón Eliminar).
- **Persistencia:** premios en localStorage; sobreviven recarga (no así el resto de datos, que son mock estáticos).
- **Toasts:** advertencia ("Completa el título y el premio"), éxito ("Premio guardado" / "Premio eliminado").
- **Vacío / Loading / Error:** no implementado / no aplica.
- **Drawer abierto/cerrado.**

### Navegación hacia otras pantallas
- No navega a otras rutas directamente (salvo el botón interno del `BuyerDetailDrawer` → `/equipo/carga`).

### Flujo funcional completo
1. El líder entra a `/equipo/ranking`.
2. Revisa la temporada en curso, el podio y los KPIs.
3. Explora el ranking general y los rankings por dimensión; abre fichas de compradores.
4. Revisa reconocimientos, movimientos de liga y retos.
5. Configura premios: agrega/edita/elimina (persisten en localStorage). El ganador se recalcula automáticamente según el criterio.
6. Consulta temporadas anteriores y el feed de novedades.

### Reglas de negocio inferibles
- **Fórmula del score global (declarada):** 30% venta / 20% margen / 20% quiebres / 15% rotación / 10% OC / 5% sobrestock.
- **Ligas por score (`LEAGUES`):** Bronce 0–59, Plata 60–74, Oro 75–84, Elite 85–94, Leyenda 95–100.
- **Movimiento de liga:** compara liga del score actual vs liga del `prevSeasonScore` (ascenso/descenso/mantiene).
- **Ganador de premio:** calculado automáticamente por criterio (`winnerByCriterion`): general=mayor score, mejora=mayor `recovery`, quiebres=menor `stockoutRate`, margen=mayor margen, rotacion=mayor rotación.
- **Reconocimientos del mes:** el mejor de cada dimensión (`badgesOf`), incluyendo sobrestock (menor) y ahorro (mayor).
- **Rankings destacados** usan orden ascendente/descendente según la métrica (quiebres ascendente).
- Al cierre de temporada se "confirman" ascensos/descensos y se reconoce a los 3 primeros (texto; no hay lógica de cierre real).
- El score pondera múltiples dimensiones "para que la comparación sea justa" (no solo venta).

### Validaciones
- Guardar premio: exige `title` y `reward` no vacíos (trim); si faltan, muestra toast de advertencia y no guarda.
- Criterio siempre tiene valor (select con opciones fijas).

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`). Los premios son "configurables por el líder" (comentario en código).

### Dudas / definiciones pendientes
- **Definición pendiente:** el cierre de temporada, la confirmación de ascensos/descensos y la entrega de reconocimientos no tienen lógica de negocio real (solo textos/mock).
- **Suposición:** el podio y ganadores se recalculan en vivo desde `buyers`; no hay "congelado" al cierre.
- **Definición pendiente:** los premios persisten solo en localStorage del navegador (no backend); no se comparten entre usuarios.
- `ChallengeList` y `CompetitionFeed` son componentes de presentación; su lógica interna no se documenta aquí en detalle.

---

## Pantalla 5: Metas / OKRs

### Nombre
Metas del equipo (OKRs).

### Ruta(s)
`/equipo/metas` — Archivo: `src/pages/GoalsPage.tsx`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Mostrar quién va ganando y quién está en riesgo en el cumplimiento de metas (OKRs), con un score OKR ponderado por comprador y la acción de mayor impacto para subir.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Un leaderboard de OKR por comprador (barra de avance + nivel), filtros por comprador y por estado de meta, y tarjetas por comprador con un medidor circular del score OKR, badges de nivel/estado, reconocimientos, la meta de mayor impacto y el listado de metas activas.

### Información que muestra
- **Encabezado con resumen:** "Promedio <teamAvg>" (promedio de `okrScore` del equipo) y "<riskN> en riesgo" (metas con status `risk`).
- **Leaderboard:** compradores ordenados por `okrScore` desc; posición (medalla top 3 o número), avatar, nombre, nivel OKR (`okrLevel`: Elite ≥85 / Oro ≥70 / En curso ≥50 / Riesgo <50) con color, tendencia, barra de progreso (`okr%`) y valor OKR.
- **Tarjetas por comprador (filtradas):**
  - Medidor circular (conic-gradient) con el score OKR y color por nivel.
  - Avatar, nombre, posición "#i de N", distancia al de arriba ("a N pts del #<i>") o "lidera el equipo".
  - Badges: nivel OKR (`okrLevel`) y estado general (`okrState`: Crítico ≥2 metas en riesgo / En observación 1 / Sin riesgo 0).
  - Reconocimientos propios (`recognitions`): Mejor OKR, Mayor mejora (mayor `trend`), Menos quiebres (menor `stockoutRate`), Mejor Fill Rate, Mejor margen.
  - "Mayor impacto": la meta activa (no cumplida) con mayor `goalImpact(weight, pct)` y los pts recuperables (`+N pts`).
  - Metas activas: nombre, badge de estado (Cumplida/En curso/En riesgo), barra de avance (`g.pct`, color por umbral 80/50), progreso `current/target`, "peso W%" y "+impacto" si aplica.
  - Contador de metas cumplidas ("✓ N cumplida(s)").

### Secciones/bloques
1. `PageHeader` "Metas del equipo (OKRs)" con resumen (promedio / en riesgo).
2. Card leaderboard.
3. Fila de filtros ("Ver:").
4. Grilla de tarjetas por comprador.

(No incluye `BuyerDetailDrawer` en esta pantalla.)

### Filtros disponibles
- **Comprador** (`Select`): "Todos los compradores" + un item por comprador. Filtra qué tarjetas se muestran.
- **Estado de meta** (`Select`): "Todas las metas", "Solo en riesgo" (`risk`), "Solo en curso" (`on_track`), "Solo cumplidas" (`done`). Filtra las metas visibles dentro de cada tarjeta; si una tarjeta queda sin metas visibles, no se renderiza.

### Acciones del usuario
- Cambiar filtro de comprador.
- Cambiar filtro de estado de meta.
- (No hay drawer ni navegación; pantalla de solo lectura + filtros.)

### Botones y controles
- Dos `Select` (comprador, estado). No hay botones de acción ni edición de metas.

### Tablas / tarjetas / formularios / componentes
- `Card`, `Badge`, `Select`. Medidor circular con CSS conic-gradient. Sin tablas ni formularios de escritura.

### Campos de formularios
No aplica (los `Select` son filtros, no un formulario de datos).

### Estados posibles
- **Con datos:** siempre (mock).
- **Filtrado sin resultados en una tarjeta:** la tarjeta se omite (`visible.length === 0 → return null`). Si ningún comprador tiene metas del estado filtrado, la grilla quedaría vacía (sin mensaje de "sin resultados" — **no implementado**).
- **Estado de meta:** done / on_track / risk.
- **Nivel OKR:** Elite / Oro / En curso / Riesgo.
- **Estado del comprador:** Crítico / En observación / Sin riesgo.
- **Loading / Error:** no aplica.

### Navegación hacia otras pantallas
Ninguna directa desde esta pantalla. (Las alertas `goal_risk` de la pantalla de alertas navegan HACIA aquí.)

### Flujo funcional completo
1. El líder entra a `/equipo/metas`.
2. Revisa el leaderboard OKR y el promedio/en-riesgo del equipo.
3. Filtra por comprador y/o estado de meta.
4. En cada tarjeta identifica la acción de mayor impacto y las metas activas/en riesgo.

### Reglas de negocio inferibles
- **Score OKR** = avance ponderado por peso de cada meta (`okrScore`): Σ(pct·weight)/Σweight.
- **Nivel OKR:** Elite ≥85, Oro ≥70, En curso ≥50, Riesgo <50.
- **Estado del comprador:** ≥2 metas en riesgo = Crítico; 1 = En observación; 0 = Sin riesgo.
- **Impacto de meta** (`goalImpact`) = pts de OKR recuperables si la meta llega a 100% = round(weight·(100−pct)/100).
- **Orden de metas** dentro de la tarjeta: por estado (risk→on_track→done) y luego por impacto desc (`GOAL_ORDER`).
- Cada reconocimiento tiene un líder distinto por métrica (repartidos).
- Colores de barra de meta: verde ≥80, ámbar ≥50, rojo <50.

### Validaciones
No aplica (solo filtros).

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`).

### Dudas / definiciones pendientes
- **Definición pendiente:** no hay edición/creación de metas desde esta vista (solo lectura); ¿el líder debería poder ajustar metas/pesos?
- **Definición pendiente:** estado "sin resultados" global cuando el filtro no arroja tarjetas.
- **Suposición:** el "período" de las metas (from/to en `BuyerGoal`) no se muestra en esta pantalla.

---

## Pantalla 6: Carga & reasignación

### Nombre
Carga & reasignación.

### Ruta(s)
`/equipo/carga` — Archivo: `src/pages/WorkloadPage.tsx`.

### Módulo
Equipo y Líder.

### Objetivo funcional
Visualizar la carga laboral (0–100%) de cada comprador y equilibrarla reasignando categorías, proveedores o solicitudes a otro comprador, o dando de baja a un comprador y redistribuyendo su trabajo.

### Tipo de usuario
Solo rol **lider**.

### Descripción detallada
Grilla de tarjetas por comprador (ordenadas por carga desc) con barra de carga, factores que la componen, y controles para reasignar elementos granulares. Dos Modales: "Reasignar <tipo>" (con simulación de impacto en el destino) y "Dar de baja y redistribuir" (con criterios de redistribución y simulación de impacto en el equipo).

### Información que muestra
- **Leyenda de niveles:** Baja (azul), Normal (verde), Alta (ámbar), Crítica (rojo).
- **Por tarjeta de comprador:**
  - Avatar, nombre, badge "Carga <nivel> · <pct>%".
  - Barra de carga (`workloadPct`, color por `workloadBarColor`).
  - 6 factores: Categorías (nº), Proveedores (`suppliers`), SKUs (`products`), OC abiertas (`openPO`), Compras pend. (`pending`), Quiebres (`stockouts`).
  - Grupos reasignables (chips): Categorías (`b.categories`), Proveedores (`suppliersOf(b)` — proveedores activos cuyas categorías intersectan las del comprador, máx 6), Solicitudes (`requestsOf(b)` — señales asignadas al comprador no resueltas/rechazadas desde `SignalsContext`, máx 6).
  - Botón "Dar de baja y redistribuir".
- **Modal Reasignar:** por cada otro comprador (destino), muestra carga actual → nueva (`newPct`) y "+share pts", con barra simulada. El impacto depende del tipo (categoría peso 0.9, proveedor 0.4, solicitud 0.15).
- **Modal Dar de baja:** descripción con lo que dejará el comprador (categorías, proveedores, productos, pendientes); selector de criterio de redistribución; e impacto simulado por comprador.

### Secciones/bloques
1. `PageHeader` "Carga & reasignación".
2. Card de leyenda de niveles.
3. Grilla de tarjetas por comprador.
4. Modal "Reasignar <tipo>".
5. Modal "Dar de baja y redistribuir".

### Filtros disponibles
Ninguno. No hay filtros; orden fijo por carga descendente.

### Acciones del usuario
- Clic en un chip de categoría/proveedor/solicitud → abre Modal "Reasignar <tipo>" con ese elemento y comprador origen.
- En el Modal Reasignar: "Asignar aquí" en un destino → muestra toast de éxito ("<tipo> '<label>' reasignada de <origen> a <destino>") y cierra el modal. (No modifica datos reales.)
- Clic en "Dar de baja y redistribuir" → abre Modal de baja (modo inicial "carga").
- En el Modal de baja: seleccionar criterio (equitativa / carga / especialidad / manual); "Confirmar redistribución" → toast de éxito y cierre; "Cancelar" → cierra.
- Cerrar modales.

### Botones y controles
- Chips-botón por elemento reasignable (componente interno `ReassignGroup`).
- `Button` "Dar de baja y redistribuir" (secondary, sm) por tarjeta.
- Modal Reasignar: `Button` "Asignar aquí" por destino.
- Modal de baja: 4 botones de criterio (selección), `Button` Cancelar y Confirmar redistribución.

### Tablas / tarjetas / formularios / componentes
- `Card`, `Badge`, `Button`, `Modal`. Componente interno `ReassignGroup`.
- Barras de carga (divs). Sin tablas ni inputs de texto; la "selección" de criterio es por botones-tarjeta.

### Campos de formularios
No hay inputs de texto. El Modal de baja usa una selección de **criterio de redistribución** (estado `offboard.mode`):
- **equitativa** — "Distribución equitativa": reparte por igual entre los demás.
- **carga** — "Por carga laboral": asigna primero a quienes tienen menos carga.
- **especialidad** — "Por especialidad": según categorías afines.
- **manual** — "Manual": el líder decide cada categoría.

### Estados posibles
- **Con datos:** siempre (mock). Las solicitudes provienen de `SignalsContext` (pueden variar según señales).
- **Grupo reasignable vacío:** `ReassignGroup` no se renderiza si `items.length === 0` (p. ej. comprador sin solicitudes activas).
- **Modal Reasignar abierto/cerrado** (`reassign` | null).
- **Modal de baja abierto/cerrado** (`offboard` | null) con `mode` seleccionado.
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
- **Carga (0–100%)** pondera categorías, proveedores, SKUs, OC abiertas, compras pendientes y quiebres (declarado en la descripción).
- **Peso del impacto por tipo al reasignar:** categoría 0.9 > proveedor 0.4 > solicitud 0.15 (una categoría pesa más que una solicitud).
- **Cálculo de "share"** al reasignar: `round((workloadPct_origen / max(1, nº categorías origen)) · peso)`; nueva carga destino = `min(100, workloadPct_destino + share)`.
- **Redistribución por carga:** el de menor carga recibe ~50% del trabajo del comprador dado de baja; el resto se reparte entre los demás. Para otros modos, reparto uniforme (`workloadPct/arr.length`). Carga tope 100%.
- Proveedores reasignables: solo activos y con categorías en común con el comprador (máx 6).
- Solicitudes reasignables: señales asignadas al comprador, no resueltas ni rechazadas (máx 6).

### Validaciones
No hay validación de formularios (no hay inputs). El único "requisito" es seleccionar el destino (Asignar aquí) o confirmar la redistribución.

### Permisos / restricciones
Exclusiva del rol **lider** (`RoleGate allow="lider"`).

### Dudas / definiciones pendientes
- **Definición pendiente (importante):** las acciones NO persisten ni mutan datos; solo muestran toast. En una implementación real, reasignar/dar de baja debería actualizar la carga, las asignaciones y el resto de módulos.
- **Definición pendiente:** el modo "manual" no abre un flujo de asignación categoría-por-categoría (solo cambia el criterio de la simulación).
- **Suposición:** los pesos (0.9/0.4/0.15) y el reparto 50% son heurísticas de demo, no reglas de negocio confirmadas.
- **Definición pendiente:** qué ocurre con las metas, alertas y OC del comprador dado de baja.

---

## Ficha del comprador (Drawer compartido)

Usado por Panel del equipo, Alertas, Compradores y Ranking (no por Metas ni por Carga como panel; Carga tiene sus propios modales). Componente `BuyerDetailDrawer`.

- **Encabezado:** nombre, categorías; footer con botón "Equilibrar carga de este comprador" → navega a `/equipo/carga`.
- **Score + chips:** avatar, score coloreado, "Nivel <liga>", badge de carga, tendencia "vs sem. anterior".
- **Asignaciones (4):** Productos, Proveedores, Marcas, Metas (%).
- **Indicadores (12):** Fill Rate, Nivel de servicio, Quiebres, Quiebres críticos, Sobrestock, Compras pendientes, OC abiertas, T. reposición, Rotación, Ventas categorías, Ahorro negociación, Crecimiento — con tonos condicionales (good/warn/bad).
- **Desglose del score:** barras por factor (`breakdown`) con valor y peso %.
- **Evolución del score (6 semanas):** `Sparkline` SVG a partir de `scoreHist` + valores.
- **Metas individuales:** `GoalRow` por meta (indicador, avance, estado, current/target).

Estados: abierto/cerrado (`buyer` | null). Sin edición: es de solo lectura salvo el botón de navegación a carga.

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

Todas protegidas por `RoleGate allow="lider"`.

### Flujo principal
El líder entra al **Panel del equipo**, revisa las **excepciones** y salta a **Alertas** para el detalle. Desde una alerta actúa: abre la **ficha del comprador** (drawer), o va a **Carga** (sobrecarga/baja carga/sin responsable) o a **Metas** (meta en riesgo). En **Carga** reasigna categorías/proveedores/solicitudes o da de baja y redistribuye. Complementariamente usa **Compradores** para revisar fichas y **Ranking** para gestionar la competencia y los premios.

### Funcionalidades principales
- Score agregado del equipo y por comprador; ligas por score (Bronce→Leyenda).
- Alertas del líder priorizadas por severidad con enrutamiento por tipo.
- Ficha detallada del comprador (KPIs, desglose de score, evolución, metas).
- OKRs: score ponderado, niveles, estado de riesgo y acción de mayor impacto.
- Equilibrio de carga: reasignación granular y baja+redistribución con simulación de impacto.
- Gamificación: ranking general, rankings por dimensión, reconocimientos, movimientos de liga, retos, temporadas, feed y premios configurables (persistidos en localStorage).

### Funcionalidades secundarias
- Filtros por comprador/estado en Metas.
- Toasts de confirmación (reasignación, baja, premios).
- Podio y KPIs de temporada en Ranking.
- Historial de temporadas anteriores y novedades del equipo.

### Dependencias con otros módulos
- **Rol / RoleContext:** todo el módulo depende del rol `lider` (RoleGate). El `Topbar` redirige al líder a `/equipo`.
- **Módulo Proveedores** (`/proveedores`): destino de la acción de alertas `no_supplier`; los proveedores reasignables se leen de `mockSuppliers`.
- **Módulo Señales / Solicitudes** (`SignalsContext`): las "Solicitudes" reasignables en Carga provienen de las señales de venta asignadas al comprador (relación con el módulo de Señales/`SalesSignalsPage`).
- **Datos mock compartidos:** `mockBuyers` alimenta prácticamente todas las pantallas (incluida "Mi desempeño" del comprador, según comentarios del tipo `team.ts`).
- **Persistencia local:** premios del Ranking en `localStorage` (`compras:rewards`); el resto de datos son estáticos en memoria.
- **Nota transversal:** las acciones de reasignación/redistribución y las alertas NO mutan estado ni persisten (solo toasts/navegación); es un levantamiento sobre datos mock.
```
