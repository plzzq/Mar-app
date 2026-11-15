import { useEffect, useRef, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  ClipboardList,
  Factory,
  History,
  LayoutDashboard,
  Layers,
  PackageCheck,
  Settings,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { MarIAMark, MareLogo } from "@/components/common/MareLogo";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Itens de navegação                                                  */
/* ------------------------------------------------------------------ */

type NavIcon = LucideIcon | ComponentType<{ className?: string }>;

interface NavItem {
  to: string;
  label: string;
  icon: NavIcon;
  end?: boolean;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/",              label: "Visão geral",                 icon: LayoutDashboard, end: true },
  { to: "/demandas",      label: "Demandas de produção",        icon: Factory },
  { to: "/solicitacoes",  label: "Solicitações de materiais",   icon: ClipboardList },
  { to: "/estoque",       label: "Estoque",                     icon: Warehouse },
  { to: "/bom",           label: "Bill of Materials",           icon: Layers },
  { to: "/separacao",     label: "Separação de materiais",      icon: PackageCheck },
  { to: "/mar-ia",        label: "Mar.IA",                      icon: MarIAMark },
  { to: "/relatorios",    label: "Relatórios e indicadores",    icon: BarChart3 },
  { to: "/historico",     label: "Histórico e rastreabilidade", icon: History },
  { to: "/configuracoes", label: "Configurações",               icon: Settings, adminOnly: true },
];

/* ------------------------------------------------------------------ */
/* Hook: detecta desktop (≥ 1024 px)                                  */
/* ------------------------------------------------------------------ */

function useIsDesktop(): boolean {
  const query = "(min-width: 1024px)";
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setIsDesktop(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

/* ------------------------------------------------------------------ */
/* Props públicas do componente                                        */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/* ------------------------------------------------------------------ */
/* Sidebar principal                                                   */
/* ------------------------------------------------------------------ */

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const isDesktop = useIsDesktop();
  const { role } = usePermissions();
  const isViewer = role === "leitura";
  const visibleItems = NAV_ITEMS.filter((item) => !(item.adminOnly && isViewer));

  const [hoverOpen, setHoverOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = isDesktop ? (!collapsed || hoverOpen) : mobileOpen;

  function handleMouseEnter() {
    if (!isDesktop || !collapsed) return;
    hoverTimer.current = setTimeout(() => setHoverOpen(true), 80);
  }

  function handleMouseLeave() {
    if (!isDesktop) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseMobile(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* DESKTOP */}
      <motion.aside
        aria-label="Menu principal"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        animate={{ width: isOpen ? 256 : 80 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-y-0 left-0 z-50 hidden flex-col bg-navy-900 text-slate-200 shadow-xl overflow-hidden lg:flex"
      >
        <DesktopSidebarContent isOpen={isOpen} visibleItems={visibleItems} />
      </motion.aside>

      {/* MOBILE */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            key="mobile-sidebar"
            aria-label="Menu principal"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-900 text-slate-200 shadow-xl lg:hidden"
          >
            <MobileSidebarContent visibleItems={visibleItems} onClose={onCloseMobile} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Conteúdo interno — desktop                                         */
/* ------------------------------------------------------------------ */

function DesktopSidebarContent({
  isOpen,
  visibleItems,
}: {
  isOpen: boolean;
  visibleItems: NavItem[];
}) {
  return (
    <>
      <div className={cn(
        "flex h-16 shrink-0 items-center border-b border-white/10 px-4 overflow-hidden",
        !isOpen && "justify-center px-0",
      )}>
        <MareLogo collapsed={!isOpen} />
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Navegação">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItemRow key={item.to} item={item} isOpen={isOpen} />
          ))}
        </ul>
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Conteúdo interno — mobile                                          */
/* ------------------------------------------------------------------ */

function MobileSidebarContent({
  visibleItems,
  onClose,
}: {
  visibleItems: NavItem[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <MareLogo collapsed={false} />
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItemRow key={item.to} item={item} isOpen={true} />
          ))}
        </ul>
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Item de navegação — com label animado                              */
/* ------------------------------------------------------------------ */

function NavItemRow({ item, isOpen }: { item: NavItem; isOpen: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        title={!isOpen ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
            isActive
              ? "bg-white/12 text-white ring-1 ring-inset ring-sky-300/40"
              : "text-slate-300 hover:bg-white/8 hover:text-white",
            !isOpen && "justify-center px-0",
          )
        }
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <AnimatePresence>
          {isOpen && (
            <motion.span
              key={`label-${item.to}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="truncate whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </NavLink>
    </li>
  );
}
