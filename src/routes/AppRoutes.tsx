import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { OcDraftProvider } from "../context/OcDraftContext";
import { ToastProvider } from "../context/ToastContext";
import { BuyerProvider } from "../context/BuyerContext";
import { NotificationProvider } from "../context/NotificationContext";
import { DashboardPage } from "../pages/DashboardPage";
import { MyPanelPage } from "../pages/MyPanelPage";
import { ReplenishmentPage } from "../pages/ReplenishmentPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ProductDetailPage } from "../pages/ProductDetailPage";
import { CategoriesPage } from "../pages/CategoriesPage";
import { SuppliersPage } from "../pages/SuppliersPage";
import { PurchaseOrdersPage } from "../pages/PurchaseOrdersPage";
import { AlertsPage } from "../pages/AlertsPage";
import { CampaignOpportunitiesPage } from "../pages/CampaignOpportunitiesPage";
import { InventoryAnalysisPage } from "../pages/InventoryAnalysisPage";
import { SalesAnalysisPage } from "../pages/SalesAnalysisPage";
import { SettingsPage } from "../pages/SettingsPage";

export default function AppRoutes() {
  return (
    <ToastProvider>
      <BuyerProvider>
      <NotificationProvider>
      <OcDraftProvider>
        <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/mi-panel" element={<MyPanelPage />} />
          <Route path="/reposicion" element={<ReplenishmentPage />} />
          <Route path="/campanas-oportunidades" element={<CampaignOpportunitiesPage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/productos/:sku" element={<ProductDetailPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/ordenes-compra" element={<PurchaseOrdersPage />} />
          <Route path="/alertas" element={<AlertsPage />} />
          <Route path="/inventario" element={<InventoryAnalysisPage />} />
          <Route path="/ventas" element={<SalesAnalysisPage />} />
          <Route path="/reglas" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </OcDraftProvider>
      </NotificationProvider>
      </BuyerProvider>
    </ToastProvider>
  );
}
