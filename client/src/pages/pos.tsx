
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
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Enrutamiento POS</h1>
          <p className="text-sm md:text-base text-muted-foreground">Sistema de puntos de venta conectados</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminales Activas</CardTitle>
              <Store className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">de 15 totales</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,847</div>
              <p className="text-xs text-muted-foreground">Hoy</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">1.2% del total</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.3s</div>
              <p className="text-xs text-muted-foreground">Por transacción</p>
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
                { id: "T1001", model: "Verifone VX 690", status: "Online", transactions: 542, amount: 230450.78, efficiency: 98, location: "Sucursal Centro" },
                { id: "T1002", model: "Ingenico iCT220", status: "Online", transactions: 321, amount: 101240.25, efficiency: 95, location: "Sucursal Norte" },
                { id: "T1003", model: "PAX S920", status: "Offline", transactions: 198, amount: 67430.50, efficiency: 82, location: "Sucursal Sur" },
                { id: "T1004", model: "Verifone VX 520", status: "Online", transactions: 456, amount: 178600.30, efficiency: 96, location: "Sucursal Oeste" },
                { id: "T1005", model: "Ingenico iWL250", status: "Online", transactions: 330, amount: 145380.67, efficiency: 94, location: "Sucursal Este" },
              ].map((pos, i) => (
                <div key={i} className="flex items-center justify-between pb-4 border-b last:border-0">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-3 h-3 rounded-full ${pos.status === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{pos.id}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${pos.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {pos.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{pos.model}</p>
                      <p className="text-xs text-muted-foreground">{pos.location}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">{pos.transactions} transacciones</p>
                    <p className="text-sm text-muted-foreground">${pos.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${pos.efficiency >= 95 ? 'bg-green-500' : pos.efficiency >= 85 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${pos.efficiency}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-muted-foreground">{pos.efficiency}%</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Button variant="outline" size="sm">Ver Detalles</Button>
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
      </div>
    </div>
  );
}
