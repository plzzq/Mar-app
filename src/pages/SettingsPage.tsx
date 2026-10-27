import { useState } from "react";
import { Accessibility, Bell, CheckCircle2, CircleAlert, ClipboardCheck, Database, Info, Loader2, Play, RotateCcw, Rocket, ShieldCheck, UserCog, Volume2, VolumeX } from "lucide-react";
import { A11yReport } from "@/components/accessibility/A11yReport";
import { AccessibilityPanel } from "@/components/accessibility/AccessibilityPanel";
import { ShortcutsTable } from "@/components/accessibility/ShortcutsTable";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoBadge } from "@/components/common/Widgets";
import { Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Select, ToggleField } from "@/components/ui/forms";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSpeechSynthesis } from "@/hooks/useSpeech";
import { getErrorMessage } from "@/lib/errors";
import { roleLabel } from "@/services/permissions";
import { runSelfTests, type SelfTestResult } from "@/services/selfTest";
import { dataSourceLabel, isSupabaseConfigured } from "@/services/supabase/client";
import { listUsers, restoreDemoData, switchActiveUser } from "@/services/userService";

type PrefKey = "prazo" | "atrasada" | "estoque" | "nova" | "separacao" | "cancelamento";

const PREFERENCES: { key: PrefKey; label: string; description: string }[] = [
  { key: "prazo",        label: "Prazos próximos",       description: "Solicitações que vencem em até 2 dias." },
  { key: "atrasada",     label: "Demandas atrasadas",     description: "Solicitações com prazo vencido." },
  { key: "estoque",      label: "Estoque insuficiente",   description: "Materiais com demanda acima do disponível." },
  { key: "nova",         label: "Novas solicitações",     description: "Cadastros feitos pelos setores." },
  { key: "separacao",    label: "Separações concluídas",  description: "Solicitações prontas para disponibilização." },
  { key: "cancelamento", label: "Cancelamentos",          description: "Solicitações canceladas com motivo." },
];

const SAMPLE_TEXT = "Leitura em voz alta ativada. Você pode ouvir o conteúdo da página pelo botão no cabeçalho.";

