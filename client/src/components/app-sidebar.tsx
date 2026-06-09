import { 
  LayoutDashboard, 
  RefreshCw, 
  Wallet, 
  Store, 
  FileText, 
  Bitcoin, 
  Lock,
  LogOut
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
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-3 md:p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 md:gap-3">
          <Avatar className="w-10 h-10 md:w-12 md:h-12">
            <AvatarFallback className="bg-[#c8322b] text-white font-bold text-sm md:text-base">
              {user ? initials(user.fullName) : "BP"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs md:text-sm font-semibold text-sidebar-foreground truncate" data-testid="text-sidebar-fullname">
              {user?.fullName ?? "—"}
            </h3>
            <p className="text-xs text-[#c8322b] font-semibold" data-testid="text-sidebar-role">{user?.role ?? ""}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate" data-testid="text-sidebar-email">{user?.email ?? ""}</p>
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
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => logout()}
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
