# Módulo: Sistema, Acceso y Estructura transversal

> Levantamiento funcional realizado **solo desde el frontend** (React + TypeScript, en español). La plataforma **compras-cata** es un workspace de compras ("Buyer Workspace") para un retailer chileno de mejoramiento del hogar. **No hay backend obligatorio**: los datos son *mock* locales y la sesión, el rol, el borrador de OC y las preferencias se persisten en `localStorage`. Existe una capa opcional de conexión a API (`DataContext`), pero en la práctica corre en "Modo demo".
>
> Convenciones de este documento: **"Suposición"** = inferencia razonable no confirmada por el código; **"Definición pendiente"** = decisión funcional que el negocio debe precisar; **"Dato mock"** = comportamiento condicionado por datos simulados sin backend.

Este módulo describe el **shell de la aplicación** (lo que envuelve a todas las pantallas), el **acceso** (login y guardas de ruta) y los **mecanismos globales** (navegación, roles, borrador de OC, notificaciones, densidad y persistencia). Todos los demás módulos funcionales dependen de esta estructura.

---

## Pantalla: Login

### Nombre
Login / Inicio de sesión (marca visible: **"Buyer Workspace"**, con lema "Tu cartera, prioridades y decisiones").

### Ruta(s)
- `/login` (renderizada a través del componente `LoginGate` en `AppRoutes.tsx`).
- Archivo: `src/pages/LoginPage.tsx`.

### Módulo
Sistema, Acceso y Estructura transversal (acceso/autenticación).

### Objetivo funcional
Permitir que el usuario inicie sesión para acceder al workspace. En la práctica es un **login simulado (demo)**: no valida credenciales reales contra ningún backend; su objetivo es la experiencia (formulario con correo, contraseña con "ojito" para mostrar/ocultar, y punto de entrada a la app).

### Tipo de usuario
Cualquier usuario no autenticado. No distingue rol en esta pantalla: el rol (comprador/líder) se resuelve **después** dentro de la app (por `RoleContext`, con valor inicial "comprador").

### Descripción detallada
Pantalla centrada, fondo `slate-50`, sin layout de app (no muestra sidebar, header ni navegación). Contiene:
- Un bloque de **marca**: isotipo (cuadro con un trazo tipo gráfico), título "Buyer Workspace" y subtítulo "Tu cartera, prioridades y decisiones".
- Un **formulario** en tarjeta blanca con dos campos (correo y contraseña) y un botón "Iniciar sesión".
- Un texto aclaratorio al pie: *"Demo sin backend: cualquier correo y contraseña inician sesión."* — declaración explícita del carácter mock del acceso.

### Información que muestra
- Marca y lema de la plataforma.
- Etiquetas de campos ("Correo", "Contraseña").
- Placeholder de correo: `tucorreo@empresa.cl`.
- Placeholder de contraseña: `••••••••`.
- Mensaje de error de validación (solo si aplica).
- Nota de demo sin backend.

### Secciones/bloques
1. **Encabezado de marca** (logo + título + lema).
2. **Formulario de acceso** (tarjeta con campos + botón + nota).

### Filtros
No aplica (pantalla sin listados ni filtros).

### Acciones
- **Iniciar sesión** (submit del formulario): valida que haya correo y contraseña; si es válido, llama a `login(email)` y navega a la ruta de origen (`from`) o a `/`.
- **Mostrar/Ocultar contraseña**: alterna el `type` del input entre `password` y `text` (botón con icono ojo/ojo tachado, con `aria-pressed`).

### Botones/controles
- Botón "Iniciar sesión" (`type=submit`, ancho completo).
- Botón-icono para mostrar/ocultar contraseña.
- Inputs de correo y contraseña con iconos decorativos (sobre / candado).

### Tablas/tarjetas/formularios/componentes
- Un `<form>` en tarjeta (`rounded-2xl`, sombra).
- Componente `Button` (UI compartido).
- Iconos `IconMail`, `IconLock`, `IconEye`, `IconEyeOff`.
- **No** usa el layout de app ni componentes de navegación.

### Campos de formularios
| Campo | Tipo | `autoComplete` | Placeholder | Obligatorio | Notas |
|---|---|---|---|---|---|
| Correo | `email` | `email` | `tucorreo@empresa.cl` | Sí (validación de "no vacío") | El valor se guarda en la sesión (`AuthContext.email`) y luego se muestra en el menú de cuenta. |
| Contraseña | `password`/`text` | `current-password` | `••••••••` | Sí (validación de "no vacío") | Nunca se persiste ni se valida contra credenciales reales (**dato mock**). |

### Estados posibles
- **Formulario vacío / inicial**: sin error.
- **Error de validación**: si `email` o `password` están vacíos al enviar, muestra "Ingresa tu correo y contraseña." (texto en rosa). El error se limpia al volver a escribir en cualquiera de los dos campos.
- **Contraseña visible / oculta**: dos sub-estados del input.
- **Sesión iniciada**: tras `login()`, se navega fuera del login.
- **Estado que NO existe (por diseño demo / dato mock)**: no hay estado de "credenciales inválidas", "cargando/autenticando", "bloqueo por intentos", "recuperar contraseña", ni "registro". Cualquier correo + contraseña no vacíos inician sesión de inmediato.

### Navegación hacia otras pantallas
- Al iniciar sesión: navega a `location.state.from` (un **string** con la ruta —`location.pathname`— que el usuario intentaba abrir antes de ser redirigido por `RequireAuth`) o, si no existe, a `/` (Inicio). Se usa `replace: true` para no dejar el login en el historial.
- Si el usuario ya está autenticado y visita `/login`, `LoginGate` lo redirige a `/` sin mostrar el formulario.
- **No** hay enlaces a "Recordarme", "Olvidé mi contraseña", "Registrarme" ni "Ayuda/soporte": la pantalla es solo el formulario + nota de demo (**dato mock**).

### Identificadores y accesibilidad (detalle técnico)
- Inputs con `id` `login-email` y `login-password`, cada uno con su `<label htmlFor>` asociado. El botón "ojito" es `type=button` con `aria-label`/`title` dinámico ("Mostrar contraseña" / "Ocultar contraseña") y `aria-pressed={showPassword}`.
- Iconos de correo/candado son decorativos (`pointer-events-none`). El botón "Iniciar sesión" es el componente compartido `Button` con `type=submit` y ancho completo.

