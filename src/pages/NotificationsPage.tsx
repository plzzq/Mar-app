import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BellOff, CheckCheck, MailOpen, Mail } from "lucide-react";
import { NotificationBadge } from "@/components/common/DomainBadges";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, EmptyState, ErrorState, LoadingState, buttonClasses } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { useQuery } from "@/hooks/useQuery";
import { formatDateTime, cn } from "@/lib/utils";
import { listNotifications, setAllNotificationsRead, setNotificationRead } from "@/services/activityService";
import type { NotificationCategory } from "@/types";

const CATEGORY_TABS: { value: NotificationCategory | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "atrasada", label: "Demandas atrasadas" },
  { value: "prazo", label: "Prazos próximos" },
  { value: "estoque", label: "Estoque insuficiente" },
  { value: "nova", label: "Novas solicitações" },
  { value: "separacao", label: "Separações concluídas" },
  { value: "cancelamento", label: "Cancelamentos" },
];

export function NotificationsPage() {
  const toast = useToast();
  const [category, setCategory] = useState<NotificationCategory | "todas">("todas");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const { data, loading, error, refetch } = useQuery(listNotifications);

  const unreadTotal = (data ?? []).filter((n) => !n.read).length;

  const visible = useMemo(
    () =>
      (data ?? []).filter(
        (n) => (category === "todas" || n.category === category) && (!onlyUnread || !n.read),
      ),
    [data, category, onlyUnread],
  );

  const toggleRead = async (id: string, read: boolean) => {
    try {
      await setNotificationRead(id, read);
    } catch {
      toast({ title: "Não foi possível atualizar", description: "Tente novamente.", variant: "error" });
    }
  };

  const markAll = async () => {
    await setAllNotificationsRead(true);
    toast({ title: "Notificações atualizadas", description: "Todas as notificações foram marcadas como lidas.", variant: "success" });
  };

  return (
    <>
      <PageHeader
        title="Notificações"
        description="Prazos próximos, demandas atrasadas, falta de estoque, novas solicitações e separações concluídas."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Notificações" }]}
        actions={
          <Button variant="outline" onClick={markAll} disabled={unreadTotal === 0}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Marcar todas como lidas
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => {
            const count =
              tab.value === "todas"
                ? (data ?? []).length
                : (data ?? []).filter((n) => n.category === tab.value).length;
            const pressed = category === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={pressed}
                onClick={() => setCategory(tab.value)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                  pressed ? "bg-navy-800 text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
                )}
              >
                {tab.label} <span className="ml-1 tabular-nums opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-sky-500"
          />
          Somente não lidas ({unreadTotal})
        </label>
      </div>

      {loading && <LoadingState label="Carregando notificações…" rows={3} />}
      {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}
      {!loading && !error && data && visible.length === 0 && (
        <EmptyState
          icon={BellOff}
          title={onlyUnread ? "Nenhuma notificação não lida" : "Nenhuma notificação nesta categoria"}
          description="As notificações aparecem aqui conforme prazos, estoque e movimentações das solicitações."
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="space-y-3" aria-label="Lista de notificações">
          {visible.map((n) => (
            <li key={n.id}>
              <Card className={cn("flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5", !n.read && "border-navy-200 bg-sky-50/40")}>
                <span className={cn("mt-1.5 hidden h-2.5 w-2.5 shrink-0 rounded-full sm:block", n.read ? "bg-slate-300" : "bg-navy-700")} aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <NotificationBadge category={n.category} />
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", n.read ? "bg-slate-100 text-slate-600" : "bg-navy-700 text-white")}>
                      {n.read ? "Lida" : "Não lida"}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <time dateTime={n.createdAt} className="block text-xs text-slate-500">
                    {formatDateTime(n.createdAt)}
                  </time>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRead(n.id, !n.read)}
                    className={buttonClasses("outline", "sm")}
                  >
                    {n.read ? <Mail className="h-4 w-4" aria-hidden="true" /> : <MailOpen className="h-4 w-4" aria-hidden="true" />}
                    {n.read ? "Marcar como não lida" : "Marcar como lida"}
                  </button>
                  <Link to={n.link} onClick={() => !n.read && void toggleRead(n.id, true)} className={buttonClasses("secondary", "sm")}>
                    Abrir
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
