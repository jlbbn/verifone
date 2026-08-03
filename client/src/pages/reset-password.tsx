import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) { setInvalid(true); return; }
    setToken(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Contraseña muy corta", description: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        toast({ title: "Error", description: data.error ?? "Token inválido o expirado", variant: "destructive" });
        if (data.error?.includes("expirado") || data.error?.includes("inválido")) setInvalid(true);
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-white font-bold tracking-widest text-2xl uppercase" style={{ letterSpacing: "0.18em" }}>BANXICO</span>
          <span className="text-[#c8322b] font-black text-2xl">+</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {invalid ? (
            <div className="text-center space-y-4">
              <XCircle className="w-12 h-12 text-red-400 mx-auto" />
              <h2 className="text-white text-xl font-bold">Enlace inválido</h2>
              <p className="text-gray-400 text-sm">Este enlace de recuperación no es válido o ya expiró.</p>
              <Button
                className="w-full bg-[#c8322b] text-white mt-4"
                onClick={() => setLocation("/login")}
              >
                Volver al inicio de sesión
              </Button>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <h2 className="text-white text-xl font-bold">¡Contraseña actualizada!</h2>
              <p className="text-gray-400 text-sm">Ya puedes iniciar sesión con tu nueva contraseña.</p>
              <Button
                className="w-full bg-[#c8322b] text-white mt-4"
                onClick={() => setLocation("/login")}
              >
                Ir al inicio de sesión
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-white text-xl font-bold mb-1">Nueva contraseña</h2>
                <p className="text-gray-400 text-sm">Elige una contraseña segura para tu cuenta.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm font-medium">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type={showPwd ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-9 pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 text-sm font-medium">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="password"
                      placeholder="Repite la contraseña"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-11"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || password.length < 6}
                  className="w-full h-11 bg-[#c8322b] text-white font-semibold mt-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                    : "Guardar nueva contraseña"
                  }
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
