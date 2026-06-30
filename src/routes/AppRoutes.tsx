import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { LoginPage } from "../pages/LoginPage";
import { OcDraftProvider } from "../context/OcDraftContext";
import { ToastProvider } from "../context/ToastContext";
import { BuyerProvider } from "../context/BuyerContext";
import { RoleProvider } from "../context/RoleContext";
import { NotificationProvider } from "../context/NotificationContext";
import { SignalsProvider } from "../context/SignalsContext";
import { PurchaseFlowProvider } from "../context/PurchaseFlowContext";
import { DataProvider } from "../context/DataContext";
import { DensityProvider } from "../context/DensityContext";
import { RoleGate } from "../components/layout/RoleGate";

// Carga diferida por ruta: cada página viaja en su propio chunk.
const named = <T extends Record<string, unknown>, K extends keyof T>(p: Promise<T>, key: K) =>
  p.then((m) => ({ default: m[key] as unknown as React.ComponentType }));

const SalesSignalsPage = lazy(() => named(import("../pages/SalesSignalsPage"), "SalesSignalsPage"));
const InicioPage = lazy(() => named(import("../pages/MyPanelPage"), "MyPanelPage"));
const ReplenishmentPage = lazy(() => named(import("../pages/ReplenishmentPage"), "ReplenishmentPage"));
const ProductsPage = lazy(() => named(import("../pages/ProductsPage"), "ProductsPage"));
const ProductDetailPage = lazy(() => named(import("../pages/ProductDetailPage"), "ProductDetailPage"));
const CategoriesPage = lazy(() => named(import("../pages/CategoriesPage"), "CategoriesPage"));
const CatalogOptimizationPage = lazy(() => named(import("../pages/CatalogOptimizationPage"), "CatalogOptimizationPage"));
const SuppliersPage = lazy(() => named(import("../pages/SuppliersPage"), "SuppliersPage"));
const PurchaseOrdersPage = lazy(() => named(import("../pages/PurchaseOrdersPage"), "PurchaseOrdersPage"));
const AlertsPage = lazy(() => named(import("../pages/AlertsPage"), "AlertsPage"));
const CampaignOpportunitiesPage = lazy(() => named(import("../pages/CampaignOpportunitiesPage"), "CampaignOpportunitiesPage"));
const CampaignsPage = lazy(() => named(import("../pages/CampaignsPage"), "CampaignsPage"));
const ChannelMarginPage = lazy(() => named(import("../pages/ChannelMarginPage"), "ChannelMarginPage"));
const ReceptionsPage = lazy(() => named(import("../pages/ReceptionsPage"), "ReceptionsPage"));
const SupplierDetailPage = lazy(() => named(import("../pages/SupplierDetailPage"), "SupplierDetailPage"));
const CategoryDetailPage = lazy(() => named(import("../pages/CategoryDetailPage"), "CategoryDetailPage"));
const InventoryAnalysisPage = lazy(() => named(import("../pages/InventoryAnalysisPage"), "InventoryAnalysisPage"));
const SalesAnalysisPage = lazy(() => named(import("../pages/SalesAnalysisPage"), "SalesAnalysisPage"));
const SettingsPage = lazy(() => named(import("../pages/SettingsPage"), "SettingsPage"));
const MyPerformancePage = lazy(() => named(import("../pages/MyPerformancePage"), "MyPerformancePage"));
const TeamDashboardPage = lazy(() => named(import("../pages/TeamDashboardPage"), "TeamDashboardPage"));
const TeamAlertsPage = lazy(() => named(import("../pages/TeamAlertsPage"), "TeamAlertsPage"));
const BuyersPage = lazy(() => named(import("../pages/BuyersPage"), "BuyersPage"));
const RankingPage = lazy(() => named(import("../pages/RankingPage"), "RankingPage"));
const GoalsPage = lazy(() => named(import("../pages/GoalsPage"), "GoalsPage"));
const WorkloadPage = lazy(() => named(import("../pages/WorkloadPage"), "WorkloadPage"));
const LostOpportunitiesPage = lazy(() => named(import("../pages/LostOpportunitiesPage"), "LostOpportunitiesPage"));
const AprendizajePage = lazy(() => named(import("../pages/AprendizajePage"), "AprendizajePage"));
const ApprovalsPage = lazy(() => named(import("../pages/ApprovalsPage"), "ApprovalsPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-slate-400">
      Cargando…
    </div>
  );
}

