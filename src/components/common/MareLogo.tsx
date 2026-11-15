/* Identidade visual: marca da Maré e símbolo da Mar.IA. */
import { cn } from "@/lib/utils";
import logoSvg from "@/assets/logo-mare.svg";

/** Logo completa MARÉ — usada na sidebar expandida. */
export function MareMark({ className }: { className?: string }) {
  return (
    <img
      src={logoSvg}
      alt="Maré"
      className={cn("h-12 w-auto object-contain", className)}
      draggable={false}
    />
  );
}

/** Ícone compacto — corta o SVG original para mostrar só o "M" da logo. */
export function MareIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center", className)}
      aria-label="Maré"
      role="img"
    >
      {/* Usa o SVG inline recortado — viewBox aponta só para o M (primeiros ~380px de 1536) */}
      <svg
        viewBox="50 170 460 280"
        className="h-9 w-9"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <image
          href={logoSvg}
          x="0"
          y="0"
          width="1536"
          height="614"
        />
      </svg>
    </div>
  );
}

/** Símbolo da Mar.IA — ícone com ondas e ponto (sem alteração). */
export function MarIAMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#1D4E89" />
      <path d="M9 22c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3.5 5-1" stroke="#E0F2FE" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9 28c2.5-3 5-3 7.5 0s5 3 7.5 0" stroke="#8DA9C4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="29" cy="12" r="3" fill="#7DD3FC" />
    </svg>
  );
}

/** Logo usada na sidebar — expandida mostra a logo completa, recolhida mostra só o ícone M. */
export function MareLogo({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return <MareIcon />;
  }
  return (
    <div className="flex min-w-0 items-center px-1">
      <MareMark className="h-12 w-auto max-w-[160px]" />
    </div>
  );
}
