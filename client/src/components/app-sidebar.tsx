import { 
  LayoutDashboard, 
  RefreshCw, 
  Wallet, 
  Store, 
  FileText, 
  Bitcoin, 
  Lock,
  Search
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transacciones", url: "/transacciones", icon: RefreshCw },
  { title: "Caja", url: "/caja", icon: Wallet },
  { title: "Enrutamiento POS", url: "/pos", icon: Store },
  { title: "Registros", url: "/registros", icon: FileText },
  { title: "Exchange Crypto", url: "/exchange", icon: Bitcoin },
  { title: "Claves Encriptadas", url: "/claves", icon: Lock },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#c8322b] font-bold text-lg">
            BP
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-sidebar-foreground">José Luis Barrientos</h3>
            <p className="text-xs text-[#c8322b] font-semibold">ADMIN</p>
            <p className="text-xs text-sidebar-foreground/60">Software Engineer - 3 May 2025</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={location === item.url ? "bg-sidebar-accent" : ""}
                    data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/50">
          <Search className="w-4 h-4 text-sidebar-foreground/60" />
          <span className="text-sm text-sidebar-foreground/60">Search</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
