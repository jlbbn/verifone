import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTerminalParams, DEFAULT_TERMINAL_PARAMS, TerminalParam } from "@/hooks/use-terminal-params";
import {
  Settings, RotateCcw, Save, Terminal, ToggleLeft, ToggleRight,
  Type, ChevronDown, Info, ShieldCheck, CheckCircle
} from "lucide-react";

const GROUP_ICONS: Record<string, React.ElementType> = {
  "Identificación": Terminal,
  "Operación":      Settings,
  "Funcionalidades": ToggleRight,
};

const GROUP_COLORS: Record<string, string> = {
  "Identificación": "text-blue-600",
  "Operación":      "text-purple-600",
  "Funcionalidades": "text-green-600",
};

export default function AdminTerminalParamsPage() {
  const { toast } = useToast();
  const { params, saveAll, resetToDefaults } = useTerminalParams();

  // local draft — edits go here until Save
  const [draft, setDraft] = useState<TerminalParam[]>(() => params.map(p => ({ ...p })));
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const map: Record<string, TerminalParam[]> = {};
    draft.forEach(p => {
      if (!map[p.group]) map[p.group] = [];
      map[p.group].push(p);
    });
    return map;
  }, [draft]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    const result: Record<string, TerminalParam[]> = {};
    Object.entries(groups).forEach(([g, ps]) => {
      const matched = ps.filter(p =>
        p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
      );
      if (matched.length) result[g] = matched;
    });
    return result;
  }, [groups, search]);

  function set(label: string, value: string) {
    setDraft(prev => prev.map(p => p.label === label ? { ...p, value } : p));
    setSaved(false);
  }

  function toggle(label: string) {
    setDraft(prev => prev.map(p =>
      p.label === label ? { ...p, value: p.value === "SI" ? "NO" : "SI" } : p
    ));
    setSaved(false);
  }

  function handleSave() {
    saveAll(draft);
    setSaved(true);
    toast({
      title: "Parámetros guardados",
      description: "Los cambios se reflejarán en el próximo Reporte de Parámetros.",
    });
  }

  function handleReset() {
    setDraft(DEFAULT_TERMINAL_PARAMS.map(p => ({ ...p })));
    setSaved(false);
    resetToDefaults();
    toast({
      title: "Parámetros restablecidos",
      description: "Se restauraron los valores predeterminados.",
      variant: "destructive",
    });
  }

  const toggleCount = draft.filter(p => p.type === "toggle" && p.value === "SI").length;
  const totalToggles = draft.filter(p => p.type === "toggle").length;
  const changedCount = draft.filter((p, i) => p.value !== DEFAULT_TERMINAL_PARAMS[i]?.value).length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Terminal className="w-7 h-7 text-[#c8322b]" /> Parámetros de Terminal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configura los valores que aparecen en el Reporte de Parámetros del POS Virtual
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset-params"
            className="border-red-300 text-red-600 gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Restablecer
          </Button>
          <Button size="sm" onClick={handleSave} data-testid="button-save-params"
            className="bg-[#c8322b] text-white gap-1.5">
            {saved
              ? <><CheckCircle className="w-3.5 h-3.5" /> Guardado</>
              : <><Save className="w-3.5 h-3.5" /> Guardar cambios</>
            }
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ToggleRight className="w-4 h-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Funcionalidades activas</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{toggleCount}<span className="text-sm text-muted-foreground font-normal"> / {totalToggles}</span></p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total parámetros</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{draft.length}</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Modificados vs. default</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{changedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Los cambios se guardan localmente y se reflejan automáticamente en el próximo
              <strong> REPORTE PARAMETROS</strong> del POS Virtual (FUNCIONES → Reporte Parámetros).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Settings className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar parámetro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-params"
        />
      </div>

      {/* Groups */}
      {Object.entries(filtered).map(([group, groupParams]) => {
        const Icon = GROUP_ICONS[group] ?? Settings;
        const colorClass = GROUP_COLORS[group] ?? "text-gray-600";
        const togglesInGroup = groupParams.filter(p => p.type === "toggle");
        const activeInGroup  = togglesInGroup.filter(p => p.value === "SI").length;

        return (
          <Card key={group} className="hover-elevate">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`flex items-center gap-2 text-base ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                  {group}
                </CardTitle>
                {togglesInGroup.length > 0 && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 no-default-active-elevate text-xs">
                    {activeInGroup}/{togglesInGroup.length} activas
                  </Badge>
                )}
              </div>
              <CardDescription>
                {groupParams.length} parámetro{groupParams.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {groupParams.map(param => (
                  <div
                    key={param.label}
                    data-testid={`row-param-${param.label.replace(/\s+/g, "-").toLowerCase()}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    {/* Label */}
                    <div className="w-44 flex-shrink-0">
                      <p className="text-xs font-mono font-semibold text-foreground">{param.label}</p>
                      {param.highlight && (
                        <Badge className="bg-green-100 text-green-600 border-green-200 no-default-active-elevate text-[9px] mt-0.5">
                          activado
                        </Badge>
                      )}
                    </div>

                    {/* Control */}
                    <div className="flex-1">
                      {param.type === "toggle" && (
                        <button
                          onClick={() => toggle(param.label)}
                          data-testid={`toggle-${param.label.replace(/\s+/g, "-").toLowerCase()}`}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            param.value === "SI"
                              ? "bg-green-100 text-green-700 border border-green-300"
                              : "bg-red-50 text-red-600 border border-red-200"
                          }`}
                        >
                          {param.value === "SI"
                            ? <ToggleRight className="w-4 h-4" />
                            : <ToggleLeft  className="w-4 h-4" />
                          }
                          {param.value}
                        </button>
                      )}

                      {param.type === "text" && (
                        <Input
                          value={param.value}
                          onChange={e => set(param.label, e.target.value.toUpperCase())}
                          className="h-8 text-xs font-mono max-w-xs"
                          data-testid={`input-${param.label.replace(/\s+/g, "-").toLowerCase()}`}
                        />
                      )}

                      {param.type === "select" && (
                        <Select value={param.value} onValueChange={v => set(param.label, v)}>
                          <SelectTrigger
                            className="h-8 text-xs font-mono max-w-xs"
                            data-testid={`select-${param.label.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {param.options?.map(o => (
                              <SelectItem key={o} value={o} className="text-xs font-mono">{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Changed indicator */}
                    {param.value !== DEFAULT_TERMINAL_PARAMS.find(d => d.label === param.label)?.value && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 no-default-active-elevate text-[9px] flex-shrink-0">
                        modificado
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Save footer */}
      {!saved && changedCount > 0 && (
        <div className="sticky bottom-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto shadow-lg rounded-xl overflow-hidden">
            <Button onClick={handleSave} className="bg-[#c8322b] text-white px-6 gap-2">
              <Save className="w-4 h-4" />
              Guardar {changedCount} cambio{changedCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