### Flujo funcional
1. Usuario sin sesión abre cualquier ruta protegida → `RequireAuth` lo redirige a `/login` recordando el origen.
2. Ingresa correo y contraseña → presiona "Iniciar sesión".
3. Validación mínima (no vacíos) → `login(email)` marca `authenticated=true` y guarda el email en `localStorage` (`compras:auth`).
4. Redirección a la ruta de origen o a Inicio.

### Reglas de negocio inferibles
- Basta con correo y contraseña **no vacíos** para acceder (regla demo).
- El correo introducido se convierte en la identidad "de contacto" mostrada en el menú de cuenta (aunque el nombre visible proviene del comprador/persona seleccionados, no del correo).

### Validaciones necesarias
- **Implementadas**: no vacío en correo y contraseña; `type=email` da validación de formato del navegador de forma nativa (no bloquea el submit propio, que solo comprueba `trim()`).
- **Definición pendiente / faltantes para producción**: validación real de credenciales, formato/dominio de correo corporativo, contraseña segura, manejo de errores del servidor, bloqueo por intentos, recuperación de contraseña, expiración de sesión.

### Permisos/restricciones
- Pública (única ruta accesible sin sesión). Todo el resto de la app requiere sesión.

### Dudas/definiciones pendientes
- ¿Cómo se autenticará realmente (SSO corporativo, usuario/clave, etc.)? — **Definición pendiente**.
- ¿El rol (comprador/líder) vendrá del proveedor de identidad o seguirá siendo un conmutador manual en la UI? — **Definición pendiente** (hoy es manual, ver sección transversal de roles).

---

## Pantalla: Configuración / Reglas de compra

### Nombre
**Reglas de compra** (título de página: "Reglas de compra"). La ruta se llama `/reglas` y el componente `SettingsPage`, pero funcionalmente es la pantalla de **parametrización de la compra sugerida**, no una configuración general de la app.

### Ruta(s)
- `/reglas`.
- Archivo: `src/pages/SettingsPage.tsx`.

### Módulo
Encuadrada aquí como pantalla del shell/sistema por ser "Configuración/Reglas". Funcionalmente pertenece al dominio de **reposición/compra** (define cómo se calcula la compra sugerida). No aparece en `navItems.tsx` como sub-pestaña de ningún módulo — **Suposición**: se accede por enlace directo/deep-link (p. ej. desde otras pantallas o vía URL), ya que no hay entrada de menú visible a `/reglas`.

### Objetivo funcional
Definir y ajustar las **reglas que gobiernan la compra sugerida** por distintos ámbitos (global, categoría, proveedor, marca, canal): días objetivo de inventario, lead time, stock mínimo/máximo y margen mínimo. Incluye un **simulador** para ver el impacto en la compra sugerida del mes antes de aplicar cambios, y detección de reglas "a revisar".

### Tipo de usuario
No está protegida por `RoleGate`, por lo que la ven **comprador y líder**. **Suposición**: en un entorno real la edición de reglas base/globales podría restringirse al líder o a gerencia (los datos mock muestran reglas modificadas por "Gerencia comercial" y por compradores). **Definición pendiente**: quién puede editar qué ámbito.

### Descripción detallada
La pantalla organiza la parametrización en varias capas:
- **KPIs resumen** (4 tarjetas).
- **Simulador de días objetivo de inventario** con proyección de compra por categoría.
- **Panel de alertas de configuración** ("Qué reglas revisar").
- **Filtro por tipo de ámbito** (pestañas).
- **Tabla de reglas** (2/3 del ancho en escritorio) + **panel lateral** de ayuda ("Cómo se calcula") y "Excepciones y reglas especiales".
- **Drawer de edición** de una regla, con validaciones, advertencias, impacto estimado y confirmación de descarte de cambios.

### Información que muestra
- **KPIs**: "Con regla propia" (nº de reglas no globales, con nota "+ 1 regla global"), "Requieren revisión" (nº de reglas con alerta; es un filtro clicable), "Días objetivo prom." y "Lead time prom." (promedios sobre todas las reglas).
- **Simulador**: días objetivo actual (global), botones de simulación (valor actual, 45, 60, 90 días), compra sugerida proyectada total y delta vs. actual, e impacto por categoría (hasta 6 filas: base → proyectado + delta).
- **Alertas**: lista de reglas con estado distinto de "Correcta", con motivo textual.
- **Tabla de reglas**: por cada regla: ámbito (con badge de tipo y comparación "+N d vs global"), días objetivo, stock mín/máx, margen mínimo, lead time, impacto (nº de SKU y monto de compra sugerida afectado), fecha de última modificación y estado de salud.
- **Panel "Cómo se calcula"**: fórmula `Cantidad = venta diaria × (lead time + días objetivo) − stock disponible` y notas de acotamiento.
- **Excepciones**: tarjetas con reglas especiales (productos nuevos, de temporada, baja venta, sobrestock, proveedores atrasados), todas marcadas "Activa".

### Secciones/bloques
1. `PageHeader` ("Reglas de compra" + descripción).
2. Grid de 4 `KpiCard`.
3. Card "Simular días objetivo de inventario".
4. Card "Qué reglas revisar" (solo si hay alertas).
5. `Tabs` de filtro por ámbito.
6. Grid de 2 columnas: `DataTable` de reglas + columna de ayuda ("Cómo se calcula", "Excepciones y reglas especiales").
7. `RuleEditDrawer` (edición) + `ConfirmModal` (descartar cambios).

### Filtros
- **Pestañas por tipo de ámbito** (`scopeFilter`): Todas, Categoría, Proveedor, Marca, Canal, Global — cada una con su conteo.
- **Solo con alerta** (`onlyAlerts`): se activa/desactiva desde el KPI "Requieren revisión" (estado `active`); muestra solo reglas cuyo estado de salud no es "Correcta".

