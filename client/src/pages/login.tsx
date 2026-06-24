import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Lock, User, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario o correo requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

function BanxicoLogo() {
  return (
    <div className="flex items-center gap-3 justify-center select-none">
      <svg
        viewBox="0 0 52 60"
        width="42"
        height="48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="20" y="0" width="5" height="8" rx="1" fill="#c8322b" />
        <rect x="30" y="0" width="5" height="8" rx="1" fill="#c8322b" />
        <rect x="20" y="52" width="5" height="8" rx="1" fill="#c8322b" />
        <rect x="30" y="52" width="5" height="8" rx="1" fill="#c8322b" />
        <path
          d="M12 4h22c6 0 10 3.5 10 9 0 3.5-1.8 6.2-4.5 7.8C43.5 22.8 46 26 46 30.5c0 6.5-4.5 10.5-11.5 10.5H12V4z"
          fill="#c8322b"
        />
        <path
          d="M18 10h14c3 0 5 1.5 5 4.5S35 19 32 19H18V10z"
          fill="white"
        />
        <path
          d="M18 24h15c3.5 0 5.5 1.8 5.5 5s-2 5-5.5 5H18V24z"
          fill="white"
        />
      </svg>
      <div className="leading-none">
        <span className="text-white font-bold tracking-widest text-2xl uppercase" style={{ letterSpacing: "0.18em" }}>
          BANXICO
        </span>
        <span className="text-[#c8322b] font-black text-2xl">+</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: data.username, password: data.password }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        queryClient.setQueryData(["/api/me"], result.user);
        toast({ title: "Acceso concedido", description: `Bienvenido, ${result.user?.fullName ?? "usuario"}` });
        setLocation("/dashboard");
      } else {
        toast({ title: "Acceso denegado", description: result.error || "Credenciales incorrectas", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo conectar con el servidor", variant: "destructive" });
    }
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0f0f0f 0%, #1c0a09 50%, #0f0f0f 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #c8322b, transparent)" }} />
        <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #c8322b, transparent)" }} />

        <div className="relative z-10">
          <BanxicoLogo />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Sistema integral de gestión POS, transacciones y enrutamiento bancario con protocolos EMV y PCI DSS.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { label: "Terminales POS activas", value: "6+" },
              { label: "Protocolos bancarios", value: "EMV / PCI DSS" },
              { label: "Cifrado de datos", value: "AES-256" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-gray-400 text-xs">{item.label}</span>
                <span className="text-white text-xs font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#c8322b]" />
          <span className="text-gray-500 text-xs">Acceso restringido · Solo personal autorizado</span>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 md:p-10"
        style={{ background: "#111111" }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <BanxicoLogo />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-white text-2xl font-bold mb-1">Iniciar sesión</h1>
            <p className="text-gray-500 text-sm">Ingresa tus credenciales para continuar</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300 text-sm font-medium">Usuario o correo</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          {...field}
                          placeholder="Ingresa tu usuario"
                          autoComplete="username"
                          data-testid="input-username"
                          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#c8322b]/60 focus:ring-[#c8322b]/20 h-11"
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300 text-sm font-medium">Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••••••"
                          autoComplete="current-password"
                          data-testid="input-password"
                          className="pl-9 pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#c8322b]/60 focus:ring-[#c8322b]/20 h-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                          data-testid="button-toggle-password"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#c8322b] text-white font-semibold text-sm mt-2"
                data-testid="button-login"
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Autenticando...</>
                  : "Acceder al sistema"
                }
              </Button>
            </form>
          </Form>

          {/* Security indicators */}
          <div className="mt-8 pt-6 border-t border-white/8 space-y-3">
            <div className="flex items-center justify-center gap-4">
              {[
                { label: "EMV" },
                { label: "PCI DSS" },
                { label: "AES-256" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c8322b]" />
                  <span className="text-gray-600 text-[10px] font-semibold tracking-wider">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-gray-700 text-[10px]">
              Acceso restringido · Sistema de uso interno exclusivo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
