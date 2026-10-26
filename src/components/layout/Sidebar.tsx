import { useEffect, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { MarIAMark, MareLogo } from "@/components/common/MareLogo";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

type NavIcon = LucideIcon | ComponentType<{ className?: string }>;

interface NavItem {
  to: string;
  label: string;
  icon: NavIcon;
  end?: boolean;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/",             label: "Visão geral",                icon: LayoutDashboard, end: true },
  { to: "/solicitacoes", label: "Solicitações de materiais",  icon: ClipboardList },
  { to: "/estoque",      label: "Estoque",                    icon: Warehouse },
  { to: "/separacao",    label: "Separação de materiais",     icon: PackageCheck },
  { to: "/mar-ia",       label: "Mar.IA",                     icon: MarIAMark },
  { to: "/relatorios",   label: "Relatórios e indicadores",   icon: BarChart3 },
  { to: "/historico",    label: "Histórico e rastreabilidade", icon: History },
  { to: "/configuracoes",label: "Configurações",              icon: Settings, adminOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

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

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const isDesktop = useIsDesktop();
  const { role } = usePermissions();
  const isViewer = role === "leitura";
  const visibleItems = NAV_ITEMS.filter((item) => !(item.adminOnly && isViewer));

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  const hiddenOnMobile = !isDesktop && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        aria-label="Menu principal"
        aria-hidden={hiddenOnMobile || undefined}
        inert={hiddenOnMobile}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-900 text-slate-200 shadow-xl transition-[transform,width] duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-20" : "lg:w-64",
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center border-b border-white/10 px-4", collapsed ? "lg:justify-center lg:px-0" : "justify-between")}>
          <MareLogo collapsed={collapsed && isDesktop} />
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                        isActive
                          ? "bg-white/12 text-white ring-1 ring-inset ring-sky-300/40"
                          : "text-slate-300 hover:bg-white/8 hover:text-white",
                        collapsed && "lg:justify-center lg:px-0",
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={cn("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-3 border-t border-white/10 p-3">
          {!collapsed && (
            <p className="px-2 text-[11px] leading-snug text-sky-200/70">
              Protótipo com dados de demonstração. Integrações reais serão configuradas posteriormente.
            </p>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            className="hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 lg:flex"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
            <span className={cn(collapsed && "sr-only")}>Recolher menu</span>
          </button>
        </div>
      </aside>
    </>
  );
}