### Acciones
- **Simular días objetivo**: elegir 45 / 60 / 90 / valor actual y ver la proyección (no persiste; es solo simulación).
- **Filtrar por ámbito** (pestañas) y **filtrar por alerta** (KPI).
- **Editar regla**: abre el drawer (por botón "Editar", clic en fila, clic en tarjeta de alerta, o card móvil "Editar regla").
- **Guardar cambios** de una regla (dentro del drawer).
- **Restaurar valores** (vuelve el borrador a la semilla original de esa regla).
- **Ver productos afectados** (enlace a `/productos` filtrado por categoría/proveedor/marca según ámbito; global/canal → `/productos` sin filtro).
- **Descartar cambios** (confirmación al cerrar con cambios sin guardar).

### Botones/controles
- 4 `KpiCard` (uno de ellos, "Requieren revisión", actúa como toggle de filtro).
- Botonera de simulación (segmented control con opciones de días).
- `Tabs` de ámbito.
- Botón "Editar" por fila / "Editar regla" en card móvil.
- En el drawer: "Cancelar", "Guardar cambios" / "Sin cambios" (deshabilitado si hay errores o no hay cambios), "Restaurar valores", enlace "Ver productos afectados".
- `ConfirmModal`: "Descartar cambios" / "Seguir editando".

### Tablas/tarjetas/formularios/componentes
- `DataTable` con columnas: Ámbito, Días obj., Stock mín/máx, Margen mín., Lead time, Impacto, Modificada, Estado, acción Editar. Tiene versión `mobileCard` con layout adaptado.
- `KpiCard`, `Card`/`CardHeader`/`CardBody`, `Badge`, `Tabs`, `Drawer`, `ConfirmModal`, `Input`, `Button`.
- Enlaces a detalle de categoría (`categoryPath`) y proveedor (`supplierPath`) desde el nombre del ámbito.

### Campos de formularios (drawer de edición)
| Campo | Tipo | Mín. | Validación / advertencia |
|---|---|---|---|
| Días objetivo | number | 0 | Error si ≤ 0. Advertencia si ≥ 55 (sobrestock) o entre 1 y 20 (quiebre). |
| Lead time (días) | number | 0 | Advertencia si ≥ 15 (comprar con más anticipación). |
| Stock mínimo | number | 0 | — |
| Stock máximo | number | 0 | Error si `maxStock > 0` y `maxStock < minStock`. |
| Margen mínimo (%) | number | 0 | Error si < 0 o > 80. |

El drawer también muestra un bloque **"Impacto estimado"**: SKU afectados, "Cambio en compra sugerida" (delta % de días objetivo vs. valor original) y "Riesgo" (Más capital/sobrestock si delta > 15%, Posible quiebre si < −15%, Bajo en otro caso).

### Estado de salud de las reglas (clasificación calculada)
`healthOf()` deriva el estado de cada regla:
- **Correcta** (`ok`): parámetros dentro de rango.
- **Incoherente** (`incoherent`): stock máximo menor que el mínimo (con máximo > 0).
- **Riesgo sobrestock** (`overstock_risk`): días objetivo ≥ 55.
- **Riesgo de quiebre** (`stockout_risk`): días objetivo entre 1 y 20.
- **Lead time alto** (`high_lead`): lead time ≥ 15.

### Estados posibles (de la pantalla)
- **Con/sin alertas**: la card "Qué reglas revisar" solo aparece si hay reglas con estado ≠ Correcta.
- **Filtro activo por alerta** vs. inactivo.
- **Tabla vacía**: mensaje "No hay reglas con alerta." (se da al combinar filtro por ámbito y filtro por alerta sin coincidencias).
- **Drawer abierto/cerrado**; **con cambios (dirty)/sin cambios**; **con errores de validación** (botón guardar deshabilitado); **con advertencias** (no bloquean guardado).
- **Confirmación de descarte** abierta/cerrada.
- **Estado que NO persiste (dato mock)**: al guardar, la regla se actualiza **solo en memoria** (`useState` local con `seedRules`), fijando `updatedAt: "2026-06-24"` y `updatedBy: "Catalina Saavedra"` de forma **hardcodeada**. No se escribe en `localStorage` ni backend: al recargar se pierden los cambios. La simulación tampoco se guarda.

### Navegación hacia otras pantallas
- Nombre del ámbito (categoría/proveedor) → detalle de categoría (`/categorias/:id`) o proveedor (`/proveedores/:id`).
- "Ver productos afectados" → `/productos?cat=...` / `?prov=...` / `?marca=...` según ámbito (global y canal → `/productos`).

### Flujo funcional
1. El usuario revisa KPIs y el panel de alertas para priorizar qué reglas ajustar.
2. Simula distintos días objetivo y observa el impacto en la compra sugerida del mes.
3. Filtra por ámbito o por "requieren revisión".
4. Abre una regla, edita parámetros, ve validaciones/advertencias e impacto estimado.
5. Guarda (feedback vía toast "Regla de {ámbito} actualizada") o descarta cambios.

### Reglas de negocio inferibles
- **Precedencia de reglas**: proveedor › marca › categoría › global (la más específica gana; declarado en la tabla y en `resolveRuleForProduct`).
- La compra sugerida escala con la cobertura (`lead time + días objetivo`); subir días objetivo aumenta la compra del mes.
- Fórmula base: `Cantidad = venta diaria × (lead time + días objetivo) − stock disponible`, acotada por stock mín/máx y ajustada por margen, temporada, sobrestock, baja rotación y proveedor atrasado.
- Existe **una única regla global** ("Regla base") y el resto son reglas propias por ámbito.
- Reglas especiales activas: productos nuevos (compra inicial conservadora), temporada (compra en pre-temporada; fuera → "No comprar"), baja venta (rotación < 1/año → no comprar/evaluar descontinuar), sobrestock (sugerencia = 0 + alerta), proveedores atrasados (cumplimiento < 70% → buscar alternativo).
- El presupuesto de compra mensual de referencia (`monthlyPurchaseBudget = 28.000.000`) existe en los datos, aunque esta pantalla solo lo menciona indirectamente ("Revisa el presupuesto antes de aplicar").

### Validaciones necesarias
- **Implementadas** (ver tabla de campos): coherencia stock máx/mín, días objetivo > 0, margen 0–80%, más advertencias no bloqueantes.
- **Faltantes / Definición pendiente**: persistencia real de cambios; control de quién puede editar reglas globales; validación de rangos por categoría; historial/auditoría de cambios (hoy `updatedBy` es fijo).

