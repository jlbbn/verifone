import React from 'react';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  Wallet, 
  Share2, 
  FileText, 
  RefreshCcw, 
  Key,
  Bell,
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  MoreVertical,
  Activity,
  CreditCard,
  Building,
  Shield
} from 'lucide-react';

export function ModernGlass() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-slate-100 font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/10 bg-white/5 backdrop-blur-xl flex flex-col shrink-0 z-20">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c8322b] to-[#9a1f1b] flex items-center justify-center shadow-lg shadow-[#c8322b]/20">
            <Building className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">Banxico<span className="font-light text-slate-300">Plus</span></h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Institutional</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <NavItem icon={<ArrowRightLeft size={18} />} label="Transacciones" />
          <NavItem icon={<Wallet size={18} />} label="Caja" />
          <NavItem icon={<Share2 size={18} />} label="Enrutamiento POS" />
          <NavItem icon={<FileText size={18} />} label="Registros" />
          <NavItem icon={<RefreshCcw size={18} />} label="Exchange Crypto" />
          <NavItem icon={<Key size={18} />} label="Claves Encriptadas" />
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
              <span className="text-sm font-semibold">JL</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate text-white">José Luis Barrientos</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Shield size={10} className="text-[#c8322b]" />
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider">ADMIN</p>
              </div>
            </div>
            <MoreVertical size={16} className="text-slate-400" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#c8322b]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Navbar */}
        <header className="h-20 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold text-white">Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400 group-focus-within:text-[#c8322b] transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="Buscar transacciones..." 
                className="bg-white/5 border border-white/10 text-sm rounded-full pl-10 pr-4 py-2 w-64 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#c8322b]/50 focus:bg-white/10 transition-all backdrop-blur-md"
              />
            </div>
            <button className="relative w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors backdrop-blur-md">
              <Bell size={18} className="text-slate-300" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#c8322b] rounded-full border border-slate-900" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 z-10 space-y-6">
          
          {/* Floating Ticker Pill */}
          <div className="flex items-center gap-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-lg shadow-black/20 w-max mx-auto">
            <TickerItem symbol="BTC" price="$64,230.50" change="+2.4%" up />
            <div className="w-px h-4 bg-white/10" />
            <TickerItem symbol="ETH" price="$3,450.20" change="-0.8%" />
            <div className="w-px h-4 bg-white/10" />
            <TickerItem symbol="XRP" price="$0.58" change="+1.2%" up />
            <div className="w-px h-4 bg-white/10" />
            <TickerItem symbol="USD/MXN" price="17.24" change="-0.1%" />
            <div className="w-px h-4 bg-white/10" />
            <TickerItem symbol="CAD/MXN" price="12.65" change="+0.4%" up />
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Balance Hero Card */}
            <div className="col-span-2 relative p-8 rounded-3xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-[#c8322b]/20 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                      <Wallet size={16} className="text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-300">Balance Disponible</span>
                  </div>
                  <button className="flex items-center gap-2 text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-full border border-white/10">
                    USD <ChevronDown size={14} />
                  </button>
                </div>
                
                <h3 className="text-5xl font-light text-white tracking-tight mb-2">
                  <span className="font-semibold text-slate-300">$</span>1,250,000<span className="text-slate-400">.00</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded text-xs font-medium">
                    <TrendingUp size={12} /> +12.5%
                  </span>
                  <span className="text-xs text-slate-400">vs mes anterior</span>
                </div>

                <div className="flex gap-4 mt-8">
                  <button className="bg-[#c8322b] hover:bg-[#b02c26] text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-[#c8322b]/30 flex items-center gap-2">
                    <ArrowRightLeft size={16} /> Transferir
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-medium transition-colors border border-white/10 flex items-center gap-2">
                    <Activity size={16} /> Analíticas
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats Column */}
            <div className="space-y-6">
              <StatCard title="Ingresos del día" value="$42,300.00" trend="+4.1%" />
              <StatCard title="Operaciones Pendientes" value="12" alert />
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">Transacciones Recientes</h3>
              <button className="text-sm text-[#c8322b] hover:text-white transition-colors font-medium">Ver todas</button>
            </div>
            
            <div className="w-full">
              <div className="grid grid-cols-12 gap-4 pb-4 border-b border-white/10 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Referencia / Beneficiario</div>
                <div className="col-span-2">Tipo</div>
                <div className="col-span-2">Fecha</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2 text-right">Monto</div>
              </div>
              
              <div className="divide-y divide-white/5">
                <TransactionRow 
                  name="SPEI a Santander" 
                  refId="REF-894392" 
                  type="Egreso" 
                  date="Hoy, 14:30" 
                  status="Completado" 
                  amount="-$15,000.00" 
                  negative
                />
                <TransactionRow 
                  name="Liquidación POS Terminal" 
                  refId="REF-894391" 
                  type="Ingreso" 
                  date="Hoy, 10:15" 
                  status="Completado" 
                  amount="+$42,300.00" 
                />
                <TransactionRow 
                  name="Pago de Nómina" 
                  refId="REF-894390" 
                  type="Egreso" 
                  date="Ayer, 18:00" 
                  status="Procesando" 
                  amount="-$125,400.00" 
                  negative
                  processing
                />
                <TransactionRow 
                  name="Recepción SWIFT USD" 
                  refId="REF-894389" 
                  type="Ingreso" 
                  date="Ayer, 09:45" 
                  status="Completado" 
                  amount="+$50,000.00" 
                />
                <TransactionRow 
                  name="Comisión Exchange" 
                  refId="REF-894388" 
                  type="Egreso" 
                  date="12 Jun, 16:20" 
                  status="Completado" 
                  amount="-$150.00" 
                  negative
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300
      ${active 
        ? 'bg-gradient-to-r from-[#c8322b]/20 to-transparent text-white border-l-2 border-[#c8322b]' 
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-2 border-transparent'
      }`}>
      <div className={`${active ? 'text-[#c8322b]' : ''}`}>
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function TickerItem({ symbol, price, change, up = false }: { symbol: string, price: string, change: string, up?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-400 font-medium">{symbol}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-slate-200">{price}</span>
        <span className={`text-[10px] font-medium flex items-center ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
          {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {change}
        </span>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, alert = false }: { title: string, value: string, trend?: string, alert?: boolean }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl h-full flex flex-col justify-center">
      <h4 className="text-sm font-medium text-slate-400 mb-2">{title}</h4>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-light text-white">{value}</span>
        {trend && (
          <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
            {trend}
          </span>
        )}
        {alert && (
          <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Requiere acción
          </span>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ name, refId, type, date, status, amount, negative = false, processing = false }: any) {
  return (
    <div className="grid grid-cols-12 gap-4 py-4 items-center group hover:bg-white/5 transition-colors rounded-xl -mx-2 px-2">
      <div className="col-span-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border
          ${negative ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}
        `}>
          {negative ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">{name}</p>
          <p className="text-xs text-slate-500">{refId}</p>
        </div>
      </div>
      <div className="col-span-2">
        <span className="text-xs text-slate-400">{type}</span>
      </div>
      <div className="col-span-2">
        <span className="text-xs text-slate-400">{date}</span>
      </div>
      <div className="col-span-2">
        <span className={`text-[10px] font-medium px-2 py-1 rounded-full border
          ${processing 
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}
        `}>
          {status}
        </span>
      </div>
      <div className={`col-span-2 text-right text-sm font-medium ${negative ? 'text-white' : 'text-emerald-400'}`}>
        {amount}
      </div>
    </div>
  );
}
