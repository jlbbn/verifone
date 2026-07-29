export function ModernGlass() {
  const done = [
    { title: "Hot Wallet TRON activa",      sub: "Saldo USDT en tiempo real" },
    { title: "Dispersión USDT on-chain",    sub: "Firma, broadcast y registro de TXID" },
    { title: "Historial de dispersiones",   sub: "Tabla con txid + link TronScan" },
    { title: "Contraseña admin permanente", sub: "Sin revertir en reinicios" },
    { title: "Migrations post-merge auto",  sub: "Script DB en cada deploy" },
    { title: "Broker Binance (listo)",      sub: "Esperando API Key correcta" },
  ];

  const next = [
    { title: "API Key Binance",        urgency: "alta",  sub: "BINANCE_API_KEY + SECRET" },
    { title: "Límite máx. dispersión", urgency: "media", sub: "Tope por operación en settings" },
    { title: "Auto-recarga TRX",       urgency: "media", sub: "Gas automático para hot wallet" },
    { title: "Avo Export activo",      urgency: "baja",  sub: "Unsuspend + migrar datos" },
  ];

  return (
    <div
      className="min-h-screen font-sans p-6 space-y-5"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
    >
      {/* Title */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] text-white/60 tracking-widest uppercase font-medium">Sistema operativo · Mainnet</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Dispersión USDT</h1>
        <p className="text-sm text-white/40 mt-1">Banxico Plus LLC · Hot Wallet TRON · Julio 2026</p>
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs text-white/60 font-medium">Progreso del sprint</span>
          <span className="text-lg font-black text-white">75%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: "75%", background: "linear-gradient(90deg,#c8322b,#ef4444)" }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-white/30">6 de 8 tareas completadas</span>
          <span className="text-[10px] text-white/30">2 en cola</span>
        </div>
      </div>

      {/* Two cols */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <span className="text-green-400 text-[11px] font-bold">✓</span>
            </div>
            <span className="text-xs font-semibold text-white/80">Completado</span>
          </div>
          <div className="space-y-2.5">
            {done.map((d) => (
              <div key={d.title} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
                <div>
                  <p className="text-[12px] font-medium text-white/90 leading-tight">{d.title}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{d.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <span className="text-amber-400 text-[11px]">→</span>
            </div>
            <span className="text-xs font-semibold text-white/80">Próximos pasos</span>
          </div>
          <div className="space-y-2.5">
            {next.map((n) => (
              <div key={n.title} className="flex items-start gap-2.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                  n.urgency === "alta" ? "bg-red-400" : n.urgency === "media" ? "bg-amber-400" : "bg-zinc-500"
                }`} />
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[12px] font-medium text-white/90 leading-tight">{n.title}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${
                      n.urgency === "alta"  ? "bg-red-500/20 text-red-400" :
                      n.urgency === "media" ? "bg-amber-500/20 text-amber-400" :
                                              "bg-zinc-500/20 text-zinc-400"
                    }`}>{n.urgency}</span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">{n.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: "TRON",   label: "Red blockchain",  g: "from-[#c8322b] to-[#ff6b6b]" },
          { value: "≈$0.02", label: "Fee por TX",      g: "from-blue-600 to-blue-400"   },
          { value: "AES-256",label: "Cifrado admin",   g: "from-purple-600 to-purple-400"},
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <p className={`text-lg font-black bg-gradient-to-r ${m.g} bg-clip-text text-transparent`}>{m.value}</p>
            <p className="text-[10px] text-white/40 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
