import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Wifi, Signal, Nfc, Battery, Printer, CreditCard, Terminal,
  Delete, RotateCcw, FlaskConical, Receipt, CheckCircle, XCircle,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ScreenState = "IDLE" | "MONTO" | "TARJETA" | "PROCESANDO" | "APROBADO" | "DECLINADO";
type TerminalModel = "VX520" | "P400" | "E280S";
type EntryMode = "CHIP" | "CTLS" | "BANDA";

interface TerminalConfig {
  model: TerminalModel;
  merchant: string;
  terminalId: string;
  currency: "MXN" | "USD";
  tipPercent: number;
  cardNumber: string;
  holderName: string;
  expDate: string;
  protocol: string;
  authCode: string;
  brightness: number;
  paperLevel: number;
  wifi: boolean;
  gprs: boolean;
  contactless: boolean;
  forceDecline: boolean;
}

const MODEL_STYLES: Record<TerminalModel, { body: string; edge: string; screen: string; label: string }> = {
  VX520: { body: "bg-gradient-to-b from-[#3a4250] to-[#23282f]", edge: "border-[#14171c]", screen: "bg-[#b8d94e]", label: "Verifone VX520" },
  P400:  { body: "bg-gradient-to-b from-[#1c1e24] to-[#0c0d10]", edge: "border-[#000000]", screen: "bg-[#0d2237]", label: "Verifone P400" },
  E280S: { body: "bg-gradient-to-b from-[#e6e8ec] to-[#c9ccd4]", edge: "border-[#9aa0ab]", screen: "bg-[#123a2a]", label: "Verifone e280s" },
};

const PROTOCOLS = ["101.1", "101.2", "201.1", "201.2", "301.1", "401.1", "1643"];

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function digitsToAmount(digits: string) {
  return digits ? parseInt(digits, 10) / 100 : 0;
}
function randNum(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10).toString()).join("");
}
function maskCard(s: string) {
  const c = s.replace(/\D/g, "");
  if (!c) return "**** **** **** ****";
  return c.replace(/.(?=.{4})/g, "*").replace(/(.{4})/g, "$1 ").trim();
}

const DEFAULT_CONFIG: TerminalConfig = {
  model: "VX520",
  merchant: "BANXICO PLUS DEMO",
  terminalId: "VF-88421056",
  currency: "MXN",
  tipPercent: 0,
  cardNumber: "4040310011384895",
  holderName: "CLIENTE DEMO",
  expDate: "02/27",
  protocol: "101.1",
  authCode: "",
  brightness: 80,
  paperLevel: 65,
  wifi: true,
  gprs: true,
  contactless: true,
  forceDecline: false,
};

