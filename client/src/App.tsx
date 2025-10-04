import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { FinancialTicker } from "@/components/financial-ticker";
import { CreditCard, Bell, User } from "lucide-react";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import NewTransactionPage from "@/pages/new-transaction";
import NotFound from "@/pages/not-found";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-[#c8322b] h-[60px] flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3 text-white">
            <CreditCard className="w-5 h-5 md:w-6 md:h-6" />
            <h1 className="text-lg md:text-xl font-semibold">Banxico Plus</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4 text-white">
            <button className="hover:bg-white/10 p-2 rounded-md transition-colors">
              <Bell className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button className="hover:bg-white/10 p-2 rounded-md transition-colors">
              <User className="w-4 h-4 md:w-5 md:h-5" />
            </button>
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
        <AppLayout><div className="p-6"><h1 className="text-3xl font-bold">Caja</h1></div></AppLayout>
      </Route>
      
      <Route path="/pos">
        <AppLayout><div className="p-6"><h1 className="text-3xl font-bold">Enrutamiento POS</h1></div></AppLayout>
      </Route>
      
      <Route path="/registros">
        <AppLayout><div className="p-6"><h1 className="text-3xl font-bold">Registros</h1></div></AppLayout>
      </Route>
      
      <Route path="/exchange">
        <AppLayout><div className="p-6"><h1 className="text-3xl font-bold">Exchange Crypto</h1></div></AppLayout>
      </Route>
      
      <Route path="/claves">
        <AppLayout><div className="p-6"><h1 className="text-3xl font-bold">Claves Encriptadas</h1></div></AppLayout>
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