/** Exige sesión: si no hay, redirige a /login recordando la ruta de origen. */
function RequireAuth() {
  const { authenticated } = useAuth();
  const location = useLocation();
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppLayout />;
}

/** Si ya hay sesión, no muestra el login: lleva al inicio. */
function LoginGate() {
  const { authenticated } = useAuth();
  if (authenticated) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function AppRoutes() {
  return (
    <AuthProvider>
    <ToastProvider>
      <DensityProvider>
      <DataProvider>
      <RoleProvider>
      <BuyerProvider>
      <NotificationProvider>
      <OcDraftProvider>
      <PurchaseFlowProvider>
      <SignalsProvider>
        <Routes>
        <Route path="/login" element={<LoginGate />} />
        <Route element={<RequireAuth />}>
          <Route element={<Suspense fallback={<PageLoader />}><Outlet /></Suspense>}>
          {/* Inicio: una sola portada operativa (antes "Dashboard" + "Mi panel"). */}
          <Route path="/" element={<InicioPage />} />
          <Route path="/mi-panel" element={<Navigate to="/" replace />} />
          <Route path="/mi-desempeno" element={<MyPerformancePage />} />
          <Route path="/equipo" element={<RoleGate allow="lider"><TeamDashboardPage /></RoleGate>} />
          <Route path="/equipo/alertas" element={<RoleGate allow="lider"><TeamAlertsPage /></RoleGate>} />
          <Route path="/equipo/compradores" element={<RoleGate allow="lider"><BuyersPage /></RoleGate>} />
          <Route path="/equipo/ranking" element={<RoleGate allow="lider"><RankingPage /></RoleGate>} />
          <Route path="/equipo/metas" element={<RoleGate allow="lider"><GoalsPage /></RoleGate>} />
          <Route path="/equipo/carga" element={<RoleGate allow="lider"><WorkloadPage /></RoleGate>} />
          <Route path="/reposicion" element={<ReplenishmentPage />} />
          <Route path="/campanas" element={<CampaignsPage />} />
          {/* Renombrada: "Oportunidades" → "Anticipación de campañas". */}
          <Route path="/anticipacion" element={<CampaignOpportunitiesPage />} />
          <Route path="/campanas-oportunidades" element={<Navigate to="/anticipacion" replace />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/productos/:sku" element={<ProductDetailPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/categorias/:id" element={<CategoryDetailPage />} />
          {/* Renombrada: "Catálogo optimizado" → "Surtido redundante". */}
          <Route path="/surtido-redundante" element={<CatalogOptimizationPage />} />
          <Route path="/catalogo-optimizado" element={<Navigate to="/surtido-redundante" replace />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/proveedores/:id" element={<SupplierDetailPage />} />
          <Route path="/ordenes-compra" element={<PurchaseOrdersPage />} />
          <Route path="/recepciones" element={<ReceptionsPage />} />
          {/* Renombrada: "Oportunidades perdidas" → "Venta no capturada". */}
          <Route path="/venta-no-capturada" element={<LostOpportunitiesPage />} />
          <Route path="/oportunidades-perdidas" element={<Navigate to="/venta-no-capturada" replace />} />
          {/* Fusión: "Calidad de compra" + "Historial de decisiones" → "Aprendizaje de compra". */}
          <Route path="/aprendizaje" element={<AprendizajePage />} />
          <Route path="/calidad-compra" element={<Navigate to="/aprendizaje" replace />} />
          <Route path="/decisiones" element={<Navigate to="/aprendizaje?tab=decisiones" replace />} />
          <Route path="/aprobaciones" element={<ApprovalsPage />} />
          <Route path="/alertas" element={<AlertsPage />} />
          <Route path="/senales-ventas" element={<SalesSignalsPage />} />
          <Route path="/inventario" element={<InventoryAnalysisPage />} />
          <Route path="/ventas" element={<SalesAnalysisPage />} />
          <Route path="/margen-canal" element={<ChannelMarginPage />} />
          <Route path="/reglas" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Route>
        </Routes>
      </SignalsProvider>
      </PurchaseFlowProvider>
      </OcDraftProvider>
      </NotificationProvider>
      </BuyerProvider>
      </RoleProvider>
      </DataProvider>
      </DensityProvider>
    </ToastProvider>
    </AuthProvider>
  );
}
