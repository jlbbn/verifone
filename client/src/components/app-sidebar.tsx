import {
  LayoutDashboard,
  RefreshCw,
  Wallet,
  Store,
  FileText,
  Bitcoin,
  Lock,
  LogOut,
  MonitorSmartphone,
  Users,
  ChevronRight,
  Sliders,
  User,
  CreditCard,
  Shield,
  CalendarDays,
  Settings,
  BadgeCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  { title: "Dashboard",       url: "/dashboard",    icon: LayoutDashboard },
  { title: "Transacciones",   url: "/transacciones", icon: RefreshCw },
  { title: "Caja",            url: "/caja",          icon: Wallet },
  { title: "Enrutamiento POS",url: "/pos",           icon: Store },
  { title: "POS Virtual",     url: "/pos-virtual",   icon: MonitorSmartphone },
  { title: "Registros",       url: "/registros",     icon: FileText },
  { title: "Exchange Crypto", url: "/exchange",      icon: Bitcoin },
  { title: "Claves Encriptadas", url: "/claves",     icon: Lock },
];

const adminItems = [
  { title: "Gestión de Usuarios", url: "/admin/usuarios", icon: Users },
  { title: "Configuración",       url: "/admin/settings", icon: Sliders },
];

const PLAN_NAME    = "Enterprise Banking";
const PLAN_STATUS  = "Activa";
const PLAN_RENEW   = "03 Jun 2027";
const PLAN_SINCE   = "03 Jun 2025";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-3 md:p-4 border-b border-sidebar-border">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-2 md:gap-3 w-full text-left rounded-md p-1 -m-1 hover-elevate cursor-pointer"
              data-testid="button-profile-trigger"
            >
              <Avatar className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
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
              <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/40 flex-shrink-0" />
            </button>
          </PopoverTrigger>

          <PopoverContent side="right" align="start" sideOffset={12} className="w-76 p-0 shadow-lg" data-testid="panel-profile">
            {/* ── Profile header ── */}
            <div className="flex items-center gap-3 p-4 bg-muted/30">
              <Avatar className="w-12 h-12 flex-shrink-0">
                <AvatarFallback className="bg-[#c8322b] text-white font-bold text-base">
                  {user ? initials(user.fullName) : "BP"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{user?.fullName ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? "sin correo"}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge className="text-[10px] bg-[#c8322b]/10 text-[#c8322b] border-[#c8322b]/20 no-default-active-elevate">
                    {user?.role ?? "—"}
                  </Badge>
                  {user?.position && (
                    <Badge variant="outline" className="text-[10px] no-default-active-elevate">
                      {user.position}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Perfil section ── */}
            <div className="p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-1 mb-2">Perfil</p>
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs">{user?.fullName ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground">
                <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs">Acceso nivel: <strong>{user?.role ?? "—"}</strong></span>
              </div>
              {user?.position && (
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground">
                  <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs">{user.position}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* ── Suscripción section ── */}
            <div className="p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-1 mb-2">Suscripción</p>
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#c8322b]" />
                    <span className="text-xs font-semibold">{PLAN_NAME}</span>
                  </div>
                  <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 no-default-active-elevate">
                    {PLAN_STATUS}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <CalendarDays className="w-3 h-3" />
                    <span>Desde: <span className="font-mono text-foreground">{PLAN_SINCE}</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <CalendarDays className="w-3 h-3" />
                    <span>Renovación: <span className="font-mono text-foreground">{PLAN_RENEW}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Admin settings link ── */}
            {isAdmin && (
              <>
                <Separator />
                <div className="p-3">
                  <Link href="/admin/settings">
                    <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover-elevate text-sm text-muted-foreground" data-testid="link-profile-settings">
                      <Settings className="w-3.5 h-3.5" />
                      <span className="text-xs">Configuración del Sistema</span>
                    </button>
                  </Link>
                </div>
              </>
            )}

            <Separator />

            {/* ── Logout ── */}
            <div className="p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive"
                onClick={() => logout()}
                disabled={isLoggingOut}
                data-testid="button-logout-profile"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
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
                    data-testid={`nav-${item.title.toLowerCase().replace(/ /g, "-")}`}
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

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-sidebar-foreground/50 uppercase tracking-wider px-3 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" /> Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={location === item.url ? "bg-sidebar-accent" : ""}
                      data-testid={`nav-${item.title.toLowerCase().replace(/ /g, "-")}`}
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
        )}
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
