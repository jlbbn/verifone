import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Top-level safety net. Without this, any uncaught render error unmounts the
 * whole React tree and the user sees nothing but a blank/black page (the dark
 * theme's background color) with no clue anything went wrong.
 *
 * This catches that, shows a clear recovery UI, and reports the error to the
 * server so it shows up in deployment logs instead of vanishing silently on
 * the user's device.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {
      // best-effort only — never let logging failures compound the crash
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0f0f0f] px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#c8322b]/15 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-[#c8322b]" />
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Ocurrió un error inesperado</h1>
          <p className="text-white/60 text-sm max-w-sm mb-6">
            La aplicación encontró un problema al cargar esta pantalla. Intenta recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-md bg-[#c8322b] hover:bg-[#a62822] text-white text-sm font-semibold transition-colors"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