### Permisos/restricciones
- Sin restricción por rol en el código (comprador y líder pueden entrar y editar). **Definición pendiente**: restringir edición según rol/ámbito.

### Dudas/definiciones pendientes
- ¿Por qué `/reglas` no tiene entrada en la navegación? ¿Es intencional (acceso solo por deep-link) o falta agregarla? — **Definición pendiente / Suposición**.
- ¿La edición debe persistir por usuario o ser global del área? — **Definición pendiente**.
- El `updatedBy`/`updatedAt` fijos y la ausencia de persistencia son claramente **comportamiento mock**.

---

## Estructura y componentes transversales

Esta sección documenta los mecanismos globales del shell (no son pantallas). El árbol de la app está definido en `src/routes/AppRoutes.tsx`, que envuelve todo en una pila de *providers* (contextos) y monta el `AppLayout` para las rutas autenticadas.

### 1. Layout general (`AppLayout.tsx`)
Estructura visual de toda pantalla autenticada:
- **Sidebar** (menú lateral de escritorio, fijo a la izquierda, colapsable).
- **MobileNav** (menú completo a pantalla en móvil) + **MobileBottomNav** (barra inferior con accesos al alcance del pulgar).
- **AppHeader** (barra superior con acciones globales y sub-pestañas del módulo activo).
- **Contenido** (`<Outlet/>` con las páginas, ancho máx. 1600px).
- **ScrollToHash** (hace scroll a anclas `#seccion` al navegar; sin ancla vuelve arriba).
- **Toaster** (contenedor de toasts).
- **Enlace de accesibilidad** "Saltar al contenido principal".

### 2. Navegación por módulos y sub-pestañas (`navItems.tsx`, `AppHeader.tsx`, `Sidebar.tsx`)
La navegación es de **dos niveles**:
- **Nivel 1 — Módulos**: iconos en el sidebar (escritorio). Módulos del comprador: **Inicio, Mi cartera, Comprar, Inventario, Rentabilidad, Surtido, Proveedores, Mi plan**. El líder ve además: **Líder, Equipo** (`liderExtraModules`).
- **Nivel 2 — Sub-pestañas** (`children` de cada módulo): se muestran como "pills" en la barra secundaria del `AppHeader` (solo si el módulo activo tiene más de un hijo). Cada ítem tiene `hint` (tooltip), puede llevar `badge` dinámico y puede marcarse `secondary` (vistas "extra", visibles según contexto o desde el panel del sidebar).
- El **módulo activo** se resuelve por coincidencia de ruta más larga (`activeModuleFor`). Muchas rutas son alias que caen en la misma página (ver `AppRoutes.tsx`), y varias rutas antiguas hacen `Navigate` (redirección) a las nuevas (p. ej. `/mi-panel`→`/`, `/catalogo-optimizado`→`/surtido-redundante`).
- **Sidebar colapsable**: modo colapsado (solo iconos, con tooltip flotante al pasar el mouse) y panel expandido (72 de ancho) con buscador de vistas, "Vistas principales", "Vistas extra" y bloque "Trabajo pendiente" (Alertas, Aprobaciones, Borrador OC con sus conteos). Estado persistido en `localStorage` (`compras:sidebar-panel-open`). **Atajo `[`** abre/cierra el panel; **`Escape`** lo cierra.
- **Navegación móvil**: `MobileBottomNav` fija (Inicio, Cartera, Comprar, Inventario, y "Más" que abre `MobileNav`). `MobileNav` muestra el módulo actual con sus vistas, un desplegable "Ver más vistas", y una grilla "Cambiar módulo".

### 3. Buscador global (`Topbar.tsx` = `TopbarActions`)
- Existe un **buscador global** en la barra superior (visible desde breakpoint `xl`, ancho `w-64`/`2xl:w-80`). Placeholder: **"Buscar SKU, producto, proveedor, categoría u OC..."**; `aria-label` "Buscar en la plataforma".
- Busca en **productos** (SKU + nombre + marca), **proveedores** (nombre + RUT), **categorías** (nombre) y **órdenes de compra** (número + proveedor), con resultados instantáneos agrupados en el orden Productos → Proveedores → Categorías → Órdenes de compra. Límites: máx. **5 productos** y **3** de cada otro tipo.
- **Umbral**: solo busca con **≥ 2 caracteres** (`trim().toLowerCase()`); por debajo no muestra panel. Si no hay coincidencias muestra "Sin resultados para “{término}”.".
- Subtítulos de cada resultado: producto → `marca · categoría · disp. {stock}`; proveedor → `RUT · categorías`; categoría → `Categoría · {n} SKU · {buyer}`; orden → `{proveedor} · espera {fecha}`.
- Rutas al elegir: producto → `/productos/{sku}`; proveedor → `/proveedores/{id}`; categoría → `/categorias/{id}`; **orden → `/comprar/seguimiento`** (no a un detalle de OC). Al **enviar** (Enter) sin clic: si hay un primer resultado navega a él, si no y hay texto va a `/productos?q=...`.
- **Atajo global**: `⌘K` / `Ctrl+K` o la tecla `/` enfocan y seleccionan el buscador desde cualquier vista (el atajo `/` se ignora si el foco está en un `input`/`textarea`/`select`/editable). Se muestra un `kbd` "⌘K" cuando el campo está vacío.
- Los datos provienen de `useCollection(...)` (backend si está hidratado, si no el mock) — ver `DataContext`.
- El **Sidebar** tiene además su propio buscador **de vistas/módulos** (distinto del global de entidades): también con umbral ≥ 2 caracteres, hasta **12** resultados deduplicados por ruta (`item.to`), buscando en `label + hint + to` de módulo e ítem; al enviar (Enter) navega al primer resultado. El buscador móvil (`MobileNav`) es más simple: envía siempre a `/productos?q=...`.

