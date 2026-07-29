export function DarkPremium() {
  const features = [
    { label: "Hot Wallet TRON configurada",   status: "done",    detail: "TRC-20 USDT · clave privada en secrets" },
    { label: "Interfaz de dispersión USDT",   status: "done",    detail: "Firma on-chain + historial de TXs" },
    { label: "Contraseña admin protegida",    status: "done",    detail: "Ya no se revierte al reiniciar" },
    { label: "Script post-merge automático",  status: "done",    detail: "DB migrations al hacer merge" },
    { label: "Broker principal: Binance",     status: "partial", detail: "Pendiente: API Key correcta" },
    { label: "Límite máximo por dispersión",  status: "pending", detail: "Control de riesgo por operación" },
  ];

  const stats = [
    { value: "TRON",   sub: "TRC-20",    label: "Red",         color: "#ef4444" },
    { value: "USDT",   sub: "Token",     label: "Activo",      color: "#22c55e" },
    { value: "≈$0.02", sub: "por TX",    label: "Fee",         color: "#3b82f6" },
    { value: "100%",   sub: "on-chain",  label: "Verificable", color: "#a855f7" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#c8322b] flex items-center justify-center text-xs font-black">B+</div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 font-semibold">Banxico Plus LLC</span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">Hot Wallet & Dispersión USDT</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Estado del sistema · Julio 2026</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">Mainnet activa</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Features */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full bg-[#c8322b]" />
            <span className="text-sm font-semibold">Entregables</span>
          </div>
          {features.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold border ${
                f.status === "done"    ? "bg-green-500/20 text-green-400 border-green-500/30" :
                f.status === "partial" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                         "bg-zinc-700 text-zinc-500 border-zinc-600"
              }`}>
                {f.status === "done" ? "✓" : f.status === "partial" ? "~" : "○"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-100 leading-tight">{f.label}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Flow */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-blue-500" />
            <span className="text-sm font-semibold">Flujo de dispersión</span>
          </div>
          <div className="space-y-2">
            {[
              { step: "1", label: "Admin ingresa dirección TRON + monto" },
              { step: "2", label: "Confirma con contraseña de administrador" },
              { step: "3", label: "Servidor firma con clave privada (hot wallet)" },
              { step: "4", label: "TronWeb transmite TX a mainnet TRON" },
              { step: "5", label: "TXID registrado en base de datos" },
              { step: "6", label: "Verificable en TronScan con un clic" },
            ].map((item, i, arr) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400 flex-shrink-0">
                    {item.step}
                  </div>
                  {i < arr.length - 1 && <div className="w-px h-3 bg-zinc-700 mt-0.5" />}
                </div>
                <p className="text-xs text-zinc-200 pt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="rounded-xl bg-gradient-to-r from-[#c8322b]/10 to-transparent border border-[#c8322b]/20 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[#e05a55]">Próximos pasos</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Agregar API Key Binance · Límite máx. dispersión · Avo Export · TRX auto-recarga
          </p>
        </div>
        <div className="text-right text-[10px] text-zinc-600">
          <p>Task #15 ✓ Merged</p>
          <p>Task #12 ✓ Merged</p>
        </div>
      </div>
    </div>
  );
}
