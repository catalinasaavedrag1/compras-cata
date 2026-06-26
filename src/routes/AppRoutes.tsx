import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { OcDraftProvider } from "../context/OcDraftContext";
import { ToastProvider } from "../context/ToastContext";
import { BuyerProvider } from "../context/BuyerContext";
import { RoleProvider } from "../context/RoleContext";
import { NotificationProvider } from "../context/NotificationContext";
import { SignalsProvider } from "../context/SignalsContext";
import { DashboardPage } from "../pages/DashboardPage";
import { SalesSignalsPage } from "../pages/SalesSignalsPage";
import { MyPanelPage } from "../pages/MyPanelPage";
import { ReplenishmentPage } from "../pages/ReplenishmentPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ProductDetailPage } from "../pages/ProductDetailPage";
import { CategoriesPage } from "../pages/CategoriesPage";
import { CatalogOptimizationPage } from "../pages/CatalogOptimizationPage";
import { SuppliersPage } from "../pages/SuppliersPage";
import { PurchaseOrdersPage } from "../pages/PurchaseOrdersPage";
import { AlertsPage } from "../pages/AlertsPage";
import { CampaignOpportunitiesPage } from "../pages/CampaignOpportunitiesPage";
import { ChannelMarginPage } from "../pages/ChannelMarginPage";
import { ReceptionsPage } from "../pages/ReceptionsPage";
import { SupplierDetailPage } from "../pages/SupplierDetailPage";
import { CategoryDetailPage } from "../pages/CategoryDetailPage";
import { InventoryAnalysisPage } from "../pages/InventoryAnalysisPage";
import { SalesAnalysisPage } from "../pages/SalesAnalysisPage";
import { SettingsPage } from "../pages/SettingsPage";
import { MyPerformancePage } from "../pages/MyPerformancePage";
import { TeamDashboardPage } from "../pages/TeamDashboardPage";
import { TeamAlertsPage } from "../pages/TeamAlertsPage";
import { BuyersPage } from "../pages/BuyersPage";
import { RankingPage } from "../pages/RankingPage";
import { GoalsPage } from "../pages/GoalsPage";
import { WorkloadPage } from "../pages/WorkloadPage";

export default function AppRoutes() {
  return (
    <ToastProvider>
      <RoleProvider>
      <BuyerProvider>
      <NotificationProvider>
      <OcDraftProvider>
      <SignalsProvider>
        <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/mi-panel" element={<MyPanelPage />} />
          <Route path="/mi-desempeno" element={<MyPerformancePage />} />
          <Route path="/equipo" element={<TeamDashboardPage />} />
          <Route path="/equipo/alertas" element={<TeamAlertsPage />} />
          <Route path="/equipo/compradores" element={<BuyersPage />} />
          <Route path="/equipo/ranking" element={<RankingPage />} />
          <Route path="/equipo/metas" element={<GoalsPage />} />
          <Route path="/equipo/carga" element={<WorkloadPage />} />
          <Route path="/reposicion" element={<ReplenishmentPage />} />
          <Route path="/campanas-oportunidades" element={<CampaignOpportunitiesPage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/productos/:sku" element={<ProductDetailPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/categorias/:id" element={<CategoryDetailPage />} />
          <Route path="/catalogo-optimizado" element={<CatalogOptimizationPage />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/proveedores/:id" element={<SupplierDetailPage />} />
          <Route path="/ordenes-compra" element={<PurchaseOrdersPage />} />
          <Route path="/recepciones" element={<ReceptionsPage />} />
          <Route path="/alertas" element={<AlertsPage />} />
          <Route path="/senales-ventas" element={<SalesSignalsPage />} />
          <Route path="/inventario" element={<InventoryAnalysisPage />} />
          <Route path="/ventas" element={<SalesAnalysisPage />} />
          <Route path="/margen-canal" element={<ChannelMarginPage />} />
          <Route path="/reglas" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SignalsProvider>
      </OcDraftProvider>
      </NotificationProvider>
      </BuyerProvider>
      </RoleProvider>
    </ToastProvider>
  );
}