// ─── Página ───────────────────────────────────────────────────────────────────
export default function VerifoneDevPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<TerminalConfig>(DEFAULT_CONFIG);
  const [screen, setScreen] = useState<ScreenState>("IDLE");
  const [amountDigits, setAmountDigits] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [lastAuth, setLastAuth] = useState<{ code: string; ref: string; time: string; total: number; approved: boolean } | null>(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const set = <K extends keyof TerminalConfig>(key: K, value: TerminalConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const amount = digitsToAmount(amountDigits);
  const tip = amount * (config.tipPercent / 100);
  const total = amount + tip;
  const style = MODEL_STYLES[config.model];
  const isLight = config.model === "E280S";
  const screenDark = config.model !== "VX520";
  const dim = config.brightness / 100;

  // ── Flujo del terminal ──────────────────────────────────────────────────────
  function pressDigit(d: string) {
    if (screen === "IDLE") setScreen("MONTO");
    if (screen !== "MONTO" && screen !== "IDLE") return;
    setAmountDigits((prev) => (prev.length >= 9 ? prev : prev + d));
  }
  function pressClear() {
    if (screen === "MONTO" || screen === "IDLE") setAmountDigits((prev) => prev.slice(0, -1));
  }
  function pressCancel() {
    setScreen("IDLE");
    setAmountDigits("");
    setEntryMode(null);
  }
  function pressEnter() {
    if (screen === "MONTO" && amount > 0) setScreen("TARJETA");
    else if (screen === "TARJETA" && entryMode) runAuthorization();
    else if (screen === "APROBADO" || screen === "DECLINADO") pressCancel();
  }
  function runAuthorization() {
    setScreen("PROCESANDO");
    setTimeout(() => {
      const approved = !config.forceDecline;
      const code = config.authCode.trim() || randNum(6);
      setLastAuth({
        code,
        ref: `VF${randNum(10)}`,
        time: new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", hour12: false }),
        total,
        approved,
      });
      setScreen(approved ? "APROBADO" : "DECLINADO");
      if (approved) toast({ title: "Venta aprobada", description: `Auth ${code} · ${config.currency} $${fmt(total)}` });
    }, 1600);
  }

  const screenText = useMemo(() => ({
    primary: screenDark ? "text-emerald-300" : "text-[#1a3d0a]",
    secondary: screenDark ? "text-emerald-500/70" : "text-[#1a3d0a]/70",
  }), [screenDark]);

  // ── Pantalla LCD ────────────────────────────────────────────────────────────
  function renderScreen() {
    const p = screenText.primary;
    const s = screenText.secondary;
    switch (screen) {
      case "IDLE":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className={`text-[10px] font-bold tracking-widest ${p}`}>{config.merchant}</p>
            <p className={`text-[9px] ${s}`}>TERMINAL {config.terminalId}</p>
            <p className={`text-xs font-bold mt-3 ${p}`}>BIENVENIDO</p>
            <p className={`text-[9px] ${s}`}>INGRESE MONTO PARA INICIAR</p>
          </div>
        );
      case "MONTO":
        return (
          <div className="flex flex-col h-full justify-between">
            <p className={`text-[9px] font-bold ${s}`}>VENTA · PROTOCOLO {config.protocol}</p>
            <div className="text-right">
              <p className={`text-[9px] ${s}`}>MONTO {config.currency}</p>
              <p className={`text-2xl font-bold font-mono ${p}`}>$ {fmt(amount)}</p>
              {config.tipPercent > 0 && (
                <p className={`text-[9px] ${s}`}>PROPINA {config.tipPercent}% · TOTAL $ {fmt(total)}</p>
              )}
            </div>
            <p className={`text-[8px] ${s}`}>ENTER = CONTINUAR · X = CANCELAR</p>
          </div>
        );
      case "TARJETA":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className={`text-[10px] font-bold ${p}`}>INSERTE / ACERQUE TARJETA</p>
            <p className={`text-xl font-mono font-bold ${p}`}>$ {fmt(total)}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setEntryMode("CHIP")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "CHIP" ? "bg-white/25" : ""} ${p}`}>CHIP</button>
              {config.contactless && (
                <button onClick={() => setEntryMode("CTLS")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "CTLS" ? "bg-white/25" : ""} ${p}`}>CTLS</button>
              )}
              <button onClick={() => setEntryMode("BANDA")} className={`px-2 py-0.5 rounded text-[8px] font-bold border ${entryMode === "BANDA" ? "bg-white/25" : ""} ${p}`}>BANDA</button>
            </div>
            {entryMode && <p className={`text-[8px] mt-1 ${s}`}>{maskCard(config.cardNumber)} · ENTER PARA AUTORIZAR</p>}
          </div>
        );
      case "PROCESANDO":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className={`text-[10px] font-bold ${p} animate-pulse`}>PROCESANDO...</p>
            <p className={`text-[8px] ${s}`}>CONECTANDO CON AUTORIZADOR</p>
            <p className={`text-[8px] font-mono ${s}`}>ISO 8583 · 0200 · {config.protocol}</p>
          </div>
        );
      case "APROBADO":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <CheckCircle className={`w-6 h-6 ${p}`} />
            <p className={`text-sm font-bold ${p}`}>APROBADA</p>
            <p className={`text-[9px] font-mono ${s}`}>AUTH: {lastAuth?.code}</p>
            <p className={`text-[9px] font-mono ${s}`}>REF: {lastAuth?.ref}</p>
            <p className={`text-[8px] mt-1 ${s}`}>ENTER PARA NUEVA VENTA</p>
          </div>
        );
      case "DECLINADO":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <XCircle className={`w-6 h-6 ${p}`} />
            <p className={`text-sm font-bold ${p}`}>DECLINADA</p>
            <p className={`text-[9px] font-mono ${s}`}>RESP: 05 · NO AUTORIZADA</p>
            <p className={`text-[8px] mt-1 ${s}`}>ENTER PARA REINTENTAR</p>
          </div>
        );
    }
  }

  // ── Teclado ─────────────────────────────────────────────────────────────────
  const keyBtn = (label: React.ReactNode, onClick: () => void, extra = "") => (
    <button
      onClick={onClick}
      className={`h-9 rounded-md font-bold text-sm shadow-[0_2px_0_rgba(0,0,0,0.45)] active:translate-y-[1px] active:shadow-none transition-all ${isLight ? "bg-white text-gray-800 hover:bg-gray-50" : "bg-[#4a5260] text-white hover:bg-[#555e6d]"} ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#c8322b]/10 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-[#c8322b]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Verifone Dev Studio</h1>
            <p className="text-xs text-muted-foreground">Emulador visual de terminal — ajusta parámetros y observa el POS en tiempo real</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-300 bg-amber-50">
          <FlaskConical className="w-3 h-3" /> Entorno de desarrollo
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* ── Terminal visual ── */}
        <div className="flex flex-col items-center gap-6">
          <div className={`w-[320px] rounded-[28px] border-4 ${style.edge} ${style.body} p-4 shadow-2xl`} data-testid="verifone-device">
            {/* Marca */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className={`text-[10px] font-black italic tracking-wider ${isLight ? "text-[#1b5e3a]" : "text-white/80"}`}>Verifone</span>
              <span className={`text-[8px] font-mono ${isLight ? "text-gray-500" : "text-white/40"}`}>{style.label}</span>
            </div>

            {/* Barra de estado */}
            <div className={`rounded-t-lg ${style.screen} px-2 pt-1.5`} style={{ filter: `brightness(${0.55 + dim * 0.55})` }}>
              <div className={`flex items-center justify-between ${screenText.secondary}`}>
                <div className="flex items-center gap-1.5">
                  {config.wifi && <Wifi className="w-2.5 h-2.5" />}
                  {config.gprs && <Signal className="w-2.5 h-2.5" />}
                  {config.contactless && <Nfc className="w-2.5 h-2.5" />}
                </div>
                <span className="text-[8px] font-mono">
                  {clock.toLocaleTimeString("es-MX", { hour12: false, timeZone: "America/Mexico_City" })}
                </span>
                <Battery className="w-2.5 h-2.5" />
              </div>
            </div>

            {/* LCD */}
            <div className={`${style.screen} rounded-b-lg h-[180px] p-3 font-mono mb-3 border-t-0 border border-black/40`} style={{ filter: `brightness(${0.55 + dim * 0.55})` }} data-testid="verifone-screen">
              {renderScreen()}
            </div>

            {/* Slot de tarjeta */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="flex-1 h-1.5 rounded-full bg-black/60" />
              <CreditCard className={`w-3.5 h-3.5 ${isLight ? "text-gray-500" : "text-white/40"}`} />
            </div>

            {/* Teclado */}
            <div className="grid grid-cols-4 gap-1.5" data-testid="verifone-keypad">
              {["1","2","3"].map(d => keyBtn(d, () => pressDigit(d)))}
              {keyBtn("✕", pressCancel, "bg-[#c8322b] hover:bg-[#a82520] text-white")}
              {["4","5","6"].map(d => keyBtn(d, () => pressDigit(d)))}
              {keyBtn(<Delete className="w-4 h-4 mx-auto" />, pressClear, "bg-[#e0a800] hover:bg-[#c29100] text-white")}
              {["7","8","9"].map(d => keyBtn(d, () => pressDigit(d)))}
              {keyBtn("✓", pressEnter, "bg-[#2e7d32] hover:bg-[#256629] text-white")}
              {keyBtn("0", () => pressDigit("0"), "col-span-2")}
              {keyBtn("00", () => { pressDigit("0"); pressDigit("0"); })}
              {keyBtn(<RotateCcw className="w-4 h-4 mx-auto" />, pressCancel)}
            </div>
          </div>

          {/* Ticket / recibo */}
          <Card className="w-[320px]" data-testid="verifone-receipt">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#c8322b]" /> Último comprobante
              </CardTitle>
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Printer className="w-3 h-3" /> Papel: {config.paperLevel}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lastAuth ? (
                <div className="bg-[#fdfaf3] border rounded p-3 font-mono text-[10px] leading-relaxed text-gray-800">
                  <p className="text-center font-bold">{config.merchant}</p>
                  <p className="text-center">TERMINAL: {config.terminalId}</p>
                  <p className="text-center">{style.label.toUpperCase()} · {config.protocol}</p>
                  <Separator className="my-2" />
                  <p>TARJETA: {maskCard(config.cardNumber)}</p>
                  <p>TITULAR: {config.holderName.toUpperCase()}</p>
                  <p>EXP: {config.expDate} · MODO: {entryMode ?? "—"}</p>
                  <Separator className="my-2" />
                  <p>IMPORTE:  $ {fmt(amount)}</p>
                  {config.tipPercent > 0 && <p>PROPINA:  $ {fmt(tip)}</p>}
                  <p className="font-bold">TOTAL {config.currency}: $ {fmt(lastAuth.total)}</p>
                  <Separator className="my-2" />
                  <p className="font-bold">{lastAuth.approved ? "APROBADA" : "DECLINADA"} · AUTH: {lastAuth.code}</p>
                  <p>REF: {lastAuth.ref}</p>
                  <p>{lastAuth.time}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">Aún no hay transacciones. Ingresa un monto en el teclado del terminal.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Panel de ajustes ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Terminal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Select value={config.model} onValueChange={(v) => set("model", v as TerminalModel)}>
                  <SelectTrigger data-testid="select-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VX520">Verifone VX520</SelectItem>
                    <SelectItem value="P400">Verifone P400</SelectItem>
                    <SelectItem value="E280S">Verifone e280s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre del comercio</Label>
                <Input value={config.merchant} onChange={(e) => set("merchant", e.target.value.toUpperCase().slice(0, 22))} data-testid="input-merchant" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ID Terminal</Label>
                  <Input value={config.terminalId} onChange={(e) => set("terminalId", e.target.value)} data-testid="input-terminal-id" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Moneda</Label>
                  <Select value={config.currency} onValueChange={(v) => set("currency", v as "MXN" | "USD")}>
                    <SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MXN">MXN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Monto (directo)</Label>
                  <Input
                    type="number" min={0} step="0.01" value={amount || ""}
                    onChange={(e) => setAmountDigits(e.target.value ? String(Math.round(parseFloat(e.target.value) * 100)) : "")}
                    data-testid="input-amount"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Propina %</Label>
                  <Input type="number" min={0} max={30} value={config.tipPercent} onChange={(e) => set("tipPercent", Math.max(0, Math.min(30, Number(e.target.value) || 0)))} data-testid="input-tip" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Tarjeta de prueba</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Número</Label>
                <Input value={config.cardNumber} onChange={(e) => set("cardNumber", e.target.value.replace(/\D/g, "").slice(0, 16))} data-testid="input-card" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Titular</Label>
                  <Input value={config.holderName} onChange={(e) => set("holderName", e.target.value)} data-testid="input-holder" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expira</Label>
                  <Input value={config.expDate} onChange={(e) => set("expDate", e.target.value)} placeholder="MM/AA" data-testid="input-exp" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Protocolo</Label>
                  <Select value={config.protocol} onValueChange={(v) => set("protocol", v)}>
                    <SelectTrigger data-testid="select-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROTOCOLS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cód. autorización</Label>
                  <Input value={config.authCode} onChange={(e) => set("authCode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Auto" data-testid="input-auth" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Forzar declinación</Label>
                <Switch checked={config.forceDecline} onCheckedChange={(v) => set("forceDecline", v)} data-testid="switch-decline" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Hardware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between"><Label className="text-xs">Brillo de pantalla</Label><span className="text-xs font-mono text-muted-foreground">{config.brightness}%</span></div>
                <Slider value={[config.brightness]} onValueChange={([v]) => set("brightness", v)} min={10} max={100} step={1} data-testid="slider-brightness" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><Label className="text-xs">Nivel de papel</Label><span className="text-xs font-mono text-muted-foreground">{config.paperLevel}%</span></div>
                <Slider value={[config.paperLevel]} onValueChange={([v]) => set("paperLevel", v)} min={0} max={100} step={1} data-testid="slider-paper" />
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["wifi", "WiFi", Wifi],
                  ["gprs", "GPRS", Signal],
                  ["contactless", "NFC", Nfc],
                ] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => set(key, !config[key])}
                    className={`flex flex-col items-center gap-1 rounded-md border p-2 text-[10px] font-semibold transition-colors ${config[key] ? "border-[#c8322b]/40 bg-[#c8322b]/5 text-[#c8322b]" : "text-muted-foreground"}`}
                    data-testid={`toggle-${key}`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => { setConfig(DEFAULT_CONFIG); pressCancel(); setLastAuth(null); }} data-testid="button-reset">
            <RotateCcw className="w-4 h-4 mr-2" /> Restablecer valores
          </Button>
        </div>
      </div>
    </div>
  );
}
