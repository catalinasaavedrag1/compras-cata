# 01 · Rutas, vistas, componentes funcionales, modales, formularios, tablas, filtros, acciones y estados

Guardas globales: `RequireAuth` (exige sesión) envuelve todo; `LoginGate` para `/login`.
**Solo las rutas `/equipo/*` tienen `RoleGate allow="lider"`.** El resto es accesible a
comprador y líder; el "gating" restante es **intra-página** (scoping de datos por rol/`buyer`
y habilitación de botones). Preferencia de alcance en `compras:scope` (`ScopeToggle`:
default `mine` para comprador, `all` para líder — "mi cartera" = `category.buyer === buyer`).

## Tabla maestra de rutas (52)

| Ruta | Vista | Params/Query/Deep-link | Guard | Notas |
|---|---|---|---|---|
| `/login` | LoginPage | `state.from` (retorno) | LoginGate | auth falsa (cualquier credencial) |
| `/` | MyPanelPage (Inicio) | — | auth | bandeja diaria + agenda |
| `/mi-cartera[/productos-clave\|marcas\|proveedores\|oportunidades]` | MyPanelPage (Cartera) | foco por segmento de path | auth | dual con Inicio |
| `/mi-desempeno` | MyPerformancePage | — | auth | comprador |
| `/comprar/decisiones` · `/comprar/reposicion` · `/reposicion` | ReplenishmentPage | `foco,q,cat,prov,estado,prioridad` (URL) | auth | núcleo de la decisión |
| `/comprar/borradores` · `/comprar/ordenes` · `/comprar/seguimiento` · `/ordenes-compra` | PurchaseOrdersPage | `?oc=OC-XXXX` (abre detalle); tab por path | auth | scoping por rol |
| `/comprar/aprobaciones` · `/aprobaciones` | ApprovalsPage | filtro local `pendiente` (no URL) | auth | aprobar = solo líder |
| `/alertas` | AlertsPage | filtros locales (tab/tipo/severidad/responsable) — **no URL** | auth | bandeja de alertas (overlay `alert-status`) |
| `/senales-ventas` | SalesSignalsPage | filtros locales (tab/prioridad/tipo/canal/tienda…) — **no URL** | auth | bandeja de señales de terreno |
| `/mi-panel` | → redirige a `/` | — | auth | ruta heredada |
| `/comprar/plan-retiro` | PlanRetiroPage | — | auth | lee borrador OC |
| `/comprar/recepciones` · `/recepciones` | ReceptionsPage | `alcance,tab,q,prov,desde,hasta`; `?rid=REC-XXX` | auth | scope líder |
| `/comprar/cotizaciones` · `/cotizaciones` | RfqPage | tab por estado | auth | RFQ→OC |
| `/comprar/temporada` | SeasonPlannerPage | temporada/escenario en estado | auth | planificación |
| `/reclamos` | ClaimsPage | chips abiertos/resueltos/todos | auth | sin scoping |
| `/importaciones` | ImportsPage | detalle en estado | auth | torre de control |
| `/campanas` | CampaignsPage | tab plan/perf | auth | espacios publicitarios |
| `/anticipacion` (`/campanas-oportunidades`→redir) | CampaignOpportunitiesPage | `query,channel,type,status,category,supplier,toggles` | auth | + "Mis campañas" |
| `/temporadas` | SeasonsChannelsPage | — | auth | demanda por canal |
| `/productos` | ProductsPage | `q,cat,sub,marca,prov,comercial,compra,stock` (URL) | auth | catálogo completo |
| `/productos/:sku` | ProductDetailPage | `?tab=resumen\|negociacion\|margen\|senales\|relacionados\|actividad` | auth | 6 pestañas |
| `/categorias` | CategoriesPage | — | auth | ScopeToggle |
| `/categorias/:id` | CategoryDetailPage | tab en estado | auth | 9 pestañas |
| `/proveedores` | SuppliersPage | `q,estado` | auth | — |
| `/proveedores/:id` | SupplierDetailPage | `?tab=ficha\|negociacion\|temporadas\|productos\|ordenes\|recepciones\|alertas` | auth | 7 pestañas |
| `/surtido` | AssortmentPage | tab rol/tiendas/marca-propia/line-review | auth | ScopeToggle |
| `/surtido-redundante` (`/catalogo-optimizado`→redir) | CatalogOptimizationPage | `cat` | auth | redundancia |
| `/nuevos-productos` | NewProductsPage | tab altas/salidas | auth | NPI |
| `/inventario` | InventoryAnalysisPage | deep-links a decisiones/productos | auth | — |
| `/analisis-compra` | PurchaseAnalysisPage | `tab,q,cat,marca,prov` (URL) | auth | ranking/liquidación; scope por rol |
| `/ventas` | SalesAnalysisPage | period 30/90/180 + tab | auth | — |
| `/margen-canal` | ChannelMarginPage | `alcance,tab,q,canal,estado,cat,prov,toggles` | auth | scope por rol |
| `/reportes` | ReportsPage | report + range | auth | 8 reportes + CSV |
| `/presupuesto` | BudgetPage | month,query,estado | auth | OTB |
| `/alzas-precio` | PriceIncreasesPage | selId,filtros | auth | aprobar/rechazar alza |
| `/venta-no-capturada` (`/oportunidades-perdidas`→redir) | LostOpportunitiesPage | `q,motivo` | auth | — |
| `/aprendizaje` (`/calidad-compra`,`/decisiones`→redir) | AprendizajePage | `?tab=calidad\|decisiones` | auth | embebe PurchaseQuality + Decisions |
| `/documentos` | DocumentsPage | filtros | auth | DMS (simulado) |
| `/reglas` | SettingsPage | tab scopeType | auth | editar reglas + auto-fix |
| `/gobierno` | GovernancePage | tab roles/matriz/bitácora | auth | solo lectura |
| `/equipo` | TeamDashboardPage | — | **líder** | — |
| `/equipo/carga` | WorkloadPage | — | **líder** | reasignar (simulado) |
| `/equipo/compradores` | BuyersPage | — | **líder** | — |
| `/equipo/ranking` | RankingPage | — | **líder** | gamificación; premios persisten |
| `/equipo/metas` | GoalsPage | comprador,estado | **líder** | OKR (solo lectura) |
| `/equipo/alertas` | TeamAlertsPage | — | **líder** | enruta, no persiste |

