import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Plus, Clock, CheckCircle, RefreshCw,
  Paperclip, FileText, MessageSquare, Building2, Phone,
  ChevronDown, ChevronUp, Shield,
} from "lucide-react";

type SupportTicket = {
  id: string;
  ticketId: string;
  subject: string;
  category: string;
  description: string;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  status: string;
  priority: string;
  submittedBy: string;
  adminNote?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  billing:  "Billing / Facturación",
  payment:  "Payment / Pago",
  refund:   "Refund / Reembolso",
  charge:   "Unrecognized Charge",
  other:    "Other / Otro",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open:        { label: "Open",        color: "bg-blue-100 text-blue-800 border-blue-200",    icon: Clock },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-800 border-amber-200", icon: RefreshCw },
  resolved:    { label: "Resolved",    color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  closed:      { label: "Closed",      color: "bg-muted text-muted-foreground border-border",  icon: CheckCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  high:   { label: "High",   color: "bg-red-100 text-red-700 border-red-200" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "ADMIN";

  const [open, setOpen]           = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [subject, setSubject]     = useState("");
  const [category, setCategory]   = useState("billing");
  const [description, setDesc]    = useState("");
  const [priority, setPriority]   = useState("medium");
  const [file, setFile]           = useState<File | null>(null);
  const [submitting, setSubmit]   = useState(false);

  const [adminNote, setAdminNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/support/tickets", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket submitted", description: "We'll review your case soon." });
      setOpen(false);
      setSubject(""); setCategory("billing"); setDesc(""); setPriority("medium"); setFile(null);
    },
    onError: () => toast({ title: "Error submitting ticket", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: object }) =>
      apiRequest("PATCH", `/api/support/tickets/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket updated" });
      setEditingId(null);
      setAdminNote("");
    },
    onError: () => toast({ title: "Error updating ticket", variant: "destructive" }),
  });

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) return;
    setSubmit(true);
    try {
      let attachmentName: string | undefined;
      let attachmentMimeType: string | undefined;
      let attachmentContent: string | undefined;

      if (file) {
        const reader = new FileReader();
        const b64 = await new Promise<string>((res, rej) => {
          reader.onload = (e) => res((e.target?.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        attachmentName     = file.name;
        attachmentMimeType = file.type || "application/octet-stream";
        attachmentContent  = b64;
      }

      await createMutation.mutateAsync({
        subject: subject.trim(),
        category,
        description: description.trim(),
        priority,
        attachmentName,
        attachmentMimeType,
        attachmentContent,
      });
    } finally {
      setSubmit(false);
    }
  }

  const openCount     = tickets.filter(t => t.status === "open").length;
  const progressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-4 flex flex-col min-h-[calc(100vh-130px)]">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#c8322b]" />
            <h1 className="text-xl font-bold">Payment Discrepancies</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Billing support &amp; payment dispute management
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#c8322b] gap-2" data-testid="button-new-ticket">
              <Plus className="w-4 h-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#c8322b]" />
                Submit a Payment Discrepancy
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input
                  placeholder="Brief description of the issue"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  data-testid="input-ticket-subject"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-ticket-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="billing">Billing / Facturación</SelectItem>
                      <SelectItem value="payment">Payment / Pago</SelectItem>
                      <SelectItem value="refund">Refund / Reembolso</SelectItem>
                      <SelectItem value="charge">Unrecognized Charge</SelectItem>
                      <SelectItem value="other">Other / Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger data-testid="select-ticket-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe the discrepancy in detail — amount, date, transaction ID, etc."
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                  className="resize-none min-h-[100px]"
                  data-testid="textarea-ticket-description"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment proof / Comprobante (optional)</Label>
                <div
                  className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover-elevate"
                  onClick={() => fileRef.current?.click()}
                  data-testid="zone-ticket-attachment"
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <Paperclip className="w-4 h-4 text-[#c8322b]" />
                      <span className="text-sm font-medium truncate max-w-[220px]">{file.name}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Paperclip className="w-5 h-5 mx-auto text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Attach receipt or payment proof — max 5 MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 5 * 1024 * 1024) {
                      toast({ title: "File too large", description: "Max 5 MB", variant: "destructive" });
                      return;
                    }
                    setFile(f);
                  }}
                />
              </div>
              <Button
                className="w-full bg-[#c8322b]"
                onClick={handleSubmit}
                disabled={!subject.trim() || !description.trim() || submitting}
                data-testid="button-submit-ticket"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Stats (admin) ── */}
      {isAdmin && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card>
            <CardContent className="px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{openCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Open</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{progressCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3 text-center">
              <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Resolved</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Ticket list ── */}
      <div className="flex-1 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <Shield className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No tickets submitted yet</p>
              <p className="text-xs text-muted-foreground/70">Click "New Ticket" to report a payment discrepancy</p>
            </CardContent>
          </Card>
        ) : (
          tickets.map(ticket => {
            const st  = STATUS_CONFIG[ticket.status]   ?? STATUS_CONFIG["open"];
            const pri = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG["medium"];
            const isExp = expanded === ticket.id;
            const StatusIcon = st.icon;

            return (
              <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`}>
                <CardContent className="px-4 py-3">
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpanded(isExp ? null : ticket.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticketId}</span>
                        <Badge className={`text-[10px] no-default-active-elevate gap-1 ${st.color}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {st.label}
                        </Badge>
                        <Badge className={`text-[10px] no-default-active-elevate ${pri.color}`}>
                          {pri.label}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold mt-1 truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                        </span>
                        {isAdmin && (
                          <span className="text-[11px] text-muted-foreground">· {ticket.submittedBy}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">· {fmtDate(ticket.createdAt)}</span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="flex-shrink-0 mt-0.5">
                      {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>

                  {isExp && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Description</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                      </div>

                      {ticket.attachmentName && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-md">
                          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium truncate">{ticket.attachmentName}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto no-default-active-elevate">
                            Attached
                          </Badge>
                        </div>
                      )}

                      {ticket.adminNote && (
                        <div className="px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-[11px] font-semibold text-blue-700 mb-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            Admin Response
                          </p>
                          <p className="text-xs text-blue-800 leading-relaxed">{ticket.adminNote}</p>
                        </div>
                      )}

                      {isAdmin && (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={ticket.status}
                              onValueChange={val =>
                                updateMutation.mutate({ id: ticket.id, patch: { status: val } })
                              }
                            >
                              <SelectTrigger className="text-xs" data-testid={`select-status-${ticket.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={ticket.priority}
                              onValueChange={val =>
                                updateMutation.mutate({ id: ticket.id, patch: { priority: val } })
                              }
                            >
                              <SelectTrigger className="text-xs" data-testid={`select-priority-${ticket.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {editingId === ticket.id ? (
                            <div className="space-y-2">
                              <Textarea
                                placeholder="Write admin response..."
                                value={adminNote}
                                onChange={e => setAdminNote(e.target.value)}
                                className="resize-none text-xs min-h-[70px]"
                                data-testid={`textarea-admin-note-${ticket.id}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-[#c8322b] text-xs"
                                  onClick={() =>
                                    updateMutation.mutate({ id: ticket.id, patch: { adminNote } })
                                  }
                                  disabled={updateMutation.isPending}
                                  data-testid={`button-save-note-${ticket.id}`}
                                >
                                  Save Response
                                </Button>
                                <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setEditingId(null); setAdminNote(""); }}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs w-full gap-1"
                              onClick={() => { setEditingId(ticket.id); setAdminNote(ticket.adminNote ?? ""); }}
                              data-testid={`button-reply-${ticket.id}`}
                            >
                              <MessageSquare className="w-3 h-3" />
                              {ticket.adminNote ? "Edit Response" : "Add Response"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Footer — Horario + Banxico Plus LLC ── */}
      <div className="mt-6 pt-4 border-t border-border">
        <Card className="bg-muted/30">
          <CardContent className="px-5 py-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#c8322b] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">Support Hours — Laredo, TX</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monday – Friday &nbsp;·&nbsp; <strong>8:00 AM – 5:30 PM</strong> (Laredo time, CST/CDT)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tickets submitted outside business hours are reviewed next business day.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 md:text-right">
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5 md:hidden" />
                <div>
                  <p className="text-xs font-bold text-foreground">Banxico Plus LLC</p>
                  <p className="text-[11px] text-muted-foreground">Laredo, Texas</p>
                  <p className="text-[11px] text-muted-foreground">United States</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
