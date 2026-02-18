import { useEffect, lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TabLayout } from "@/components/layout";
import { useAppStore } from "@/stores/appStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

// Lazy-loaded page components for code splitting
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DepositStatusPage = lazy(() => import("./pages/DepositStatusPage"));
const BudgetPage = lazy(() => import("./pages/BudgetPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthPage = lazy(() => import("./pages/AuthPage").then(m => ({ default: m.AuthPage })));

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAppStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Admin Route Guard Component
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore();

  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Budget Route Guard — ADMIN, MANAGER, PRODUCER
function BudgetRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore();

  if (!currentUser || !['ADMIN', 'MANAGER', 'PRODUCER'].includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => {
  const { initializeAuth, isInitializing, theme } = useAppStore();

  useEffect(() => {
    if (isSupabaseConfigured()) {
      initializeAuth();
    }
  }, [initializeAuth]);

  // Apply theme class on mount and changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (isInitializing && isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading Re-Be.io...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          }>
            <ErrorBoundary>
              <Routes>
                {/* Auth Route */}
                <Route path="/auth" element={<AuthPage />} />

                {/* Main Layout — Widget-based tab system */}
                <Route
                  element={
                    <ProtectedRoute>
                      <TabLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Root renders WidgetGrid (handled by TabLayout) */}
                  <Route path="/" element={null} />

                  {/* Sub-routes that render via Outlet inside TabLayout */}
                  <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/projects/:projectId/deposits" element={<DepositStatusPage />} />
                  <Route path="/projects/:projectId/budget" element={<BudgetRoute><BudgetPage /></BudgetRoute>} />

                  {/* Legacy routes redirect to root (now widget-based) */}
                  <Route path="/calendar" element={<Navigate to="/" replace />} />
                  <Route path="/projects" element={<Navigate to="/" replace />} />
                  <Route path="/projects/:projectId" element={<Navigate to="/" replace />} />
                  <Route path="/chat" element={<Navigate to="/" replace />} />
                  <Route path="/inbox" element={<Navigate to="/" replace />} />
                  <Route path="/profile" element={<Navigate to="/settings" replace />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