## Patrones de UI (para el diseño de contratos)
- **Tablas**: casi todas usan `DataTable` con `SortState` client-side; **sin paginación** (renderizan el set filtrado completo). Filtros client-side vía `FilterBar` (búsqueda + selects + toggles). Varias tablas cortan a top-N (100 en ranking/análisis). → **el backend debe soportar filtros/orden/paginación server-side para escalar**.
- **Export CSV**: `ExportButton` → `exportToCsv` (separador `;`, BOM UTF-8, sin timestamp), solo filas ya filtradas en cliente. Presente en: Reposición, Reportes (8 archivos), Margen-canal, Anticipación, Documentos.
- **Modales/Drawers de escritura** (formularios con validación): OrderDraftDrawer, OcDetailModal, ObserveModal (aprobación), CreateRfqModal + ComparisonDrawer, CreateClaimModal + ManageClaimModal, RuleEditDrawer, ProductFormModal + CreateCampaignModal (campañas), CampaignBuilderModal (anticipación), Cargar-lista (alzas), ForecastAdjust (temporada), Registrar-ronda (negociación proveedor), Términos/Acuerdos (proveedor), Reward CRUD (ranking), Reasignar/Offboard (carga), Reportar-señal (señales).
- **Deep-links entre vistas** (el BFF debe permitir navegación con contexto): `?oc=`, `?rid=`, `?sku`/`?q=`, `?tab=`, `?cat=`, `?foco=`, `?prov=` — todos parámetros de filtrado/selección que hoy se resuelven en cliente.
- **Realidad del contrato de deep-link (validado)**: solo un subconjunto de páginas sincroniza estado con la URL (`useUrlState`): Reposición (`foco,q,cat,prov,estado,prioridad`), Órdenes (`?oc=`), Recepciones (`alcance,tab,q,prov,desde,hasta,rid`), Productos (`q,cat,sub,marca,prov,comercial,compra,stock`), Proveedores (`q,estado`), Análisis-compra (`tab,q,cat,marca,prov`), Margen-canal (`alcance,tab,q,canal,estado,cat,prov,toggles`), Venta-no-capturada (`q,motivo`), Calidad (`q,tipo`), Decisiones (`q,resultado`), Aprendizaje (`tab`), Surtido-redundante (`cat`). En ProductDetail/SupplierDetail el `?tab=` se lee **solo al montar** (deep-link de entrada, no se re-escribe). **El resto usa estado local efímero** (se pierde al recargar y **no es deep-linkable**): Ventas, Reportes, Presupuesto, Alzas, Campañas, Anticipación, Temporadas, Señales, Alertas, RFQ, Aprobaciones, CategoryDetail. → Decisión pendiente: si se requiere compartir/enlazar estas vistas con estado, el backend/URL debe soportarlo (hoy no).
