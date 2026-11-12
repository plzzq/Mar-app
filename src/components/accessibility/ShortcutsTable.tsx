/* Lista de atalhos de teclado da plataforma (tabela acessível). */

interface Shortcut {
  keys: string;
  action: string;
}

export const PLATFORM_SHORTCUTS: Shortcut[] = [
  { keys: "Tab / Shift+Tab", action: "Avançar ou voltar entre elementos interativos" },
  { keys: "Enter", action: "Ativar botão/link focado; enviar mensagem na Mar.IA quando a opção “Enter envia” estiver ativa" },
  { keys: "Espaço", action: "Ativar botões e alternar controles (não interfere na digitação nos campos)" },
  { keys: "Esc", action: "Fechar diálogos, menus, painéis ou cancelar a ação atual" },
  { keys: "Setas ← →", action: "Navegar entre abas" },
  { keys: "Setas ↑ ↓", action: "Navegar em menus, listas de mensagens e listas com opções" },
  { keys: "Home / End", action: "Ir ao primeiro ou ao último item de listas compatíveis" },
  { keys: "Ctrl+Enter", action: "Enviar mensagem na Mar.IA (sempre disponível)" },
  { keys: "/", action: "Focar a busca global (fora de campos de texto)" },
  { keys: "?", action: "Abrir esta lista de atalhos" },
  { keys: "Tab (pular conteúdo)", action: "Links “Pular para o conteúdo” aparecem no primeiro Tab da página" },
];

export function ShortcutsTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Atalhos de teclado disponíveis na Plataforma Maré</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Tecla</th>
            <th scope="col" className="px-3 py-2 font-semibold">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {PLATFORM_SHORTCUTS.map((shortcut) => (
            <tr key={shortcut.keys}>
              <th scope="row" className="whitespace-nowrap px-3 py-2 align-top font-medium text-navy-800">
                <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-sans">{shortcut.keys}</kbd>
              </th>
              <td className="px-3 py-2 text-slate-700">{shortcut.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
