
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, CheckCircle, XCircle, Clock, Activity, DollarSign, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface TimeZoneInfo {
  city: string;
  timezone: string;
  time: string;
  date: string;
}

export default function POSPage() {
  const [timeZones, setTimeZones] = useState<TimeZoneInfo[]>([]);
  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const [contentWidth, setContentWidth] = useState(0);

  // Update time zones every second
  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      
      const zones: TimeZoneInfo[] = [
        {
          city: "System Time",
          timezone: "Local",
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
          date: now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        },
        {
          city: "Mexico City",
          timezone: "America/Mexico_City",
          time: now.toLocaleTimeString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
          date: now.toLocaleDateString('en-US', { timeZone: 'America/Mexico_City', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        },
        {
          city: "Los Angeles",
          timezone: "America/Los_Angeles",
          time: now.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
          date: now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        },
        {
          city: "Toronto",
          timezone: "America/Toronto",
          time: now.toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
          date: now.toLocaleDateString('en-US', { timeZone: 'America/Toronto', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        }
      ];
      
      setTimeZones(zones);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate content width
  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.scrollWidth / 3);
    }
  }, [timeZones]);

  // Animate ticker
  useEffect(() => {
    if (contentWidth === 0) return;

    const animate = () => {
      setPosition((prev) => {
        const newPos = prev - 1;
        if (newPos <= -contentWidth) {
          return newPos % contentWidth;
        }
        return newPos;
      });
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [contentWidth]);

  return (
    <div className="space-y-0">
      {/* Time Zone Ticker */}
      <div 
        ref={containerRef}
        className="bg-black h-[50px] overflow-hidden relative border-b border-gray-800"
      >
        <div
          ref={contentRef}
          className="flex items-center h-full absolute left-0 top-0 whitespace-nowrap"
          style={{ transform: `translateX(${position}px)` }}
        >
          {Array(3).fill(null).map((_, copyIndex) => (
            <div key={copyIndex} className="flex items-center">
              {timeZones.map((zone, index) => (
                <div
                  key={`${copyIndex}-${index}`}
                  className="inline-flex items-center text-white font-['Arial'] text-sm px-8"
                >
                  <span className="text-[#c8322b] text-xs mr-3">●</span>
                  <span className="font-semibold mr-2">{zone.city}:</span>
                  <span className="mr-1">{zone.time}</span>
                  <span className="text-gray-400 text-xs ml-2">| {zone.date}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Enrutamiento POS</h1>
            <p className="text-sm md:text-base text-muted-foreground">Sistema de puntos de venta conectados en tiempo real</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Última actualización</p>
            <p className="text-sm font-semibold">{new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="hover-elevate border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminales Activas</CardTitle>
              <Store className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">12</div>
              <p className="text-xs text-muted-foreground mt-1">de 15 totales disponibles</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '80%' }}></div>
                </div>
                <span className="text-xs font-semibold">80%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transacciones Hoy</CardTitle>
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">1,847</div>
              <p className="text-xs text-green-600 mt-1">↑ +12.5% vs ayer</p>
              <p className="text-xs text-muted-foreground">Promedio: 154 por hora</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
              <XCircle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">23</div>
              <p className="text-xs text-muted-foreground mt-1">1.2% del total</p>
              <p className="text-xs text-green-600">↓ -0.3% vs ayer</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
              <Clock className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">2.3s</div>
              <p className="text-xs text-muted-foreground mt-1">Por transacción</p>
              <p className="text-xs text-green-600">↓ -0.2s vs ayer</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volumen Total</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$542,890.45</div>
              <p className="text-xs text-muted-foreground">Procesado hoy</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">98.8%</div>
              <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Requieren atención</p>
            </CardContent>
          </Card>
        </div>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle>Terminales POS</CardTitle>
            <CardDescription>Estado de las terminales conectadas y métricas de rendimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: "T1001", model: "Verifone VX 690", status: "Online", transactions: 542, amount: 2304567.89, efficiency: 98, location: "Sucursal Centro", uptime: "99.8%", lastTx: "Hace 12 seg" },
                { id: "T1002", model: "Ingenico iCT220", status: "Online", transactions: 321, amount: 1850234.50, efficiency: 95, location: "Sucursal Norte", uptime: "99.5%", lastTx: "Hace 28 seg" },
                { id: "T1003", model: "PAX S920", status: "Offline", transactions: 198, amount: 674305.00, efficiency: 82, location: "Sucursal Sur", uptime: "87.2%", lastTx: "Hace 2 hrs" },
                { id: "T1004", model: "Verifone VX 520", status: "Online", transactions: 456, amount: 3186003.20, efficiency: 96, location: "Sucursal Oeste", uptime: "99.6%", lastTx: "Hace 5 seg" },
                { id: "T1005", model: "Ingenico iWL250", status: "Online", transactions: 330, amount: 1953806.75, efficiency: 94, location: "Sucursal Este", uptime: "99.3%", lastTx: "Hace 45 seg" },
              ].map((pos, i) => (
                <div key={i} className="flex items-center justify-between pb-4 border-b last:border-0 hover:bg-gray-50 p-3 rounded-lg transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <div className={`w-4 h-4 rounded-full ${pos.status === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      {pos.status === 'Online' && (
                        <div className="absolute inset-0 w-4 h-4 rounded-full bg-green-500 animate-ping opacity-75"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Store className="h-4 w-4 text-gray-500" />
                        <p className="font-bold text-lg">{pos.id}</p>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${pos.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {pos.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700">{pos.model}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-xs text-muted-foreground">📍 {pos.location}</p>
                        <p className="text-xs text-muted-foreground">⏱️ {pos.lastTx}</p>
                        <p className="text-xs font-semibold text-blue-600">Uptime: {pos.uptime}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1.5 min-w-[200px]">
                    <p className="font-bold text-xl text-green-600">${pos.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                    <p className="text-sm font-semibold text-gray-600">{pos.transactions} transacciones procesadas</p>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-muted-foreground font-semibold">Eficiencia:</span>
                      <div className="w-24 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${pos.efficiency >= 95 ? 'bg-green-500' : pos.efficiency >= 85 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${pos.efficiency}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-gray-700">{pos.efficiency}%</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Button variant="outline" size="sm" className="hover:bg-[#c8322b] hover:text-white transition-colors">
                      Ver Detalles
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle>Últimas Transacciones</CardTitle>
              <CardDescription>Actividad reciente en tiempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { terminal: "T1001", type: "VISA", amount: 1250.00, time: "Hace 2 min", status: "Aprobada" },
                  { terminal: "T1002", type: "Mastercard", amount: 850.50, time: "Hace 5 min", status: "Aprobada" },
                  { terminal: "T1004", type: "AMEX", amount: 2100.75, time: "Hace 8 min", status: "Aprobada" },
                  { terminal: "T1003", type: "VISA", amount: 450.00, time: "Hace 12 min", status: "Rechazada" },
                  { terminal: "T1005", type: "Mastercard", amount: 3200.00, time: "Hace 15 min", status: "Aprobada" },
                ].map((tx, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${tx.status === 'Aprobada' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="text-sm font-medium">{tx.terminal} - {tx.type}</p>
                        <p className="text-xs text-muted-foreground">{tx.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      <p className={`text-xs ${tx.status === 'Aprobada' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle>Rendimiento por Terminal</CardTitle>
              <CardDescription>Eficiencia y velocidad de procesamiento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { terminal: "T1001", avgTime: "2.1s", success: "98%", color: "green" },
                  { terminal: "T1002", avgTime: "2.4s", success: "95%", color: "green" },
                  { terminal: "T1003", avgTime: "3.8s", success: "82%", color: "yellow" },
                  { terminal: "T1004", avgTime: "2.2s", success: "96%", color: "green" },
                  { terminal: "T1005", avgTime: "2.5s", success: "94%", color: "green" },
                ].map((perf, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full bg-${perf.color}-500`}></span>
                      <span className="font-medium">{perf.terminal}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Tiempo Avg</p>
                        <p className="font-semibold">{perf.avgTime}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Éxito</p>
                        <p className="font-semibold">{perf.success}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Date Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Sistema operativo desde: 2025-01-01</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Fecha del sistema: {new Date().toLocaleDateString('es-MX', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                Sistema Activo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
