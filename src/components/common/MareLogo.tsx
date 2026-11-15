/* Identidade visual: marca da Maré e símbolo da Mar.IA. */
import { cn } from "@/lib/utils";
import logoSvg from "@/assets/logo-mare.svg";
import mLogoSvg from "@/assets/M logo.svg";

/** Logo completa MARÉ — usada na sidebar expandida e na tela de login. */
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

/** Ícone M dedicado — usado quando a sidebar está recolhida. */
export function MareIcon({ className }: { className?: string }) {
  return (
    <img
      src={mLogoSvg}
      alt="Maré"
      className={cn("h-10 w-10 object-contain", className)}
      draggable={false}
    />
  );
}

/** Símbolo da Mar.IA — ícone com ondas e ponto. */
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

/**
 * Logo da sidebar:
 * - Recolhida: só o M (pequeno, centralizado)
 * - Expandida ao hover: cresce suavemente para a logo completa MARÉ
 */
export function MareLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex min-w-0 items-center overflow-hidden">
      {/* M — sempre visível, some ao expandir */}
      <img
        src={mLogoSvg}
        alt="Maré"
        draggable={false}
        className={cn(
          "object-contain shrink-0 transition-all duration-220 ease-out",
          collapsed
            ? "h-10 w-10 opacity-100"
            : "h-0 w-0 opacity-0 pointer-events-none",
        )}
      />
      {/* Logo completa — aparece ao expandir */}
      <img
        src={logoSvg}
        alt="Maré"
        draggable={false}
        className={cn(
          "object-contain shrink-0 transition-all duration-220 ease-out",
          collapsed
            ? "h-0 w-0 opacity-0 pointer-events-none"
            : "h-12 w-auto max-w-[150px] opacity-100",
        )}
      />
    </div>
  );
}
