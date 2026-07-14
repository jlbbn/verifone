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
  Zap,
  Coins,
  FolderOpen,
  AlertTriangle,
  ShieldCheck,
  HardDrive,
  TrendingUp,
} from "lucide-react";
import { SiDropbox, SiReplit, SiGithub } from "react-icons/si";
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
import { useQuery } from "@tanstack/react-query";

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
  { title: "Dashboard",           url: "/dashboard",        icon: LayoutDashboard },
  { title: "Transacciones",       url: "/transacciones",    icon: RefreshCw },
  { title: "Caja",                url: "/caja",             icon: Wallet },
  { title: "Enrutamiento POS",    url: "/pos",              icon: Store },
  { title: "POS Virtual",         url: "/pos-virtual",      icon: MonitorSmartphone },
  { title: "Decision Intelligence",url: "/pos-intelligence", icon: Zap },
  { title: "Registros",           url: "/registros",        icon: FileText },
  { title: "Exchange Crypto",     url: "/exchange",         icon: Bitcoin },
  { title: "Claves Encriptadas",  url: "/claves",           icon: Lock },
  { title: "Cumplimiento Bancario", url: "/cumplimiento",   icon: ShieldCheck },
  { title: "Documentos",          url: "/documentos",       icon: FolderOpen },
  { title: "Payment Discrepancies", url: "/support",         icon: AlertTriangle },
];

const adminItems = [
  { title: "Gestión de Usuarios", url: "/admin/usuarios",   icon: Users  },
  { title: "Caja USDT",           url: "/admin/caja-usdt",  icon: Coins  },
  { title: "Configuración",       url: "/admin/settings",   icon: Sliders },
];

const PLAN_NAME    = "Enterprise Banking";
const PLAN_STATUS  = "Activa";
const PLAN_RENEW   = "03 Jun 2027";
const PLAN_SINCE   = "03 Jun 2025";

const ALLOWED_RESTRICTED = ["/dashboard", "/documentos", "/subscription"];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: subData } = useQuery<{ restricted?: boolean }>({
    queryKey: ["/api/subscription"],
    enabled: !!user && !isAdmin,
  });
  const isRestricted = !isAdmin && !!(subData?.restricted);

  const visibleMenuItems = isRestricted
    ? menuItems.filter(item => ALLOWED_RESTRICTED.includes(item.url))
    : menuItems;

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

            {/* ── Subscription link ── */}
            <Separator />
            <div className="p-3">
              <Link href="/subscription">
                <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover-elevate text-sm text-muted-foreground" data-testid="link-profile-subscription">
                  <CreditCard className="w-3.5 h-3.5 text-[#c8322b]" />
                  <span className="text-xs">Mi Suscripción y Contrato</span>
                </button>
              </Link>
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
              {visibleMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={isActive ? "bg-sidebar-accent font-medium" : ""}
                      data-testid={`nav-${item.title.toLowerCase().replace(/ /g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className={`w-4 h-4 ${isActive ? "text-[#c8322b]" : ""}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-sidebar-foreground/50 uppercase tracking-wider px-3 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" /> Users &amp; Contracts
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={isActive ? "bg-sidebar-accent font-medium" : ""}
                        data-testid={`nav-${item.title.toLowerCase().replace(/ /g, "-")}`}
                      >
                        <Link href={item.url}>
                          <item.icon className={`w-4 h-4 ${isActive ? "text-[#c8322b]" : ""}`} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-sidebar-border space-y-2">
        {/* ── GitHub Sync Plan banner ── */}
        <div className="rounded-md border border-[#c8322b]/30 bg-[#c8322b]/5 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <SiGithub className="w-3.5 h-3.5 text-[#c8322b] flex-shrink-0" />
            <span className="text-[11px] font-semibold text-sidebar-foreground leading-tight">
              Actualizar Plan GitHub
            </span>
          </div>
          <p className="text-[10px] text-sidebar-foreground/70 leading-snug">
            Sincronización de datos total <span className="font-semibold text-sidebar-foreground">1,082 GB</span> a través de:
          </p>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60">
              <SiReplit className="w-3 h-3 text-[#f26207]" /> Replit
            </span>
            <span className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60">
              <SiDropbox className="w-3 h-3 text-[#0061ff]" /> Dropbox
            </span>
            <span className="flex items-center gap-1 text-[10px] text-sidebar-foreground/60">
              <HardDrive className="w-3 h-3 text-sidebar-foreground/50" /> Server
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] font-bold text-sidebar-foreground">$780.00 <span className="font-normal text-[10px] text-sidebar-foreground/50">USD</span></span>
            <button
              className="flex items-center gap-1 text-[10px] font-semibold text-[#c8322b] hover-elevate px-2 py-1 rounded-md"
              data-testid="button-github-plan-upgrade"
            >
              <TrendingUp className="w-3 h-3" />
              Activar
            </button>
          </div>
        </div>

        {/* ── Logout ── */}
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sidebar-foreground/60 hover-elevate text-xs transition-colors"
          onClick={() => logout()}
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}</span>
        </button>
        <p className="text-[10px] text-sidebar-foreground/25 font-mono text-center tracking-wider">
          Banxico Plus · v3.1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
