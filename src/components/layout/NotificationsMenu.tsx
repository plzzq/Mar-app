import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { NotificationBadge } from "@/components/common/DomainBadges";
import { buttonClasses } from "@/components/ui";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useQuery } from "@/hooks/useQuery";
import { formatDateTime, cn } from "@/lib/utils";
import { listNotifications, setAllNotificationsRead, setNotificationRead } from "@/services/activityService";

export function NotificationsMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const { data } = useQuery(listNotifications);

  useClickOutside(ref, close, open);

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  const recent = notifications.slice(0, 6);

  const openNotification = async (id: string, link: string, read: boolean) => {
    setOpen(false);
    if (!read) await setNotificationRead(id, true);
    navigate(link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"}
        className={buttonClasses("ghost", "icon", "relative")}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notificações recentes"
          className="animate-fade-up absolute right-0 top-[calc(100%+4px)] z-50 flex max-h-[70dvh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-navy-900">Notificações</p>
              <p className="text-xs text-slate-500">{unread > 0 ? `${unread} não lida(s)` : "Tudo em dia"}</p>
            </div>
            <button
              type="button"
              onClick={() => setAllNotificationsRead(true)}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Marcar todas como lidas
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-slate-500">
              <BellOff className="h-6 w-6" aria-hidden="true" />
              Nenhuma notificação no momento.
            </div>
          ) : (
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {recent.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n.id, n.link, n.read)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
                      !n.read && "bg-sky-50/50",
                    )}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-slate-300" : "bg-navy-700")} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <NotificationBadge category={n.category} />
                        {!n.read && <span className="sr-only">Não lida.</span>}
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium text-slate-900">{n.title}</span>
                      <span className="block text-xs text-slate-500">{formatDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-slate-100 p-3">
            <Link
              to="/notificacoes"
              onClick={close}
              className={buttonClasses("outline", "sm", "w-full")}
            >
              Ver todas as notificações
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
