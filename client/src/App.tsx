import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { FinancialTicker } from "@/components/financial-ticker";
import { CreditCard, User, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSystemSettings } from "@/hooks/use-system-settings";
import { NotificationsBell } from "@/components/notifications-bell";
import { ShieldAlert } from "lucide-react";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import NewTransactionPage from "@/pages/new-transaction";
import CajaPage from "@/pages/caja";
import POSPage from "@/pages/pos";
import POSVirtualPage from "@/pages/pos-virtual";
import RegistrosPage from "@/pages/registros";
import ExchangePage from "@/pages/exchange";
import ClavesPage from "@/pages/claves";
import AdminUsuariosPage from "@/pages/admin-users";
import AdminSettingsPage from "@/pages/admin-settings";
import AdminCajaUSDTPage from "@/pages/admin-caja-usdt";
import DocumentsPage from "@/pages/documents";
import SupportPage from "@/pages/support";
import POSIntelligencePage from "@/pages/pos-intelligence";
import SubscriptionPage from "@/pages/subscription";
import SubscriptionPaymentPage from "@/pages/subscription-payment";
import CompliancePage from "@/pages/compliance";
import NotFound from "@/pages/not-found";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { data: settings } = useSystemSettings();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-[#c8322b]" data-testid="loader-session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // ── Mantenimiento global — bloquea a todos los usuarios excepto ADMIN ──
  if (settings?.maintenanceMode && user?.role !== "ADMIN" && user?.email !== "optimaqrh@gmail.com") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0f0f0f] px-6" data-testid="screen-maintenance">
        <div className="max-w-md w-full mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#c8322b]/15 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-[#c8322b]" />
          </div>
          <p className="text-white/40 text-xs font-mono tracking-widest uppercase mb-2">Banxico Plus</p>
          <h1 className="text-white text-2xl font-bold mb-3" data-testid="text-maintenance-title">
            On Maintenance
          </h1>
          <p className="text-white/70 text-sm leading-relaxed" data-testid="text-maintenance-message">
            El sistema se encuentra en mantenimiento global para todos los usuarios. El acceso se restablecerá automáticamente al finalizar.
          </p>
        </div>
      </div>
    );
  }

  // ── Suspensión de cuenta — solo mensaje, sin acceso a ninguna función ──
  if (user?.email === "ovidiohdez@gmail.com") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-white">
        <div className="max-w-md w-full mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#c8322b]/10 flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-8 h-8 text-[#c8322b]" />
          </div>
          <p className="text-gray-900 text-base font-normal leading-relaxed">
            Proceso de reembolso con fecha dictada al 11 de julio
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-gradient-to-r from-[#c8322b] to-[#a82520] h-[60px] flex items-center justify-between px-4 md:px-6 shadow-md flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3 text-white">
            <SidebarTrigger className="md:hidden text-white hover:bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-white/15 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="leading-none">
                <h1 className="text-base md:text-lg font-bold tracking-tight">Banxico Plus</h1>
                <p className="text-[10px] text-white/60 font-mono hidden md:block">Banking Platform v3.1</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 text-white">
            <NotificationsBell />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 ring-2 ring-white/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-semibold" data-testid="text-header-username">{user?.fullName}</p>
                <p className="text-[10px] text-white/65" data-testid="text-header-email">{user?.email}</p>
              </div>
            </div>
          </div>
        </header>
        
        <FinancialTicker />
        
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      
      <Route path="/dashboard">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      
      <Route path="/transacciones">
        <AppLayout><NewTransactionPage /></AppLayout>
      </Route>
      
      <Route path="/caja">
        <AppLayout><CajaPage /></AppLayout>
      </Route>
      
      <Route path="/pos">
        <AppLayout><POSPage /></AppLayout>
      </Route>

      <Route path="/pos-virtual">
        <AppLayout><POSVirtualPage /></AppLayout>
      </Route>
      
      <Route path="/registros">
        <AppLayout><RegistrosPage /></AppLayout>
      </Route>
      
      <Route path="/exchange">
        <AppLayout><ExchangePage /></AppLayout>
      </Route>
      
      <Route path="/claves">
        <AppLayout><ClavesPage /></AppLayout>
      </Route>

      <Route path="/cumplimiento">
        <AppLayout><CompliancePage /></AppLayout>
      </Route>

      <Route path="/pos-intelligence">
        <AppLayout><POSIntelligencePage /></AppLayout>
      </Route>

      <Route path="/subscription/payment">
        <AppLayout><SubscriptionPaymentPage /></AppLayout>
      </Route>

      <Route path="/subscription">
        <AppLayout><SubscriptionPage /></AppLayout>
      </Route>

      <Route path="/admin/usuarios">
        <AppLayout>
          <AdminGuard><AdminUsuariosPage /></AdminGuard>
        </AppLayout>
      </Route>

      <Route path="/admin/settings">
        <AppLayout>
          <AdminGuard><AdminSettingsPage /></AdminGuard>
        </AppLayout>
      </Route>

      <Route path="/documentos">
        <AppLayout><DocumentsPage /></AppLayout>
      </Route>

      <Route path="/support">
        <AppLayout><SupportPage /></AppLayout>
      </Route>

      {/* El Motor de Pagos (Quantum 9.0) fue unificado dentro de POS Virtual */}
      <Route path="/payment-engine">
        <Redirect to="/pos-virtual" />
      </Route>

      <Route path="/admin/caja-usdt">
        <AppLayout>
          <AdminGuard><AdminCajaUSDTPage /></AdminGuard>
        </AppLayout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <Router />
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
