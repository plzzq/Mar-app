import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AnnouncerProvider } from "@/contexts/AnnouncerContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { MarIAPage } from "@/pages/MarIAPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ReportsPage } from "@/pages/ReportsPage";
import { RequestDetailPage } from "@/pages/RequestDetailPage";
import { RequestFormPage } from "@/pages/RequestFormPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { SeparationPage } from "@/pages/SeparationPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StockDetailPage } from "@/pages/StockDetailPage";
import { StockPage } from "@/pages/StockPage";

/** Protege as rotas internas. A autenticação é apenas demonstrativa nesta fase. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const location = useLocation();
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        {/* Preferências de acessibilidade aplicadas globalmente. */}
        <AccessibilityProvider>
          {/* Regiões de anúncio para leitores de tela. */}
          <AnnouncerProvider>
            {/* Avisos respeitam duração e som configurados pelo usuário. */}
            <ToastProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="demandas" element={<Navigate to="/solicitacoes" replace />} />
                  <Route path="solicitacoes" element={<RequestsPage />} />
                  <Route path="solicitacoes/nova" element={<RequestFormPage />} />
                  <Route path="solicitacoes/:id" element={<RequestDetailPage />} />
                  <Route path="solicitacoes/:id/editar" element={<RequestFormPage />} />
                  <Route path="estoque" element={<StockPage />} />
                  <Route path="estoque/:id" element={<StockDetailPage />} />
                  <Route path="separacao" element={<SeparationPage />} />
                  <Route path="mar-ia" element={<MarIAPage />} />
                  <Route path="relatorios" element={<ReportsPage />} />
                  <Route path="historico" element={<HistoryPage />} />
                  <Route path="notificacoes" element={<NotificationsPage />} />
                  <Route path="configuracoes" element={<SettingsPage />} />
                  <Route path="perfil" element={<ProfilePage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ToastProvider>
          </AnnouncerProvider>
        </AccessibilityProvider>
      </AuthProvider>
    </HashRouter>
  );
}
