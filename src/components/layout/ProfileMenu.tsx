import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useQuery } from "@/hooks/useQuery";
import { handleListKeys } from "@/lib/keyboard";
import { initials, cn } from "@/lib/utils";
import { getProfile } from "@/services/userService";

export function ProfileMenu() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const { data: profile } = useQuery(getProfile);

  useClickOutside(ref, close, open);

  const name = profile?.name ?? "Usuário";

  const handleSignOut = () => {
    setOpen(false);
    signOut();
    navigate("/login");
  };

  /** Menu acessível: Esc fecha e devolve o foco; setas navegam entre itens. */
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = items.findIndex((item) => item === document.activeElement);
    if (index < 0) return;
    handleListKeys(event, {
      count: items.length,
      index,
      orientation: "vertical",
      onChange: (next) => items[next]?.focus(),
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          // Ao abrir, foca o primeiro item para permitir navegação imediata.
          window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 0);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu do usuário: ${name}`}
        className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white" aria-hidden="true">
          {initials(name) || "U"}
        </span>
        <span className="hidden text-left leading-tight xl:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium text-slate-900">{name}</span>
          <span className="block max-w-[10rem] truncate text-xs text-slate-500">{profile?.role ?? "—"}</span>
        </span>
        <ChevronDown className={cn("hidden h-4 w-4 text-slate-400 transition-transform xl:block", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Opções do usuário"
          onKeyDown={handleMenuKeyDown}
          className="animate-fade-up absolute right-0 top-[calc(100%+4px)] z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{profile?.role}</p>
            <p className="text-xs text-slate-500">{profile?.sector}</p>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link role="menuitem" tabIndex={-1} to="/perfil" onClick={close} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <User className="h-4 w-4" aria-hidden="true" />
            Meu perfil
          </Link>
          <Link
            role="menuitem"
            tabIndex={-1}
            to="/configuracoes"
            onClick={close}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Configurações
          </Link>
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair da demonstração
          </button>
        </div>
      )}
    </div>
  );
}