### 4. Cambio de rol Comprador / Líder (`RoleContext.tsx`, `Topbar.tsx`, `RoleGate.tsx`)
- Conmutador manual en la barra superior (segmented control "Comprador" / "Líder"), visible desde `lg`. Al cambiar a líder navega a `/equipo`; a comprador, a `/`.
- El rol se guarda en `localStorage` (`compras:role`, inicial "comprador") y define **qué módulos** se ven (`modulesFor`) y **qué páginas** son accesibles.
- **Personas fijas (mock)**: comprador = "Catalina Saavedra" (CS), líder = "Tania Reyes" (TR). El avatar y el color cambian según rol (marca vs. violeta).
- **`RoleGate`**: envuelve las vistas exclusivas del líder (`/equipo`, `/equipo/alertas`, `/equipo/compradores`, `/equipo/ranking`, `/equipo/metas`, `/equipo/carga`). Si el rol actual no coincide, muestra un `EmptyState` "Sección del Líder de Compras" con botón "Volver al inicio" (no redirige automáticamente; bloquea el contenido).
- **Comprador actual (`BuyerContext`)**: en rol comprador, la barra (bloque visible desde `2xl`, junto a la fecha de hoy `formatDate(TODAY_ISO)`) permite elegir entre los **compradores** disponibles mediante un `<select>` nativo ("Cambiar de comprador"). La lista `buyers` se deriva del campo `buyer` de las categorías mock, deduplicada y ordenada con `localeCompare(...,"es")`; inicial "Catalina Saavedra", persistido en `compras:buyer`. Define qué categorías/productos son "suyos" (`myCategories` = categorías cuyo `buyer` coincide). En rol líder se muestra la persona líder (`persona.name`) en texto, sin selector.
- **Menú de cuenta (avatar)**: botón circular con las **iniciales** (comprador → iniciales del comprador vía `initials(buyer)`, fondo marca; líder → `persona.initials` "TR", fondo violeta). Abre un dropdown (`role=menu`) que muestra el **nombre** (comprador seleccionado o persona líder) y, debajo, el **correo de la sesión** (`AuthContext.email`) o, si está vacío, el texto de rol ("Comprador" / "Líder de Compras"). Única acción: **"Cerrar sesión"** (`logout()` + navega a `/login`). Se cierra por clic-fuera o `Escape`.
- **Suposición**: el cambio de rol y de comprador es una herramienta de demo; en producción vendría de la identidad del usuario. **Definición pendiente**.

#### Alcance "Mi cartera / Todas" (`ScopeToggle.tsx` / `useCategoryScope`)
Aunque no vive en la barra superior, es un **mecanismo transversal** consumido por varias vistas de surtido (Productos, Categorías, Surtido, Campañas): un segmentado **"Mi cartera · {n} cat." / "Todas"** que acota la vista al alcance del comprador. La preferencia se **comparte entre vistas** vía `localStorage` (`compras:scope`); su valor inicial depende del rol (**líder → "all"**, comprador → "mine"), pero cualquiera puede alternarlo. `inScope(categoría)` decide si un registro entra en el alcance actual (sin categoría → queda fuera cuando el filtro está activo).

### 5. Centro de notificaciones (`NotificationCenter.tsx`, `NotificationContext.tsx`)
- Icono de campana en la barra superior con **badge de no leídas** (rojo). Dropdown en escritorio; pantalla completa (vía `portal`) en móvil.
- Las notificaciones **se derivan de datos**, no se crean manualmente: se construyen desde **alertas activas** (no resueltas/ignoradas), **señales de ventas** (no resueltas/rechazadas) y **órdenes de compra atrasadas**. Se ordenan por fecha (más recientes primero).
- Cada notificación tiene tono (info/warning/danger según severidad/prioridad) y **ruta contextual**: al hacer clic marca como leída y navega a lo relacionado (detalle de producto, `/senales-ventas`, `/ordenes-compra` o `/alertas`).
- Acciones: "Marcar todas leídas". El estado de "leídas" se persiste en `localStorage` (`compras:notif-read`, lista de IDs). **Dato mock**: no hay notificaciones push ni tiempo real; se recalculan desde los mocks en cada render.

Adicionalmente, la barra superior muestra un **indicador de origen de datos** (`BackendStatus`): "API conectada" / "Conectando…" / "Modo demo" según `DataContext`.

### 6. Densidad de UI: Cómodo / Compacto (`DensityContext.tsx`, `Topbar.tsx`)
- Botón en la barra (desde `xl`) que alterna entre **Cómodo** (por defecto) y **Compacto**. En compacto se aprietan paddings y tipografía de los componentes compartidos (Card, KpiCard, PageHeader) para mostrar más información sin scroll.
- Estado persistido en `localStorage` (`compras:density`, inicial "comodo"). Helper `dc(compact, comodo, compacto)` para elegir clases.

### 7. Borrador de OC global / "carrito" (`OcDraftContext.tsx`, `Topbar.tsx`)
- Contexto global que actúa como **carrito de orden de compra**: permite "Agregar a OC" desde reposición/productos y armar la OC en la página de órdenes.
- Estado (líneas + cabecera) persistido en `localStorage` (`compras:oc-draft` y `compras:oc-draft-meta`).
- Cada **línea** (`OcDraftItem`): SKU, nombre, proveedor, cantidad, costo unitario y descuento % opcional. Calcula subtotal, descuento y total (`lineNet`).
- **Cabecera** (`OcDraftMeta`): bodega destino ("Centro de Distribución" por defecto), condición de pago ("30 días fecha factura"), fecha esperada y observaciones.
- API del contexto: `addItem` (no duplica SKU), `updateItem`, `updateQuantity` (mín. 0), `removeItem`, `clear`, `hasItem`, `setMeta`, más totales y `count`.
- En la barra superior, botón **"Borrador OC"** con badge de nº de ítems que navega a `/comprar/borradores`. También aparece en "Trabajo pendiente" del sidebar.

### 8. Guardas de ruta / autenticación (`AppRoutes.tsx`)
- **`RequireAuth`**: para todas las rutas autenticadas. Si `authenticated` es falso, redirige a `/login` guardando la ruta de origen en `state.from`. Si hay sesión, monta `AppLayout` (con `<Outlet/>` bajo `Suspense` y `PageSkeleton` como fallback por *lazy loading* de páginas).
- **`LoginGate`**: para `/login`. Si ya hay sesión, redirige a `/`; si no, muestra `LoginPage`.
- **`RoleGate`** (nivel de vista, no de ruta): bloquea el contenido de vistas de líder para el comprador (ver punto 4).
- **Ruta comodín** `*` → `Navigate` a `/` (rutas desconocidas caen en Inicio).
- **Carga diferida**: casi todas las páginas se cargan con `lazy()` en chunks separados; el login **no** es lazy (carga inmediata).

