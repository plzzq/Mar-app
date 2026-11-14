import { Link } from "react-router-dom";
import { Home, SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-navy-700">Erro 404</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-slate-600">O endereço acessado não existe nesta demonstração.</p>
        <Link to="/" className={buttonClasses("primary", "md", "mt-6")}>
          <Home className="h-4 w-4" aria-hidden="true" />
          Voltar para a visão geral
        </Link>
      </div>
    </div>
  );
}
