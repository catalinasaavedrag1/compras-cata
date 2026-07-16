import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { IconEye, IconEyeOff, IconMail, IconLock } from "../components/ui/icons";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }
    login(email.trim());
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white mb-3">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 16l4-8 4 5 2-3 4 6" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Buyer Workspace</h1>
          <p className="text-sm text-slate-500">Tu cartera, prioridades y decisiones</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-2xl shadow-card p-6 space-y-4"
        >
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-slate-600 mb-1">
              Correo
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <IconMail className="w-4 h-4" />
              </span>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="tucorreo@empresa.cl"
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          {/* Contraseña con ojito */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <IconLock className="w-4 h-4" />
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 rounded-md p-1.5 hover:bg-slate-100"
              >
                {showPassword ? (
                  <IconEyeOff className="w-4 h-4" />
                ) : (
                  <IconEye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-600">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full justify-center">
            Iniciar sesión
          </Button>

          <p className="text-[11px] text-slate-400 text-center leading-snug">
            Demo sin backend: cualquier correo y contraseña inician sesión.
          </p>
        </form>
      </div>
    </div>
  );
}
