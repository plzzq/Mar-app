import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Plus, Volume2, VolumeX } from "lucide-react";
import { MareMark } from "@/components/common/MareLogo";
import { buttonClasses } from "@/components/ui";
import { useSpeechSynthesis } from "@/hooks/useSpeech";
import { canUseGlobalShortcut } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { NotificationsMenu } from "./NotificationsMenu";
import { ProfileMenu } from "./ProfileMenu";
import { SearchBox } from "./SearchBox";

interface TopbarProps {
  onOpenMenu: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      // Só captura fora de campos de texto e diálogos (ver lib/keyboard).
      if (!canUseGlobalShortcut(event)) return;
      event.preventDefault();
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      document.getElementById(isDesktop ? "global-search-desktop" : "global-search-mobile")?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 px-4 lg:h-16 lg:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 lg:hidden">
          <MareMark className="h-7 w-7" />
          <span className="text-sm font-semibold text-navy-900">Maré</span>
        </div>

        <div className="hidden min-w-0 flex-1 lg:block">
          <SearchBox inputId="global-search-desktop" />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <SpeakPageButton />
          <Link to="/solicitacoes/nova" aria-label="Nova solicitação" className={buttonClasses("primary", "icon", "lg:hidden")}>
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>

      <div className="px-4 pb-2 lg:hidden">
        <SearchBox inputId="global-search-mobile" />
      </div>
    </header>
  );
}

/** Lê em voz alta o conteúdo principal da página (Web Speech API). */
function SpeakPageButton() {
  const { supported, speakingId, speak, stop } = useSpeechSynthesis();
  const { pathname } = useLocation();

  useEffect(() => {
    stop();
  }, [pathname, stop]);

  if (!supported) return null;

  const active = speakingId === "page";

  const handleClick = () => {
    if (active) {
      stop();
      return;
    }
    const text = document.getElementById("conteudo")?.innerText?.trim() ?? "";
    speak(text.slice(0, 6000) || "Não há conteúdo para ler nesta página.", "page");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Interromper leitura em voz alta" : "Ler a página em voz alta"}
      title={active ? "Interromper leitura" : "Ler a página em voz alta"}
      className={cn(buttonClasses(active ? "secondary" : "ghost", "icon"), "hidden sm:inline-flex")}
    >
      {active ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
