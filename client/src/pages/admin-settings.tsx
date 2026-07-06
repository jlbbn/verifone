import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSystemSettings, useUpdateSettings } from "@/hooks/use-system-settings";
import { DEFAULT_SYSTEM_SETTINGS } from "@shared/schema";
import { DEFAULT_TERMINAL_PARAMS } from "@/hooks/use-terminal-params";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PosAssignmentManager, statusBadgeClass, type TerminalRecord, type UserRecord } from "@/components/pos-assignment-manager";
import {
  Save, RotateCcw, Plus, Trash2, Loader2,
  Globe, Banknote, Activity, BarChart2, MonitorSmartphone,
  Terminal, Info
} from "lucide-react";
import type { SystemSettings } from "@shared/schema";

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useSystemSettings();
  const { mutate: saveSettings, isPending } = useUpdateSettings();
  const { toast } = useToast();

  const { data: allTerminals = [], isLoading: terminalsLoading } = useQuery<TerminalRecord[]>({
    queryKey: ["/api/terminals"],
  });
  const { data: allUsers = [] } = useQuery<UserRecord[]>({
    queryKey: ["/api/users"],
  });

  const [draft, setDraft] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setDraft(JSON.parse(JSON.stringify(settings)));
      setIsDirty(false);
    }
  }, [settings]);

  function set<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setIsDirty(true);
  }

  function handleSave() {
    saveSettings(draft, {
      onSuccess: () => {
        setIsDirty(false);
        toast({ title: "Configuración guardada", description: "Los cambios ya son visibles para todos los usuarios." });
      },
      onError: (e) => {
        toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
      },
    });
  }

  function handleDiscard() {
    if (settings) {
      setDraft(JSON.parse(JSON.stringify(settings)));
      setIsDirty(false);
    }
  }

  // ── Ticker helpers ──────────────────────────────────────────────────────────
  function updateTickerItem(idx: number, field: "symbol" | "value", val: string) {
    const next = draft.tickerItems.map((item, i) =>
      i === idx ? { ...item, [field]: val } : item
    );
    set("tickerItems", next);
  }
  function addTickerItem() {
    set("tickerItems", [...draft.tickerItems, { symbol: "", value: "" }]);
  }
  function removeTickerItem(idx: number) {
    set("tickerItems", draft.tickerItems.filter((_, i) => i !== idx));
  }

  // ── Feed terminales helpers ─────────────────────────────────────────────────
  function updateTerminal(idx: number, val: string) {
    const next = draft.feedTerminales.map((t, i) => i === idx ? val : t);
    set("feedTerminales", next);
  }
  function addTerminal() {
    set("feedTerminales", [...draft.feedTerminales, ""]);
  }
  function removeTerminal(idx: number) {
    set("feedTerminales", draft.feedTerminales.filter((_, i) => i !== idx));
  }
  function toggleFeedTerminal(terminalId: string, active: boolean) {
    if (active) {
      if (!draft.feedTerminales.includes(terminalId)) {
        set("feedTerminales", [...draft.feedTerminales, terminalId]);
      }
    } else {
      set("feedTerminales", draft.feedTerminales.filter(t => t !== terminalId));
    }
  }
  function ownerLabel(username: string | null) {
    if (!username) return null;
    return allUsers.find(u => u.username === username)?.fullName ?? username;
  }
  const registeredTerminalIds = new Set(allTerminals.map(t => t.terminalId));
  const customFeedEntries = draft.feedTerminales
    .map((value, idx) => ({ value, idx }))
    .filter(({ value }) => !registeredTerminalIds.has(value));

  // ── Terminal params helpers ─────────────────────────────────────────────────
  function getParamValue(label: string) {
    return draft.terminalParams.find(p => p.label === label)?.value ?? "";
  }
  function setParamValue(label: string, value: string) {
    const exists = draft.terminalParams.find(p => p.label === label);
    const next = exists
      ? draft.terminalParams.map(p => p.label === label ? { ...p, value } : p)
      : [...draft.terminalParams, { label, value }];
    set("terminalParams", next);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groups = ["Identificación", "Operación", "Funcionalidades"];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración del Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Los cambios se reflejan inmediatamente para todos los usuarios suscritos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">
              Cambios sin guardar
            </Badge>
          )}
          <Button variant="outline" size="default" onClick={handleDiscard} disabled={!isDirty} data-testid="button-discard">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || isPending} data-testid="button-save">
            {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex gap-2 items-start p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          Los valores configurados aquí controlan lo que ven todos los usuarios: tipo de cambio en recibos,
          montos en el feed en vivo, items del ticker financiero y parámetros de la terminal POS.
        </span>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6 w-full justify-start flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="general" className="gap-1.5">
            <Globe className="w-3.5 h-3.5" />General
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5">
            <Banknote className="w-3.5 h-3.5" />Balances
          </TabsTrigger>
          <TabsTrigger value="feed" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />Feed en Vivo
          </TabsTrigger>
          <TabsTrigger value="ticker" className="gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" />Ticker
          </TabsTrigger>
          <TabsTrigger value="terminal" className="gap-1.5">
            <MonitorSmartphone className="w-3.5 h-3.5" />Terminal
          </TabsTrigger>
          <TabsTrigger value="pos-asignadas" className="gap-1.5">
            <Terminal className="w-3.5 h-3.5" />POS Asignadas
          </TabsTrigger>
        </TabsList>

        {/* ── GENERAL ─────────────────────────────────────────────────────── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Información General del Comercio</CardTitle>
              <CardDescription>
                Datos que aparecen en recibos POS, reportes y cabeceras de transacciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="merchantName">Nombre del Comercio</Label>
                  <Input
                    id="merchantName"
                    value={draft.merchantName}
                    onChange={e => set("merchantName", e.target.value)}
                    placeholder="GRUPO ASGE VENADO 69"
                    data-testid="input-merchant-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="merchantCity">Ciudad / Estado</Label>
                  <Input
                    id="merchantCity"
                    value={draft.merchantCity}
                    onChange={e => set("merchantCity", e.target.value)}
                    placeholder="CANCUN Q.ROO"
                    data-testid="input-merchant-city"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="afiliacion">Número de Afiliación</Label>
                  <Input
                    id="afiliacion"
                    value={draft.afiliacion}
                    onChange={e => set("afiliacion", e.target.value)}
                    placeholder="7705397"
                    data-testid="input-afiliacion"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tipoCambio">Tipo de Cambio MXN / USD</Label>
                  <div className="relative">
                    <Input
                      id="tipoCambio"
                      type="number"
                      step="0.01"
                      min="1"
                      value={draft.tipoCambio}
                      onChange={e => set("tipoCambio", parseFloat(e.target.value) || 17.50)}
                      data-testid="input-tipo-cambio"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">MXN</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aparece en recibos USD+MXN del POS. Ej: {fmtUSD(1000)} USD → {fmtUSD(1000 * draft.tipoCambio)} MXN
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fxRateEUR">Tipo de Cambio EUR / USD</Label>
                  <div className="relative">
                    <Input
                      id="fxRateEUR"
                      type="number"
                      step="0.001"
                      min="0.01"
                      value={draft.fxRateEUR}
                      onChange={e => set("fxRateEUR", parseFloat(e.target.value) || DEFAULT_SYSTEM_SETTINGS.fxRateEUR)}
                      data-testid="input-fx-eur"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USD</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado para convertir transacciones en EUR a USD en Caja. Ej: €1.00 → ${draft.fxRateEUR.toFixed(3)} USD
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fxRateGBP">Tipo de Cambio GBP / USD</Label>
                  <div className="relative">
                    <Input
                      id="fxRateGBP"
                      type="number"
                      step="0.001"
                      min="0.01"
                      value={draft.fxRateGBP}
                      onChange={e => set("fxRateGBP", parseFloat(e.target.value) || DEFAULT_SYSTEM_SETTINGS.fxRateGBP)}
                      data-testid="input-fx-gbp"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USD</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado para convertir transacciones en GBP a USD en Caja. Ej: £1.00 → ${draft.fxRateGBP.toFixed(3)} USD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-5 border-amber-300 dark:border-amber-800">
            <CardHeader>
              <CardTitle>Mantenimiento Global</CardTitle>
              <CardDescription>
                Al activarlo, todos los usuarios (excepto administradores) verán una pantalla de mantenimiento y no podrán operar el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenanceMode">Sistema en mantenimiento</Label>
                  <p className="text-xs text-muted-foreground">
                    {draft.maintenanceMode
                      ? "Activo — los usuarios ven la pantalla de mantenimiento ahora mismo"
                      : "Inactivo — el sistema opera con normalidad para todos los usuarios"}
                  </p>
                </div>
                <Switch
                  id="maintenanceMode"
                  checked={draft.maintenanceMode}
                  onCheckedChange={(checked) => set("maintenanceMode", checked)}
                  data-testid="switch-maintenance-mode"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BALANCES ────────────────────────────────────────────────────── */}
        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Balances del Sistema</CardTitle>
              <CardDescription>
                Saldos mostrados en el dashboard y en la vista de caja del administrador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="saldoApertura">Saldo de Apertura de Caja (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      id="saldoApertura"
                      type="number"
                      step="100"
                      min="0"
                      className="pl-6"
                      value={draft.saldoAperturaUSD}
                      onChange={e => set("saldoAperturaUSD", parseFloat(e.target.value) || 0)}
                      data-testid="input-saldo-apertura"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saldo base en la caja del admin. Actualmente: <strong>${fmtUSD(draft.saldoAperturaUSD)} USD</strong>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="saldoSistema">Saldo del Sistema (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      id="saldoSistema"
                      type="number"
                      step="1000"
                      min="0"
                      className="pl-6"
                      value={draft.saldoSistemaUSD}
                      onChange={e => set("saldoSistemaUSD", parseFloat(e.target.value) || 0)}
                      data-testid="input-saldo-sistema"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saldo total visible en el dashboard. Actualmente: <strong>${fmtUSD(draft.saldoSistemaUSD)} USD</strong>
                  </p>
                </div>
              </div>
              <Separator className="my-5" />
              <div className="rounded-md bg-muted/50 p-4 text-sm space-y-1">
                <p className="font-medium">Vista previa — Caja Administrador</p>
                <p className="text-muted-foreground">Saldo apertura: <span className="font-mono text-foreground">${fmtUSD(draft.saldoAperturaUSD)} USD</span></p>
                <p className="text-muted-foreground">Saldo sistema: <span className="font-mono text-foreground">${fmtUSD(draft.saldoSistemaUSD)} USD</span></p>
                <p className="text-muted-foreground">En MXN ({draft.tipoCambio}): <span className="font-mono text-foreground">${fmtUSD(draft.saldoSistemaUSD * draft.tipoCambio)} MXN</span></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FEED EN VIVO ─────────────────────────────────────────────────── */}
        <TabsContent value="feed">
          <Card>
            <CardHeader>
              <CardTitle>Feed en Vivo</CardTitle>
              <CardDescription>
                Montos y comercios que los usuarios suscriptores ven en su panel de caja
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Merchants */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Nombres de Comercios</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Comercio 1 (Merchant A)</Label>
                    <Input
                      value={draft.feedMerchant1}
                      onChange={e => set("feedMerchant1", e.target.value)}
                      placeholder="GRUPO ASGE VENADO 69"
                      data-testid="input-feed-merchant1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comercio 2 (Merchant B)</Label>
                    <Input
                      value={draft.feedMerchant2}
                      onChange={e => set("feedMerchant2", e.target.value)}
                      placeholder="BANXICO PLUS CANCUN"
                      data-testid="input-feed-merchant2"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Amounts */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Montos de Transacciones</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>POS Regular (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="10000"
                        min="0"
                        className="pl-6"
                        value={draft.feedPosRegularUSD}
                        onChange={e => set("feedPosRegularUSD", parseFloat(e.target.value) || 0)}
                        data-testid="input-feed-pos"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmtUSD(draft.feedPosRegularUSD)} USD · ~{fmtUSD(draft.feedPosRegularUSD * draft.tipoCambio)} MXN
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Venta Forzada 1643 (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="1000"
                        min="0"
                        className="pl-6"
                        value={draft.feed1643USD}
                        onChange={e => set("feed1643USD", parseFloat(e.target.value) || 0)}
                        data-testid="input-feed-1643"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-amber-600 dark:text-amber-400">
                      Protocolo 1643 — amber
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Visa Network 101.1 (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="100000"
                        min="0"
                        className="pl-6"
                        value={draft.feedVisaNet101USD}
                        onChange={e => set("feedVisaNet101USD", parseFloat(e.target.value) || 0)}
                        data-testid="input-feed-visanet"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-blue-600 dark:text-blue-400">
                      Protocolo 101.1 — navy, hace 1 semana
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Terminals */}
              <div>
                <h3 className="text-sm font-semibold mb-1">Terminales Activas en el Feed</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Activa o desactiva las terminales registradas en Enrutamiento POS para que aparezcan en el feed en vivo.
                </p>

                {terminalsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : allTerminals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay terminales registradas en Enrutamiento POS.</p>
                ) : (
                  <div className="space-y-2">
                    {allTerminals.map(term => {
                      const active = draft.feedTerminales.includes(term.terminalId);
                      return (
                        <div key={term.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-semibold text-sm">{term.terminalId}</span>
                              <Badge className={`${statusBadgeClass(term.status)} no-default-active-elevate text-xs`}>
                                {term.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {term.model} · {term.location} ·{" "}
                              {term.owner
                                ? <span>Asignada a <span className="text-foreground font-medium">{ownerLabel(term.owner)}</span></span>
                                : <span>Sin asignar</span>}
                            </p>
                          </div>
                          <Switch
                            checked={active}
                            onCheckedChange={(v) => toggleFeedTerminal(term.terminalId, v)}
                            data-testid={`switch-feed-terminal-${term.id}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator className="my-4" />

                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IDs Manuales Adicionales</h4>
                  <Button variant="outline" size="sm" onClick={addTerminal} data-testid="button-add-terminal">
                    <Plus className="w-3.5 h-3.5 mr-1" />Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {customFeedEntries.map(({ value, idx }) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={value}
                        onChange={e => updateTerminal(idx, e.target.value)}
                        placeholder="T1001"
                        className="font-mono"
                        data-testid={`input-terminal-${idx}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeTerminal(idx)}
                        data-testid={`button-remove-terminal-${idx}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {customFeedEntries.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay IDs manuales adicionales.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TICKER ──────────────────────────────────────────────────────── */}
        <TabsContent value="ticker">
          <Card>
            <CardHeader>
              <CardTitle>Ticker Financiero</CardTitle>
              <CardDescription>
                Items que aparecen en la barra animada en la parte superior de la plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-md overflow-hidden border border-border">
                <div className="bg-black px-4 py-2 flex gap-6 overflow-hidden">
                  {draft.tickerItems.slice(0, 5).map((item, i) => (
                    <span key={i} className="text-white text-xs whitespace-nowrap flex items-center gap-1.5">
                      <span className="text-[#c8322b]">●</span>
                      <span className="font-semibold">{item.symbol || "SYM"}:</span>
                      <span>{item.value || "—"}</span>
                    </span>
                  ))}
                  {draft.tickerItems.length > 5 && (
                    <span className="text-gray-500 text-xs whitespace-nowrap">+{draft.tickerItems.length - 5} más...</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Símbolo</span>
                  <span>Valor</span>
                  <span className="w-9" />
                </div>
                {draft.tickerItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input
                      value={item.symbol}
                      onChange={e => updateTickerItem(i, "symbol", e.target.value)}
                      placeholder="BTC/USD"
                      className="font-mono text-sm"
                      data-testid={`input-ticker-symbol-${i}`}
                    />
                    <Input
                      value={item.value}
                      onChange={e => updateTickerItem(i, "value", e.target.value)}
                      placeholder="$54,325.75"
                      className="font-mono text-sm"
                      data-testid={`input-ticker-value-${i}`}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeTickerItem(i)}
                      data-testid={`button-remove-ticker-${i}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={addTickerItem} data-testid="button-add-ticker">
                <Plus className="w-4 h-4 mr-1.5" />
                Agregar item al ticker
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TERMINAL ────────────────────────────────────────────────────── */}
        <TabsContent value="terminal">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros de Terminal POS</CardTitle>
              <CardDescription>
                Valores que aparecen en el REPORTE PARAMETROS del POS Virtual (FUNCIONES &gt; 1. REPORTE PARAMETROS)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {groups.map(group => {
                const params = DEFAULT_TERMINAL_PARAMS.filter(p => p.group === group);
                return (
                  <div key={group}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {group}
                    </h3>
                    <div className="space-y-3">
                      {params.map(meta => {
                        const val = getParamValue(meta.label);
                        return (
                          <div key={meta.label} className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <Label className={`text-xs font-mono ${meta.highlight ? "text-green-600 dark:text-green-400 font-semibold" : ""}`}>
                                {meta.label}
                              </Label>
                            </div>
                            <div className="flex-shrink-0 w-52">
                              {meta.type === "toggle" ? (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={val === "SI"}
                                    onCheckedChange={checked => setParamValue(meta.label, checked ? "SI" : "NO")}
                                    data-testid={`toggle-param-${meta.label.toLowerCase().replace(/\s/g, "-")}`}
                                  />
                                  <span className={`text-xs font-mono font-bold ${val === "SI" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                                    {val || "—"}
                                  </span>
                                </div>
                              ) : meta.type === "select" ? (
                                <Select value={val} onValueChange={v => setParamValue(meta.label, v)}>
                                  <SelectTrigger className="h-8 text-xs font-mono" data-testid={`select-param-${meta.label.toLowerCase().replace(/\s/g, "-")}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(meta.options ?? []).map(opt => (
                                      <SelectItem key={opt} value={opt} className="text-xs font-mono">{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={val}
                                  onChange={e => setParamValue(meta.label, e.target.value)}
                                  className="h-8 text-xs font-mono"
                                  data-testid={`input-param-${meta.label.toLowerCase().replace(/\s/g, "-")}`}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {group !== groups[groups.length - 1] && <Separator className="mt-4" />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── POS ASIGNADAS ───────────────────────────────────────────────── */}
        <TabsContent value="pos-asignadas">
          <PosAssignmentManager />
        </TabsContent>
      </Tabs>

      {/* Sticky save bar when dirty */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-background border border-border shadow-lg rounded-lg px-5 py-3">
            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Tienes cambios sin guardar</span>
            <Button variant="outline" size="sm" onClick={handleDiscard}>Descartar</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
