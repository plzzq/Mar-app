import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Info, LogIn, TriangleAlert } from "lucide-react";
import { MareMark } from "@/components/common/MareLogo";
import { Button, Card } from "@/components/ui";
import { Input } from "@/components/ui/forms";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";

interface LoginValues {
  identifier: string;
  password: string;
}

const MODULES = [
  "Solicitações de materiais e demandas de produção",
  "Controle de estoque e saldos reservados",
  "Separação de materiais no almoxarifado",
  "Indicadores, histórico e assistente Mar.IA",
];

export function LoginPage() {
  const { authenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ defaultValues: { identifier: "", password: "" }, mode: "onTouched" });

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (authenticated) return <Navigate to={from} replace />;

  const onSubmit = async (values: LoginValues) => {
    setSubmitError(null);
    try {
      await signIn(values.identifier, values.password);
      navigate(from, { replace: true });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  };

  return (
    <div className="grid min-h-dvh bg-slate-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <aside className="hidden flex-col justify-between bg-navy-900 px-10 py-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <MareMark className="h-9 w-9" />
          <div>
            <p className="font-semibold leading-tight">Plataforma Maré</p>
            <p className="text-xs uppercase tracking-[0.16em] text-sky-200/70">PCP · Almoxarifado · Produção</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="text-2xl font-semibold leading-snug">
            Organizar a demanda de materiais entre PCP, almoxarifado e produção.
          </h1>
          <ul className="mt-6 space-y-2.5 text-sm text-sky-100/80">
            {MODULES.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-300/80" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sky-200/60">Protótipo de demonstração. Nenhum dado real é acessado ou protegido.</p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <MareMark className="h-9 w-9" />
            <div>
              <p className="font-semibold leading-tight text-navy-900">Plataforma Maré</p>
              <p className="text-xs text-slate-500">PCP · Almoxarifado · Produção</p>
            </div>
          </div>

          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-navy-900">Acessar a plataforma</h2>
            <p className="mt-1 text-sm text-slate-600">Informe sua identificação corporativa.</p>

            <div role="note" className="mt-4 flex gap-2.5 rounded-md border border-sky-300 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                <strong className="font-semibold">Modo de demonstração.</strong> Não há autenticação real nesta versão: qualquer identificação válida e senha com 6
                caracteres ou mais entram no protótipo. Use a senha <code className="rounded bg-white px-1">erro</code> para simular uma falha.
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Input
                id="identifier"
                label="E-mail ou matrícula"
                placeholder="ana.ribeiro@exemplo.com.br ou PCP-0142"
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
                    className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-3 pr-11 text-base text-slate-900 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700 lg:text-sm aria-[invalid=true]:border-rose-600"
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs font-medium text-rose-700">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {submitError && (
                <div role="alert" className="flex gap-2.5 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{submitError}</p>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
                {!isSubmitting && <LogIn className="h-4 w-4" aria-hidden="true" />}
                {isSubmitting ? "Verificando acesso…" : "Entrar"}
              </Button>
            </form>
          </Card>

          <p className="mt-4 text-center text-xs text-slate-500">
            Ao entrar, você acessa apenas o protótipo com dados fictícios.
          </p>
        </div>
      </main>
    </div>
  );
}
