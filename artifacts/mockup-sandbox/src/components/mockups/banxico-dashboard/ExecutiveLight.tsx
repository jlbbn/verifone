export function ExecutiveLight() {
  const modules = [
    {
      title: "Hot Wallet",
      status: "live",
      icon: "🔥",
      color: "red",
      points: [
        "Clave privada propia (no custodia externa)",
        "Saldo USDT en tiempo real vía TronGrid API",
        "TRX para gas visible en panel admin",
        "Dirección pública configurable por env var",
      ],
    },
    {
      title: "Motor de Dispersión",
      status: "live",
      icon: "⚡",
      color: "green",
      points: [
        "POST /api/admin/hot-wallet/disperse",
        "Autenticación por contraseña antes de firmar",
        "TronWeb v6 firma y broadcast on-chain",
        "Registro inmediato en DB con status",
      ],
    },
    {
      title: "Audit Log",
      status: "live",
      icon: "🗃",
      color: "blue",
      points: [
        "Tabla hot_wallet_dispersions en PostgreSQL",
        "Campos: toAddress, amount, txid, status, note",
        "Historial con link directo a TronScan",
        "Estados: pending → confirmed / failed",
      ],
    },
    {
      title: "Broker Exchange",
      status: "partial",
      icon: "📈",
      color: "amber",
      points: [
        "Cadena: Binance → OKX → Kraken (fallback)",
        "broker-executor.ts con lógica de failover",
        "Código Binance listo — falta API Key",
        "OKX activo como respaldo principal",
      ],
    },
    {
      title: "Validaciones de Seguridad",
      status: "building",
      icon: "🔒",
      color: "purple",
      points: [
        "Verificar saldo antes de firmar TX",
        "Límite máximo configurable por operación",
        "Rate limiting en endpoint de dispersión",
        "Bloqueo si saldo insuficiente con msg claro",
      ],
    },
    {
      title: "Auto-gestión de Gas",
      status: "building",
      icon: "⛽",
      color: "slate",
      points: [
        "Monitor de saldo TRX en hot wallet",
        "Recarga automática al bajar del umbral",
        "Configuración del umbral desde admin panel",
        "Alertas si recarga falla",
      ],
    },
  ];

  const statusColor = {
    live:     { badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500",  ring: "border-green-200" },
    partial:  { badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400",  ring: "border-amber-200" },
    building: { badge: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-300",  ring: "border-slate-200" },
  };

  const iconColor: Record<string, string> = {
    red:    "bg-red-50 border-red-200",
    green:  "bg-green-50 border-green-200",
    blue:   "bg-blue-50 border-blue-200",
    amber:  "bg-amber-50 border-amber-200",
    purple: "bg-purple-50 border-purple-200",
    slate:  "bg-slate-50 border-slate-200",
  };

  const statusLabel: Record<string, string> = {
    live: "En producción", partial: "En progreso", building: "En construcción",
  };

  return (
    <div className="min-h-screen bg-white font-sans p-7">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#c8322b] flex items-center justify-center font-black text-white">B+</div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">Sistema de Dispersión Crypto</h1>
            <p className="text-sm text-slate-500">Banxico Plus LLC · Arquitectura TRON TRC-20 · Julio 2026</p>
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          {[
            { n: "3", l: "módulos en producción",  c: "text-green-600 bg-green-50 border-green-200"  },
            { n: "2", l: "en construcción",          c: "text-amber-600 bg-amber-50 border-amber-200" },
          ].map(k => (
            <div key={k.l} className={`px-3 py-2 rounded-xl border text-center min-w-[90px] ${k.c}`}>
              <p className="text-xl font-black">{k.n}</p>
              <p className="text-[10px] font-medium leading-tight mt-0.5">{k.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key insight */}
      <div className="mb-5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 flex items-start gap-3">
        <div className="text-2xl mt-0.5">🔑</div>
        <div>
          <p className="text-sm font-bold text-white">Infraestructura blockchain propia — sin intermediarios</p>
          <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
            La plataforma controla su propia clave privada TRON. Cada dispersión USDT se firma y transmite
            directamente a mainnet sin pasar por un exchange o servicio de custodia. Costo por transferencia:
            <strong className="text-white"> ≈ $0.02 USD</strong>. Verificable en TronScan.
          </p>
        </div>
      </div>

      {/* Modules grid */}
      <div className="grid grid-cols-2 gap-3">
        {modules.map((m) => {
          const sc = statusColor[m.status as keyof typeof statusColor];
          return (
            <div key={m.title} className={`rounded-xl border ${sc.ring} p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg border text-base flex items-center justify-center ${iconColor[m.color]}`}>
                    {m.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-tight">{m.title}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.badge}`}>
                  {statusLabel[m.status]}
                </span>
              </div>
              <ul className="space-y-1">
                {m.points.map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <div className={`w-1 h-1 rounded-full flex-shrink-0 mt-1.5 ${sc.dot}`} />
                    <span className="text-[11px] text-slate-600 leading-tight">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-3">
        {[
          { v: "TRON",        l: "Red blockchain"      },
          { v: "TRC-20 USDT", l: "Token estándar"       },
          { v: "PostgreSQL",  l: "Audit log persistente" },
          { v: "AES-256",     l: "Cifrado de sesiones"   },
        ].map(s => (
          <div key={s.l} className="text-center p-2 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-xs font-black text-slate-800">{s.v}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
