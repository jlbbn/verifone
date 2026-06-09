import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell, CheckCheck, Inbox, ShieldAlert, Store, Info,
  CheckCircle2, Send, Loader2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface NotificationItem {
  id: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  fromUser: string | null;
  status: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread: number;
  pending: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

function typeIcon(type: string) {
  switch (type) {
    case "pos_request": return <Store className="w-4 h-4 text-[#c8322b]" />;
    case "request_sent": return <Send className="w-4 h-4 text-blue-600" />;
    case "request_resolved": return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "system": return <ShieldAlert className="w-4 h-4 text-[#c8322b]" />;
    default: return <Info className="w-4 h-4 text-blue-600" />;
  }
}

export function NotificationsBell() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;
  const pending = data?.pending ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/resolve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative hover-elevate p-2 rounded-md"
          data-testid="button-notifications"
          aria-label="Notificaciones"
        >
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#c8322b] text-[10px] font-bold flex items-center justify-center"
              data-testid="badge-unread-count"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 md:w-96 p-0" data-testid="popover-notifications">
        <div className="flex items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notificaciones</p>
            {isAdmin && pending > 0 && (
              <Badge className="bg-[#c8322b] text-white no-default-active-elevate" data-testid="badge-pending-count">
                {pending} pendiente{pending > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-1" /> Marcar leídas
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-[360px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Inbox className="w-8 h-8" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const isPendingRequest = n.type === "pos_request" && n.status === "pending";
                return (
                  <div
                    key={n.id}
                    className={`p-3 ${n.read ? "" : "bg-[#c8322b]/5"}`}
                    data-testid={`notification-${n.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        {typeIcon(n.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate" data-testid={`text-notification-title-${n.id}`}>
                            {n.title}
                          </p>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-[#c8322b] flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                          <div className="flex items-center gap-1.5">
                            {isAdmin && isPendingRequest && (
                              <Button
                                size="sm"
                                className="bg-[#c8322b] text-white"
                                onClick={() => resolve.mutate(n.id)}
                                disabled={resolve.isPending}
                                data-testid={`button-resolve-${n.id}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marcar atendida
                              </Button>
                            )}
                            {n.status === "resolved" && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate">
                                Atendida
                              </Badge>
                            )}
                            {!n.read && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markRead.mutate(n.id)}
                                disabled={markRead.isPending}
                                data-testid={`button-mark-read-${n.id}`}
                              >
                                Marcar leída
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