### 9. Contextos globales (pila de providers)
Orden de anidamiento en `AppRoutes.tsx` (de fuera hacia dentro): `AuthProvider` › `ToastProvider` › `DensityProvider` › `DataProvider` › `RoleProvider` › `BuyerProvider` › `NotificationProvider` › `OcDraftProvider` › `PurchaseFlowProvider` › `SignalsProvider`.

| Contexto | Qué maneja | Impacto funcional | Persistencia (`localStorage`) |
|---|---|---|---|
| **AuthContext** | Sesión: `authenticated`, `email`, `login()`, `logout()`. | Acceso a la app. Login mock (no valida credenciales). | `compras:auth` |
| **RoleContext** | Rol activo (comprador/líder) y persona asociada. | Define menús y vistas accesibles. | `compras:role` |
| **BuyerContext** | Comprador seleccionado y sus categorías. | Filtra qué es "mío" (cartera). Lista derivada de categorías mock. | `compras:buyer` |
| **OcDraftContext** | Borrador de OC (líneas + cabecera). | Carrito global de compra; badge en barra. | `compras:oc-draft`, `compras:oc-draft-meta` |
| **NotificationContext** | Notificaciones derivadas de alertas/señales/OC atrasadas; leídas. | Centro de notificaciones y badge. | `compras:notif-read` |
| **DensityContext** | Modo Cómodo/Compacto. | Densidad de la UI. | `compras:density` |
| **DataContext** | Origen de datos: backend (si `VITE_API_URL`) o mock. | Hidrata colecciones vía `useCollection`; si falla, cae a mock. | — (cache en memoria) |
| **PurchaseFlowContext** | Aprobaciones y decisiones de compra (semilla + creadas). | Cierra ciclo sugerir→aprobar→comprar→medir; conteo de aprobaciones pendientes (badge). | `compras:approvals-created`, `compras:decisions-created`, `compras:approvals` |
| **SignalsContext** | Señales de ventas (semilla + creadas + parches, mensajes, timeline). | Fuente única de señales para página, dashboard y notificaciones. | `compras:signals` |
| **ToastContext** | Toasts efímeros (feedback de acciones). | Confirmaciones ("Regla actualizada", "Agregado a OC", etc.). | — (solo en memoria) |

Los conteos de badges de navegación (`useNavBadges`) se derivan de: alertas críticas (`high`, no resueltas), aprobaciones pendientes, señales nuevas y alertas del equipo de severidad alta.

### 10. Persistencia en `localStorage` (`useLocalStorage.ts`)
- Hook genérico que sincroniza estado con `localStorage` (lee al iniciar con `JSON.parse`; escribe en cada cambio con `JSON.stringify`; ignora errores de cuota/modo privado en `try/catch`). **No** hay serialización de fechas ni migración de versiones de esquema.
- **Todas** las claves usan el prefijo `compras:`. Enumeración completa encontrada en el código (no solo las del shell):

**A. Claves del shell / transversales** (contextos y layout descritos en este módulo):

| Clave | Origen | Contenido |
|---|---|---|
| `compras:auth` | `AuthContext` | `{ authenticated, email }` de la sesión. |
| `compras:role` | `RoleContext` | Rol activo ("comprador"/"lider"). |
| `compras:buyer` | `BuyerContext` | Nombre del comprador seleccionado. |
| `compras:scope` | `ScopeToggle` (`useCategoryScope`) | Alcance "mine"/"all" compartido entre vistas de surtido. |
| `compras:oc-draft` | `OcDraftContext` | Líneas del borrador de OC. |
| `compras:oc-draft-meta` | `OcDraftContext` | Cabecera del borrador (bodega, pago, fecha, notas). |
| `compras:notif-read` | `NotificationContext` | IDs de notificaciones marcadas como leídas. |
| `compras:density` | `DensityContext` | Densidad "comodo"/"compacto". |
| `compras:sidebar-panel-open` | `Sidebar` | Panel expandido abierto/cerrado. |
| `compras:approvals-created` | `PurchaseFlowContext` | Aprobaciones creadas en runtime. |
| `compras:decisions-created` | `PurchaseFlowContext` | Decisiones de compra creadas en runtime. |
| `compras:approvals` | `PurchaseFlowContext` | Estado por aprobación (pendiente/aprobada/rechazada). |
| `compras:signals` | `SignalsContext` | Señales creadas + parches + mensajes + eventos. |

**B. Claves de otros módulos** (fuera del alcance de este documento, pero **usan el mismo hook y prefijo** y por tanto también persisten; se listan para cobertura total):

| Clave | Origen | Contenido |
|---|---|---|
| `compras:po-created` | `PurchaseOrdersPage` (leída por `BudgetPage`) | Órdenes de compra creadas. |
| `compras:po-status` | `PurchaseOrdersPage` | Estado por OC. |
| `compras:rec-overrides` | `ReplenishmentPage` | Ajustes manuales a recomendaciones. |
| `compras:rec-ignored` | `ReplenishmentPage` | IDs de recomendaciones ignoradas. |
| `compras:alert-status` | `AlertsPage` | Estado por alerta (resuelta/ignorada). |
| `compras:rfq` / `compras:rfq-status` | `RfqPage` | Cotizaciones (RFQ) creadas y su estado. |
| `compras:price-lists` | `PriceIncreasesPage` | Listas de precio / alzas. |
| `compras:campaign-plans` | `CampaignsPage` | Planes de campaña. |
| `compras:campaigns` | `CampaignOpportunitiesPage`, `CatalogRedundancy` | Campañas creadas. |
| `compras:rewards` | `RankingPage` (leída por `MyPerformancePage`) | Reconocimientos/premios. |

- **Implicancia funcional**: sesión, rol, comprador, alcance, borrador de OC, notificaciones leídas, densidad, estado del menú y la mayoría de las acciones de otros módulos **sobreviven a recargas** en el mismo navegador. No hay sincronización entre dispositivos ni servidor (**dato mock / sin backend**).
- **Excepción importante**: los cambios de **reglas** (`SettingsPage`) **no** usan este hook (usan `useState` local con `seedRules`), por lo que **no persisten**: al recargar se pierden. El `updatedAt` ("2026-06-24") y `updatedBy` ("Catalina Saavedra") quedan **hardcodeados** al guardar (**dato mock**).

