import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  Eye, EyeOff, LogIn, ShieldCheck, Eye as EyeIcon,
  TriangleAlert, ChevronRight,
} from "lucide-react";
import { MareMark } from "@/components/common/MareLogo";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui/forms";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";

interface LoginValues {
  identifier: string;
  password: string;
}

const QUICK_ACCESS = [
  {
    label: "Administrador",
    description: "Acesso total — cria, edita e gerencia tudo",
    icon: ShieldCheck,
    color: "text-navy-700",
    bg: "bg-navy-50 hover:bg-navy-100 border-navy-200",
    identifier: "ana.ribeiro@exemplo.com.br",
    password: "demo123",
  },
  {
    label: "Visualizador",
    description: "Somente leitura — consulta sem editar",
    icon: EyeIcon,
    color: "text-slate-600",
    bg: "bg-slate-50 hover:bg-slate-100 border-slate-200",
    identifier: "visitante@exemplo.com.br",
    password: "demo123",
  },
] as const;

export function LoginPage() {
  const { authenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    defaultValues: { identifier: "", password: "" },
    mode: "onTouched",
  });

  if (authenticated) return <Navigate to="/" replace />;

  const doSignIn = async (identifier: string, password: string) => {
    await signIn(identifier, password);
    navigate("/", { replace: true });
  };

  const onSubmit = async (values: LoginValues) => {
    setSubmitError(null);
    try {
      await doSignIn(values.identifier, values.password);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  };

  const handleQuickAccess = async (identifier: string, password: string, label: string) => {
    setSubmitError(null);
    setQuickLoading(label);
    try {
      setValue("identifier", identifier);
      setValue("password", password);
      await doSignIn(identifier, password);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setQuickLoading(null);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
      {/* ── Painel esquerdo ── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 px-12 py-12 text-white lg:flex">
        {/* Gradiente decorativo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-navy-800 via-navy-900 to-slate-900" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-navy-700/40 blur-2xl" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <MareMark className="h-10 w-10" />
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight">Maré Hub</p>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300/70">PCP · Almoxarifado · Produção</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/80">Plataforma Industrial</p>
          <h1 className="mt-3 text-3xl font-bold leading-snug">
            Controle total da demanda de materiais entre PCP e almoxarifado.
          </h1>
          <ul className="mt-8 space-y-3">
            {[
              "Solicitações de materiais e demandas de produção",
              "Controle de estoque e saldos reservados",
              "Separação de materiais no almoxarifado",
              "Indicadores, histórico e assistente Mar.IA",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-sky-100/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sky-200/40">
          Protótipo de demonstração · Nenhum dado real é acessado ou protegido
        </p>
      </aside>

      {/* ── Painel direito ── */}
      <main className="flex items-center justify-center bg-slate-50 p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">

          {/* Logo mobile */}
          <div className="flex items-center gap-3 lg:hidden">
            <MareMark className="h-9 w-9" />
            <div>
              <p className="font-bold leading-tight text-navy-900">Maré Hub</p>
              <p className="text-xs text-slate-500">PCP · Almoxarifado · Produção</p>
            </div>
          </div>

          {/* Cabeçalho */}
          <div>
            <h2 className="text-2xl font-bold text-navy-900">Entrar</h2>
            <p className="mt-1 text-sm text-slate-500">Acesse a plataforma com seu perfil.</p>
          </div>

          {/* Acesso rápido */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Acesso rápido — demonstração</p>
            {QUICK_ACCESS.map((profile) => {
              const Icon = profile.icon;
              const loading = quickLoading === profile.label;
              return (
                <button
                  key={profile.label}
                  type="button"
                  onClick={() => void handleQuickAccess(profile.identifier, profile.password, profile.label)}
                  disabled={isSubmitting || quickLoading !== null}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:cursor-not-allowed disabled:opacity-60 ${profile.bg}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ${profile.color}`}>
                    <Icon className="h-4.5 w-4.5 h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${profile.color}`}>{profile.label}</p>
                    <p className="text-xs text-slate-500">{profile.description}</p>
                  </div>
                  {loading
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-navy-700" aria-hidden="true" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  }
                </button>
              );
            })}
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">ou entre com seus dados</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Formulário */}
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              id="identifier"
              label="E-mail ou matrícula"
              placeholder="ana.ribeiro@exemplo.com.br"
              autoComplete="username"
              required
              error={errors.identifier?.message}
              {...register("identifier", {
                required: "Informe o e-mail ou a matrícula.",
                minLength: { value: 3, message: "Informe o e-mail ou a matrícula." },
              })}
            />

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Senha<span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-required="true"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-11 text-sm text-slate-900 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700 aria-[invalid=true]:border-rose-500"
                  {...register("password", {
                    required: "Informe a senha.",
                    minLength: { value: 6, message: "A senha deve ter pelo menos 6 caracteres." },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye className="h-4 w-4" aria-hidden="true" />
                  }
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs font-medium text-rose-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {submitError && (
              <div role="alert" className="flex gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{submitError}</p>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {!isSubmitting && <LogIn className="h-4 w-4" aria-hidden="true" />}
              {isSubmitting ? "Verificando…" : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Ao entrar, você acessa apenas o protótipo com dados fictícios.
          </p>
        </div>
      </main>
    </div>
  );
}
