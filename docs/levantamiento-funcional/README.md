# Levantamiento funcional — Plataforma de Compras (compras-cata)

Documentación funcional **exhaustiva** del sistema, realizada **únicamente a partir del frontend existente** (React + TypeScript, en español). El producto es una plataforma de gestión de compras para un retailer chileno de mejoramiento del hogar (ferretería / construcción).

> **Alcance y método.** Este levantamiento describe *qué hace* cada pantalla observando el código del frontend: componentes, textos, estados, handlers, filtros, navegación y formularios. **No** incluye backend, APIs ni base de datos. Los datos son *mock* deterministas cargados en memoria; por eso varios estados (cargando, error de red) no existen en la práctica y se marcan como tales. Donde el comportamiento no puede deducirse con certeza, se marca explícitamente como **Suposición** o **Definición pendiente**.
>
> **Profundidad y verificación.** Cada documento de módulo documenta cada pantalla con 18 campos (objetivo, usuario, secciones, filtros, acciones, controles, formularios y sus campos, estados, navegación, flujo, reglas de negocio, validaciones, permisos y dudas) usando **etiquetas, columnas, KPIs y umbrales/constantes reales** del código, y cierra con una sección **"Verificación de cobertura"** que contrasta 1:1 lo documentado contra el código y lista los hallazgos y definiciones pendientes.

## Cómo está organizada la documentación

Un archivo Markdown por **módulo** (el mismo agrupamiento que usa la navegación superior de la app), más un informe general del sistema.

| # | Módulo | Archivo | Pantallas principales |
|---|--------|---------|-----------------------|
| — | **Informe general del sistema** | [`00-informe-general.md`](./00-informe-general.md) | Inventarios, flujos, pendientes, suposiciones y preguntas para backend |
| 1 | **Inicio y Mi Cartera** | [`01-inicio-y-mi-cartera.md`](./01-inicio-y-mi-cartera.md) | Inicio, Resumen de cartera, Productos clave, Marcas, Proveedores (cartera), Oportunidades, Categorías, Detalle de categoría, Productos, Detalle de producto (SKU 360) |
| 2 | **Comprar** | [`02-comprar.md`](./02-comprar.md) | Decisiones/Reposición, Planificar temporada, Cotizaciones (RFQ), Borradores OC, Aprobaciones, Seguimiento, Plan de retiro, Recepciones |
| 3 | **Inventario** | [`03-inventario.md`](./03-inventario.md) | Cobertura & sobrestock, Venta no capturada, Recepciones, Documentos |
| 4 | **Rentabilidad** | [`04-rentabilidad.md`](./04-rentabilidad.md) | Ranking & liquidación, Ventas, Margen por canal, Estacionalidad y canales, Variaciones de costo, Presupuesto |
| 5 | **Surtido** | [`05-surtido.md`](./05-surtido.md) | Gestión de surtido, Duplicidad, Campañas, Productos a potenciar (anticipación) |
| 6 | **Proveedores** | [`06-proveedores.md`](./06-proveedores.md) | Performance de proveedores, Ficha de proveedor (negociación, temporada, términos, maestro) |
| 7 | **Mi plan** | [`07-mi-plan.md`](./07-mi-plan.md) | Metas / desempeño, Alertas, Señales de ventas, Aprendizaje de compra, Resultados/Reportes |
| 8 | **Equipo y Líder** | [`08-equipo-y-lider.md`](./08-equipo-y-lider.md) | Panel del equipo, Alertas del equipo, Compradores, Competencia/Ranking, Metas, Carga & reasignación *(solo rol Líder)* |
| 9 | **Sistema, Acceso y Estructura** | [`09-sistema-acceso-y-estructura.md`](./09-sistema-acceso-y-estructura.md) | Login, Configuración/Reglas, y mecanismos transversales (navegación, roles, borrador OC global, notificaciones, densidad, guardas de ruta) |

## Roles de usuario

- **Comprador** — perfil operativo por defecto. Ve los módulos 1–7.
- **Líder de compras** — ve todo lo del comprador **más** los módulos 8 (Equipo y Líder). Las rutas `/equipo/*` están protegidas por un *guard* de rol (`RoleGate allow="lider"`).

El cambio de rol se hace desde la cabecera (conmutador Comprador / Líder) y se persiste en `localStorage`.

## Mapa de rutas → pantalla

Ver el inventario completo de rutas (incluyendo alias y redirecciones) en el [informe general](./00-informe-general.md#inventario-de-pantallas-y-rutas).

---

*Generado como levantamiento funcional de solo-lectura. No modifica el comportamiento de la aplicación.*
