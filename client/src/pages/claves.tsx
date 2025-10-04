
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Key, Shield, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export default function ClavesPage() {
  const [showKeys, setShowKeys] = useState<{ [key: number]: boolean }>({});

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Claves Encriptadas</h1>
        <p className="text-sm md:text-base text-muted-foreground">Gestión segura de claves de acceso</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claves Activas</CardTitle>
            <Key className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">En uso</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nivel de Seguridad</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Alto</div>
            <p className="text-xs text-muted-foreground">AES-256</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Rotación</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 días</div>
            <p className="text-xs text-muted-foreground">Hace 48 horas</p>
          </CardContent>
        </Card>
      </div>

      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle>Generar Nueva Clave</CardTitle>
          <CardDescription>Crear una nueva clave encriptada para el sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Nombre de la Clave</label>
              <Input placeholder="ej: API_KEY_PRODUCCION" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Encriptación</label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background">
                <option>AES-256-GCM</option>
                <option>RSA-4096</option>
                <option>ChaCha20-Poly1305</option>
              </select>
            </div>
          </div>
          <Button className="bg-[#c8322b] hover:bg-[#a62822]">
            <Key className="w-4 h-4 mr-2" />
            Generar Clave
          </Button>
        </CardContent>
      </Card>

      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle>Claves Almacenadas</CardTitle>
          <CardDescription>Lista de claves encriptadas en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { name: "VISA_API_KEY", type: "AES-256", created: "2025-05-01", status: "Activa" },
              { name: "SWIFT_ACCESS_TOKEN", type: "RSA-4096", created: "2025-04-28", status: "Activa" },
              { name: "DATABASE_ENCRYPTION_KEY", type: "AES-256", created: "2025-04-25", status: "Activa" },
              { name: "JWT_SECRET", type: "ChaCha20", created: "2025-04-20", status: "Activa" },
              { name: "OAUTH_CLIENT_SECRET", type: "AES-256", created: "2025-04-15", status: "Rotada" },
            ].map((clave, i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b last:border-0">
                <div className="flex items-center gap-4 flex-1">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium font-mono text-sm">{clave.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {clave.type} • Creada: {clave.created}
                    </p>
                    {showKeys[i] && (
                      <p className="text-xs font-mono mt-1 bg-muted p-2 rounded">
                        {Array(32).fill('•').join('')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowKeys({ ...showKeys, [i]: !showKeys[i] })}
                  >
                    {showKeys[i] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    clave.status === 'Activa' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {clave.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