export function SettingsPage() {
  const toast = useToast();
  const { user, users } = useAuth();
  const { role } = usePermissions();
  const isViewer = role === "leitura";

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    prazo: true, atrasada: true, estoque: true, nova: true, separacao: false, cancelamento: true,
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting,    setResetting]    = useState(false);
  const [switching,    setSwitching]    = useState(false);
  const [testing,      setTesting]      = useState(false);
  const [a11yOpen,     setA11yOpen]     = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [testResults,  setTestResults]  = useState<SelfTestResult[] | null>(null);
  const speech     = useSpeechSynthesis();
  const supabaseOn = isSupabaseConfigured();

  const updatePref = (key: PrefKey, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    toast({ title: "Preferência atualizada", description: "Alteração salva apenas nesta sessão.", variant: "info" });
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await restoreDemoData();
      toast({ title: "Dados restaurados", description: "Os dados voltaram ao estado inicial.", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível restaurar", description: getErrorMessage(error), variant: "error" });
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const handleSwitchUser = async (userId: string) => {
    if (userId === user.id) return;
    setSwitching(true);
    try {
      const next = await switchActiveUser(userId);
      toast({ title: "Perfil alterado", description: `Agora você atua como ${next.name} (${next.role}).`, variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível trocar de perfil", description: getErrorMessage(error), variant: "error" });
    } finally {
      setSwitching(false);
    }
  };

  const handleRunTests = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const results = await runSelfTests();
      setTestResults(results);
      const failed = results.filter((r) => !r.pass).length;
      toast({
        title: failed === 0 ? "Verificação concluída sem falhas" : `Verificação concluída com ${failed} falha(s)`,
        description: `${results.length} fluxos testados em ambiente isolado (seus dados foram preservados).`,
        variant: failed === 0 ? "success" : "error",
      });
    } catch (error) {
      toast({ title: "Falha na verificação", description: getErrorMessage(error), variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  const integrations: { name: string; status: string; tone: "success" | "warning" | "neutral"; note: string }[] = [
    { name: "Autenticação",              status: supabaseOn ? "Supabase Auth" : "Modo de demonstração", tone: supabaseOn ? "success" : "warning", note: supabaseOn ? "Login real com perfis da tabela profiles." : "Sem autenticação real nesta versão." },
    { name: "Banco de dados",            status: dataSourceLabel(),     tone: supabaseOn ? "success" : "neutral", note: supabaseOn ? "Tabelas + RLS + função transacional." : "Cache local versionado (mare:state:v2)." },
    { name: "Mar.IA (modelo de linguagem)", status: "Não configurada", tone: "warning", note: "Respostas de demonstração, sem IA real." },
    { name: "Publicação (Vercel)",       status: "Pendente",           tone: "neutral", note: "Build estático compatível com a publicação." },
  ];

  return (
    <>
      <div className="mb-3"><DemoBadge /></div>
      <PageHeader
        title="Configurações"
        description={isViewer ? "Acessibilidade, atalhos de teclado e voz." : "Perfil, preferências, acessibilidade, dados e integrações."}
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Configurações" }]}
      />

      <div className="grid gap-4 xl:grid-cols-2">

        {/* ── Sempre visíveis ── */}
        <Card>
          <CardHeader title="Acessibilidade" description="Fonte, contraste, tema, animações, alvos de toque e som." icon={Accessibility} />
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">
              As preferências são aplicadas em toda a plataforma, salvas neste dispositivo e restauráveis.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setA11yOpen(true)}>
                <Accessibility className="h-4 w-4" aria-hidden="true" />
                Abrir painel de acessibilidade
              </Button>
              <Button variant="outline" onClick={() => setShortcutsOpen(true)}>
                Ver atalhos de teclado
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Atalhos gerais: <strong>?</strong> abre a lista de atalhos · <strong>/</strong> foca a busca.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Voz" description="Leitura em voz alta pela Web Speech API." icon={Volume2} />
          <div className="space-y-4 p-5 text-sm text-slate-700">
            <p>
              Use o ícone de alto-falante no cabeçalho para ler a página atual. Nas respostas da Mar.IA, cada mensagem tem o próprio controle de leitura.
            </p>
            {speech.supported ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant={speech.speakingId === "test" ? "secondary" : "outline"}
                  onClick={() => (speech.speakingId === "test" ? speech.stop() : speech.speak(SAMPLE_TEXT, "test"))}
                  aria-pressed={speech.speakingId === "test"}
                >
                  {speech.speakingId === "test"
                    ? <VolumeX className="h-4 w-4" aria-hidden="true" />
                    : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                  {speech.speakingId === "test" ? "Interromper leitura" : "Testar leitura em voz alta"}
                </Button>
                <Badge tone="success" icon={CheckCircle2}>Suportada neste navegador</Badge>
              </div>
            ) : (
              <Badge tone="warning" icon={Info}>Leitura em voz alta não suportada neste navegador</Badge>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Atalhos de teclado" description="Listagem completa, também disponível pela tecla ?." icon={Accessibility} />
          <div className="p-5">
            <ShortcutsTable />
          </div>
        </Card>

        {/* ── Exclusivos do Admin ── */}
        {!isViewer && (
          <>
            <Card>
              <CardHeader title="Perfil de acesso" description="Troque de perfil para testar as permissões." icon={UserCog} />
              <div className="space-y-4 p-5">
                <Select
                  id="profile-switch"
                  label="Atuar como"
                  value={user.id}
                  onChange={(e) => void handleSwitchUser(e.target.value)}
                  hint={`Papel atual: ${roleLabel(user.roleKey)}. A troca limpa operações pendentes de desfazer.`}
                >
                  {(users.length > 0 ? users : [user]).map((u) => (
                    <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                  ))}
                </Select>
                {switching && <p className="text-sm text-slate-500">Trocando de perfil…</p>}
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li>• <strong>Admin:</strong> acesso total — cria, edita e gerencia tudo.</li>
                  <li>• <strong>Visitante:</strong> somente leitura em todas as telas.</li>
                </ul>
                <Button variant="outline" size="sm" onClick={() => void listUsers().then(() => toast({ title: "Perfis carregados", variant: "info" }))}>
                  Recarregar perfis
                </Button>
              </div>
            </Card>

            <Card>
              <CardHeader title="Notificações" description="Escolha quais alertas aparecem no centro de notificações." icon={Bell} />
              <div className="divide-y divide-slate-100 px-5">
                {PREFERENCES.map((pref) => (
                  <ToggleField
                    key={pref.key}
                    id={`pref-${pref.key}`}
                    label={pref.label}
                    description={pref.description}
                    checked={prefs[pref.key]}
                    onChange={(value) => updatePref(pref.key, value)}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Dados locais" description="Cache versionado no navegador." icon={Database} />
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Suas alterações persistem ao recarregar (cache <code className="rounded bg-slate-100 px-1 text-xs">mare:state:v2</code>).
                </p>
                <Button variant="outline" onClick={() => setConfirmReset(true)} className="shrink-0">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restaurar dados
                </Button>
              </div>
            </Card>

            <Card>
              <CardHeader title="Integrações" description="Situação atual de cada integração." icon={Rocket} />
              <ul className="divide-y divide-slate-100 px-5">
                {integrations.map((item) => (
                  <li key={item.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.note}</p>
                    </div>
                    <Badge tone={item.tone}>{item.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader
                title="Testes funcionais"
                description="Executa 14 fluxos completos em ambiente isolado. Seus dados são preservados."
                icon={ClipboardCheck}
                actions={
                  <Button onClick={handleRunTests} loading={testing} disabled={testing}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {testing ? "Testando…" : "Executar verificação"}
                  </Button>
                }
              />
              <div className="p-5">
                {testing && (
                  <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Executando fluxos… isso leva alguns segundos.
                  </p>
                )}
                {!testing && !testResults && (
                  <EmptyState title="Nenhuma verificação executada" description="Clique em "Executar verificação" para testar os fluxos críticos do sistema." />
                )}
                {testResults && (
                  <ol className="space-y-2">
                    {testResults.map((r) => (
                      <li key={r.name} className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
                        {r.pass
                          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          : <CircleAlert  className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"    aria-hidden="true" />
                        }
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{r.name}</p>
                          <p className="text-xs text-slate-600">{r.details}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      {!isViewer && (
        <>
          <div className="mt-4"><A11yReport /></div>
          <div className="mt-4">
            <Card>
              <CardHeader title="Sobre a Plataforma Maré" icon={Info} />
              <div className="grid gap-4 p-5 text-sm text-slate-600 md:grid-cols-3">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy-700" aria-hidden="true" />
                  <p>Fábrica de produtos para cães: categorias oficiais de estoque e setores da operação.</p>
                </div>
                <div className="flex gap-3">
                  <Database className="mt-0.5 h-5 w-5 shrink-0 text-navy-700" aria-hidden="true" />
                  <p>Serviços tipados em <code className="rounded bg-slate-100 px-1 text-xs">src/services</code> com as mesmas assinaturas dos repositórios Supabase.</p>
                </div>
                <div className="flex gap-3">
                  <Accessibility className="mt-0.5 h-5 w-5 shrink-0 text-navy-700" aria-hidden="true" />
                  <p>Versão do protótipo: 0.3 · Acessibilidade, navegação por teclado e verificação automatizada incluídas.</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      <AccessibilityPanel open={a11yOpen} onClose={() => setA11yOpen(false)} />

      <Modal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Atalhos de teclado"
        description="Disponíveis em toda a plataforma, sem interferir na digitação."
        size="md"
        footer={<Button onClick={() => setShortcutsOpen(false)}>Fechar</Button>}
      >
        <ShortcutsTable />
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="Restaurar dados de demonstração?"
        description="Todas as alterações feitas nesta sessão serão descartadas e os dados voltarão ao estado inicial."
        confirmLabel="Restaurar dados"
        tone="danger"
        loading={resetting}
        onCancel={() => setConfirmReset(false)}
        onConfirm={handleReset}
      />
    </>
  );
}
