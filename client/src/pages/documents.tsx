import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText, Upload, Download, Trash2, FileImage, Shield, Lock,
  FolderOpen, File, AlertTriangle, CheckCircle, RefreshCw,
} from "lucide-react";

type DocMeta = {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
};

type DocWithContent = DocMeta & { content: string };

const CATEGORIES = [
  { value: "all",       label: "Todos" },
  { value: "contract",  label: "Contratos" },
  { value: "financial", label: "Financieros" },
  { value: "identity",  label: "Identidad / KYC" },
  { value: "other",     label: "Otros" },
];

const CAT_LABELS: Record<string, string> = {
  contract:  "Contrato",
  financial: "Financiero",
  identity:  "Identidad",
  other:     "Otro",
};

const CAT_COLORS: Record<string, string> = {
  contract:  "bg-blue-100 text-blue-800 border-blue-200",
  financial: "bg-green-100 text-green-700 border-green-200",
  identity:  "bg-purple-100 text-purple-800 border-purple-200",
  other:     "bg-muted text-muted-foreground border-border",
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf")
    return <FileText className="w-8 h-8 text-[#c8322b]" />;
  if (mimeType.startsWith("image/"))
    return <FileImage className="w-8 h-8 text-green-600" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <File className="w-8 h-8 text-emerald-600" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="w-8 h-8 text-blue-600" />;
  return <File className="w-8 h-8 text-muted-foreground" />;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "ADMIN";

  const [activeTab, setActiveTab]     = useState("all");
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [docName, setDocName]         = useState("");
  const [docCategory, setDocCategory] = useState("contract");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isLoading } = useQuery<DocMeta[]>({
    queryKey: ["/api/documents"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Documento eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const filtered = activeTab === "all" ? docs : docs.filter(d => d.category === activeTab);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo demasiado grande", description: "Máximo 5 MB", variant: "destructive" });
      return;
    }
    setSelectedFile(f);
    if (!docName) setDocName(f.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleUpload() {
    if (!selectedFile || !docName.trim()) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        await apiRequest("POST", "/api/documents", {
          name:     docName.trim(),
          category: docCategory,
          mimeType: selectedFile.type || "application/octet-stream",
          size:     selectedFile.size,
          content:  base64,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        toast({ title: "Documento subido", description: docName });
        setUploadOpen(false);
        setSelectedFile(null);
        setDocName("");
        setDocCategory("contract");
        setUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      toast({ title: "Error al subir", variant: "destructive" });
      setUploading(false);
    }
  }

  async function handleDownload(doc: DocMeta) {
    try {
      const full: DocWithContent = await apiRequest("GET", `/api/documents/${doc.id}/download`).then(r => r.json());
      const byteChars = atob(full.content);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: full.mimeType });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement("a"), { href: url, download: full.name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error al descargar", variant: "destructive" });
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#c8322b]" />
            <h1 className="text-xl font-bold">Documentos Seguros</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Almacenamiento cifrado de contratos y registros financieros
          </p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#c8322b] gap-2" data-testid="button-upload-doc">
              <Upload className="w-4 h-4" />
              Subir documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#c8322b]" />
                Subir documento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              {/* File picker */}
              <div
                className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover-elevate"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-file"
              >
                {selectedFile ? (
                  <div className="space-y-1">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium">Seleccionar archivo</p>
                    <p className="text-xs text-muted-foreground">PDF, imagen, Excel, Word · máx. 5 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.xlsx,.xls,.csv,.doc,.docx,.txt"
                onChange={handleFileSelect}
                data-testid="input-file"
              />

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="doc-name">Nombre del documento</Label>
                <Input
                  id="doc-name"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder="Ej. Contrato Patricio Arroyo 2025"
                  data-testid="input-doc-name"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger data-testid="select-doc-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="financial">Financiero</SelectItem>
                    <SelectItem value="identity">Identidad / KYC</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Security note */}
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-md">
                <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <p className="text-[10px] text-muted-foreground">
                  Almacenado con cifrado AES-256. Acceso restringido al propietario y administrador.
                </p>
              </div>

              <Button
                className="w-full bg-[#c8322b] gap-2"
                onClick={handleUpload}
                disabled={!selectedFile || !docName.trim() || uploading}
                data-testid="button-confirm-upload"
              >
                {uploading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Subiendo...</>
                  : <><Upload className="w-4 h-4" /> Subir documento</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Security banner ── */}
      <Card className="border-green-200 bg-green-50/60">
        <CardContent className="flex items-center gap-3 py-3 px-4">
          <Lock className="w-4 h-4 text-green-700 flex-shrink-0" />
          <p className="text-xs text-green-800 leading-relaxed">
            <strong>Almacenamiento seguro activo</strong> — Cifrado AES-256 · Acceso basado en roles ·
            Auditoría de accesos · Cumplimiento PCI DSS
          </p>
        </CardContent>
      </Card>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Todos",      count: docs.length,                                     color: "text-foreground" },
          { label: "Contratos",  count: docs.filter(d => d.category === "contract").length,  color: "text-blue-700" },
          { label: "Financieros",count: docs.filter(d => d.category === "financial").length, color: "text-green-700" },
          { label: "Identidad",  count: docs.filter(d => d.category === "identity").length,  color: "text-purple-700" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="px-4 py-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Category tabs ── */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setActiveTab(c.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === c.value
                ? "bg-[#c8322b] text-white"
                : "bg-muted text-muted-foreground hover-elevate"
            }`}
            data-testid={`tab-${c.value}`}
          >
            {c.label}
            <span className="ml-1.5 opacity-70">
              ({c.value === "all" ? docs.length : docs.filter(d => d.category === c.value).length})
            </span>
          </button>
        ))}
      </div>

      {/* ── Document list ── */}
      <Card>
        <CardContent className="px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-[#c8322b]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Sin documentos</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {activeTab === "all"
                  ? "Sube tu primer documento usando el botón de arriba"
                  : `No hay documentos en la categoría "${CATEGORIES.find(c => c.value === activeTab)?.label}"`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 py-3"
                  data-testid={`row-doc-${doc.id}`}
                >
                  <div className="flex-shrink-0">
                    <FileIcon mimeType={doc.mimeType} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-doc-name-${doc.id}`}>
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`text-[10px] no-default-active-elevate ${CAT_COLORS[doc.category] ?? CAT_COLORS.other}`}>
                        {CAT_LABELS[doc.category] ?? "Otro"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{fmtSize(doc.size)}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(doc.createdAt)}</span>
                      {isAdmin && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {doc.uploadedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDownload(doc)}
                      data-testid={`button-download-${doc.id}`}
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {(isAdmin || doc.uploadedBy === user?.username) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${doc.id}`}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Security info ── */}
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Políticas de seguridad</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {[
                  "Cifrado en tránsito y en reposo (AES-256)",
                  "Acceso restringido por rol de usuario",
                  "Registros de auditoría por cada descarga",
                  "Retención de documentos: 5 años mínimo",
                  "Formato soportado: PDF, imagen, Excel, Word",
                  "Tamaño máximo por archivo: 5 MB",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