### Suposiciones y definiciones pendientes de la sección transversal
- **Login mock**: no valida credenciales reales; cualquier correo/contraseña no vacíos inician sesión (declarado explícitamente en la UI y en `AuthContext`). — **Definición pendiente**: mecanismo real de autenticación.
- **Rol y comprador manuales**: hoy se conmutan desde la UI y se guardan en `localStorage`; en producción deberían derivar de la identidad. — **Definición pendiente**.
- **Backend opcional**: `DataContext` soporta una API (`VITE_API_URL`), pero el estado normal es "Modo demo" con mocks. — La documentación asume operación mock.
- **`/reglas` sin entrada de menú**: no figura en `navItems`. — **Suposición**: acceso por deep-link; **Definición pendiente** si debe exponerse.
- **Permisos finos**: `SettingsPage` no restringe edición por rol; solo las vistas de equipo usan `RoleGate`. — **Definición pendiente** sobre qué puede editar cada rol.

---

## Resumen del módulo

### Objetivo
Proveer el **shell y los mecanismos globales** que sostienen toda la aplicación: acceso (login + guardas de ruta), navegación de dos niveles (módulos + sub-pestañas), gestión de rol/comprador, borrador de OC global, notificaciones, densidad de UI y persistencia local. También aloja la pantalla de **Reglas de compra**, que parametriza el cálculo de la compra sugerida.

### Pantallas / piezas que lo componen
- **Pantallas**: Login (`/login`) y Reglas de compra (`/reglas`).
- **Layout**: `AppLayout`, `AppHeader`, `Topbar` (acciones), `Sidebar`, `MobileNav`, `MobileBottomNav`, `NotificationCenter`, `RoleGate`, `Brand`, `ScrollToHash`, `Toaster`, `BackendStatus`, `navItems`, `useNavBadges`.
- **Contextos**: Auth, Role, Buyer, OcDraft, Notification, Density, Data, PurchaseFlow, Signals, Toast.
- **Guardas/rutas**: `RequireAuth`, `LoginGate`, `RoleGate` y el árbol de `AppRoutes.tsx`.
- **Persistencia**: `useLocalStorage` (claves `compras:*`).

### Flujo principal (login → app)
1. Usuario sin sesión abre una ruta protegida → `RequireAuth` redirige a `/login` recordando el origen.
2. Ingresa correo + contraseña (no vacíos) → `login()` marca sesión y la persiste.
3. Redirección a la ruta de origen o a Inicio (`/`), montando `AppLayout`.
4. Dentro de la app: navega por módulos/sub-pestañas, alterna rol comprador/líder, usa el buscador global (`⌘K`/`/`), gestiona el borrador de OC, revisa notificaciones y ajusta densidad; todo su estado clave persiste en `localStorage`.
5. "Cerrar sesión" (menú de cuenta) limpia la sesión y vuelve a `/login`.

### Funcionalidades principales
- Autenticación (mock) y protección de rutas.
- Navegación por módulos + sub-pestañas, responsive (sidebar colapsable en escritorio, barra inferior + menú completo en móvil).
- Cambio de rol Comprador/Líder con control de acceso (`RoleGate`) a vistas de equipo.
- Buscador global de entidades con atajos de teclado.
- Centro de notificaciones derivado de alertas, señales y OC atrasadas.
- Borrador de OC global (carrito) persistente.
- Parametrización de reglas de compra con simulador e impacto (Reglas de compra).

### Funcionalidades secundarias
- Densidad Cómodo/Compacto.
- Buscador de vistas dentro del sidebar; bloque "Trabajo pendiente".
- Toasts de feedback.
- Indicador de origen de datos (API/demo).
- Selector de comprador (en rol comprador).
- Redirecciones de rutas legadas a las nuevas; scroll a anclas; enlace de accesibilidad; carga diferida de páginas.

### Dependencias con otros módulos
**Todos los módulos dependen de este shell**: se renderizan dentro de `AppLayout` (bajo `RequireAuth`) y consumen sus contextos —rol/comprador (qué datos ver), borrador de OC (agregar a compra), notificaciones y badges (alertas, aprobaciones, señales), densidad y datos (`useCollection`)—. En sentido inverso, el shell **lee** datos de los demás dominios para alimentar notificaciones, badges y el buscador (productos, proveedores, categorías, órdenes, alertas, señales, aprobaciones). La pantalla de Reglas de compra alimenta funcionalmente al módulo de **reposición/compra** (define la compra sugerida) y enlaza a Productos, Categorías y Proveedores.

---

## Verificación de cobertura

Contraste 1:1 de lo documentado contra el **código real** leído (pantallas `LoginPage`, `SettingsPage`; layout completo `src/components/layout/*`; rutas `AppRoutes.tsx`; contextos `src/context/*`; `useLocalStorage.ts`; `ScopeToggle.tsx`).

### Login (`LoginPage.tsx`) — controles con etiqueta exacta
- **Campos**: "Correo" (`id=login-email`, `type=email`, `autoComplete=email`, placeholder `tucorreo@empresa.cl`) y "Contraseña" (`id=login-password`, `type=password|text`, `autoComplete=current-password`, placeholder `••••••••`). ✔ documentados.
- **Botones**: "Iniciar sesión" (submit) y botón-ojito "Mostrar/Ocultar contraseña" (`aria-pressed`). ✔
- **Mensaje de error**: "Ingresa tu correo y contraseña." (validación de no-vacíos con `trim()`). ✔
- **Nota**: "Demo sin backend: cualquier correo y contraseña inician sesión." ✔
- **Confirmado como inexistente (mock)**: sin validación de credenciales, sin estados de carga/error de servidor, sin "recordarme", "olvidé mi contraseña", "registro" ni bloqueo por intentos. `login(email)` solo marca `authenticated=true` y guarda el email. — **Suposición/Definición pendiente**: autenticación real.

