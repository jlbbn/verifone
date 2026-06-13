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
import { NotificationsBell } from "@/components/notifications-bell";
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
import NotFound from "@/pages/not-found";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();

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

  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-[#c8322b] h-[60px] flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3 text-white">
            <SidebarTrigger className="md:hidden text-white hover:bg-white/10" />
            <CreditCard className="w-5 h-5 md:w-6 md:h-6" />
            <h1 className="text-lg md:text-xl font-semibold">Banxico Plus</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4 text-white">
            <NotificationsBell />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-semibold" data-testid="text-header-username">{user?.fullName}</p>
                <p className="text-[10px] text-white/70" data-testid="text-header-email">{user?.email}</p>
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
