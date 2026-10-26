import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Keyboard } from "lucide-react";
import { ShortcutsTable } from "@/components/accessibility/ShortcutsTable";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { canUseGlobalShortcut } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Troca de rota: fecha painéis e leva o foco ao conteúdo principal (sem pular na primeira carga).
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  // Atalho "?" abre a lista de atalhos (nunca captura em campos de texto nem em diálogos).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!canUseGlobalShortcut(event)) return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-slate-50">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-navy-900 focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={cn("flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main
          id="conteudo"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 px-4 pb-6 pt-4 focus:outline-none focus-visible:outline-none md:px-6 lg:px-8 lg:pt-6"
        >
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 md:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <span>Plataforma Maré · fábrica de produtos para cães · dados de demonstração</span>
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-navy-700 hover:bg-navy-50"
            >
              <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
              Atalhos de teclado (tecla ?)
            </button>
          </div>
        </footer>
      </div>

      <Modal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Atalhos de teclado"
        description="Disponíveis em toda a plataforma, sem interferir na digitação."
        size="md"
        footer={<Button onClick={() => setShortcutsOpen(false)}>Fechar</Button>}
      >
        <ShortcutsTable />
        <p className="mt-3 text-xs text-slate-500">
          Alternativas: se a combinação não estiver disponível no seu sistema, use sempre <kbd className="rounded border border-slate-300 bg-white px-1">Tab</kbd> e os
          botões visíveis na tela. Também existe o link “Pular para o conteúdo principal”, o primeiro item focável da página.
        </p>
      </Modal>
    </div>
  );
}