### Reglas de compra (`SettingsPage.tsx`) — controles con etiqueta exacta
- **KPIs**: "Con regla propia" (desc. "+ 1 regla global"), "Requieren revisión" (toggle `onlyAlerts`, desc. "Filtrar"), "Días objetivo prom.", "Lead time prom.". ✔
- **Simulador** "Simular días objetivo de inventario": botones deduplicados/ordenados de `{actual, 45, 60, 90}` (el actual se rotula "{d} d · actual"), "Compra sugerida proyectada", delta "vs actual", bloque "Impacto por categoría" (hasta 6 filas). ✔
- **Alertas** "Qué reglas revisar" (solo si hay reglas con salud ≠ Correcta). ✔
- **Tabs** de ámbito: "Todas", "Categoría", "Proveedor", "Marca", "Canal", "Global" con conteos. ✔
- **Tabla** "Reglas" (desc. "Precedencia: proveedor › marca › categoría › global"), columnas: Ámbito, "Días obj.", "Stock mín/máx", "Margen mín.", "Lead time", "Impacto", "Modificada", "Estado", botón "Editar" (card móvil "Editar regla"). ✔
- **Ayuda**: "Cómo se calcula" (fórmula) y "Excepciones y reglas especiales" (badges "Activa"). ✔
- **Drawer** "Editar regla · {ámbito}": campos "Días objetivo", "Lead time (días)", "Stock mínimo", "Stock máximo", "Margen mínimo (%)"; bloque "Impacto estimado" ("SKU afectados", "Cambio en compra sugerida", "Riesgo"); enlaces "Ver productos afectados" y "Restaurar valores"; footer "Cancelar" + "Guardar cambios"/"Sin cambios". ✔
- **ConfirmModal** "Descartar cambios" / "Seguir editando". ✔
- **Toast** al guardar: "Regla de {ámbito} actualizada". ✔
- **Confirmado mock**: `setRules` en memoria; `updatedAt`/`updatedBy` hardcodeados; sin persistencia ni control por rol. — **Definición pendiente**.

### Estructura transversal — inventario de piezas verificadas
- **Layout** (`AppLayout`): Sidebar + MobileNav + MobileBottomNav + AppHeader + `<Outlet/>` + ScrollToHash + Toaster + enlace "Saltar al contenido principal". ✔
- **Navegación 2 niveles** (`navItems.tsx`): módulos comprador (Inicio, Mi cartera, Comprar, Inventario, Rentabilidad, Surtido, Proveedores, Mi plan) + extra líder (Líder, Equipo); sub-pestañas con `hint`, `badge`, `secondary`; `activeModuleFor` por coincidencia más larga. ✔
- **Buscador global** (`Topbar`): ≥ 2 caracteres, 5+3+3+3, atajos `⌘K`/`Ctrl+K`/`/`, orden navega OC → `/comprar/seguimiento`. ✔ (ampliado)
- **Buscador de vistas** (`Sidebar`): ≤ 12 resultados dedup por `to`. ✔ (ampliado)
- **Conmutador de rol** (`Topbar`/`RoleContext`): "Comprador"/"Líder" desde `lg`; navega a `/equipo` o `/`. ✔
- **Selector de comprador + fecha + menú de cuenta** (`Topbar`): `<select>` desde `2xl`, avatar con iniciales, dropdown con nombre + email/rol, "Cerrar sesión". ✔ (ampliado: menú de cuenta)
- **Centro de notificaciones** (`NotificationCenter`/`NotificationContext`): badge rojo, dropdown/pantalla completa, derivadas de alertas + señales + OC atrasadas, "Marcar todas leídas", empty "No tienes notificaciones. Todo en orden.". ✔
- **Badges dinámicos** (`useNavBadges`): `alertas` (high no resueltas, rojo), `aprobaciones` (pendientes, ámbar), `senales` (status "new", azul), `equipoAlertas` (leaderAlerts high, rojo). ✔
- **Densidad** (`DensityContext`): "Cómodo"/"Compacto" desde `xl`, helper `dc()`. ✔
- **Borrador de OC** (`OcDraftContext`): líneas + cabecera, `addItem/updateItem/updateQuantity/removeItem/clear/hasItem/setMeta`, totales, badge "Borrador OC". ✔
- **Alcance Mi cartera/Todas** (`ScopeToggle`/`useCategoryScope`, `compras:scope`). ✔ (agregado, faltaba)
- **Guardas** (`AppRoutes`): `RequireAuth`, `LoginGate`, `RoleGate`; comodín `*`→`/`; `lazy` + `Suspense`/`PageSkeleton` (login no-lazy). ✔
- **Pila de providers**: Auth › Toast › Density › Data › Role › Buyer › Notification › OcDraft › PurchaseFlow › Signals. ✔ (verificada 1:1)
- **`BackendStatus`**: "API conectada" / "Conectando…" / "Modo demo" (desde `md`). ✔

### Qué se amplió respecto de la versión previa
1. **Menú de cuenta** (avatar, dropdown, email/rol fallback, "Cerrar sesión") — antes solo mencionado en el flujo.
2. **Buscador global y de vistas**: umbral ≥ 2 caracteres, límites por tipo, rutas exactas (OC → seguimiento), mensajes vacíos, tope de 12 en sidebar.
3. **`ScopeToggle` / `compras:scope`**: mecanismo transversal de alcance no documentado antes.
4. **Enumeración COMPLETA de `localStorage`**: además de las 13 claves del shell (incluida `compras:scope`), se listan 10 claves de otros módulos (`po-created`, `po-status`, `rec-overrides`, `rec-ignored`, `alert-status`, `rfq`, `rfq-status`, `price-lists`, `campaign-plans`, `campaigns`, `rewards`) que usan el mismo hook.
5. Detalles técnicos de Login (ids, aria) y precisión de que `from` es un string (`location.pathname`).

### Dudas / definiciones pendientes (consolidado)
- **Autenticación real** (SSO/usuario-clave) y de dónde vendrá el **rol** (hoy manual). — Definición pendiente.
- **`/reglas` sin entrada de menú** (`navItems`): acceso solo por URL/deep-link. — Suposición / Definición pendiente si debe exponerse.
- **Persistencia y permisos de Reglas**: no persisten y no hay control por rol. — Definición pendiente.
- **Selector de comprador y alcance**: hoy son herramientas de demo; en producción derivarían de la identidad y de asignaciones reales. — Definición pendiente.
