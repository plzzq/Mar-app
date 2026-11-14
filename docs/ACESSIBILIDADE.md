# Acessibilidade e navegação por teclado — Plataforma Maré + Mar.IA

Escopo desta entrega: interface da Mar.IA, navegação por teclado em toda a plataforma,
painel de acessibilidade personalizável e suporte a leitores de tela.
**Sem backend** (como definido no pedido): preferências ficam em `localStorage` por usuário,
documentadas como substituíveis por uma tabela `user_preferences` no Supabase.

## 1. Componentes novos e aprimorados

### Novos
| Componente/página | Arquivo | O que faz |
|---|---|---|
| `AccessibilityProvider` | `src/contexts/AccessibilityContext.tsx` | Preferências globais (fonte, linhas, tema escuro, alto contraste, movimento reduzido, destaque de links, alvos grandes, fonte legível, som, duração dos avisos, Enter envia). Aplica atributos no `<html>`, persiste por usuário e reage a `prefers-reduced-motion`/`prefers-contrast`. |
| `AnnouncerProvider` / `useAnnounce` | `src/contexts/AnnouncerContext.tsx` | Duas regiões sr-only: `aria-live="polite"` e `aria-live="assertive"` para anúncios não intrusivos. |
| `AccessibilityPanel` | `src/components/accessibility/AccessibilityPanel.tsx` | Diálogo com todos os controles, pré-visualização do tamanho de fonte, restaurar padrões e lista de atalhos. |
| `ShortcutsTable` | `src/components/accessibility/ShortcutsTable.tsx` | Tabela acessível de atalhos (usada no painel, no rodapé e na tecla `?`). |
| `A11yReport` | `src/components/accessibility/A11yReport.tsx` | Verificação automatizada com **axe-core** (tags WCAG 2.0/2.1/2.2 A+AA) em três cenários: configurações atuais, tema escuro e alto contraste; lista violações com elemento e link de ajuda. |
| Utilitários de teclado | `src/lib/keyboard.ts` | `isTypingTarget`, `handleListKeys` (setas/Home/End) e `canUseGlobalShortcut` (nunca captura com modificador de navegador nem em digitação/diálogos). |
| CSS de preferências | `src/index.css` | Overrides para tema escuro, alto contraste, movimento reduzido, alvos de 44 px, fonte legível, espaçamento de linhas, foco sempre visível e links destacados. |

### Aprimorados
- **`Modal`**: focus trap com Tab/Shift+Tab, retorno do foco ao gatilho, Esc fecha, `aria-labelledby/describedby`.
- **Mar.IA**: rolagem do histórico com **renomear conversas** e **pesquisa**; mensagens navegáveis por setas ↑ ↓ com roving tabindex; **avaliação de respostas** (Útil/Revisar, `aria-pressed`); anúncio de “Nova resposta disponível” somente ao concluir (log com `aria-live="off"` — não lê o streaming); skip link “Pular para a conversa”; botão Acessibilidade; campo com `aria-keyshortcuts="Control+Enter"`, `aria-busy`, indicação de mensagem vazia e botão com `aria-disabled` (não perde foco).
- **Composer**: Enter envia (configurável) ou quebra linha; Shift+Enter sempre quebra; Ctrl+Enter sempre envia; dica de atalhos dinâmica e contador.
- **`ProfileMenu`**: setas ↑ ↓, Home/End, Esc fecha devolvendo o foco ao gatilho; itens com `tabIndex=-1` (menu roving).
- **Abas da fila de separação**: roving (`tabIndex` 0/-1), setas ← →, Home/End, `aria-controls` + painel com `tabIndex=0`.
- **Página de estoque**: visões Itens/Movimentações convertidas de abas para botões com `aria-pressed` (padrão simples e correto, sem `tabpanel` órfão).
- **`Toast`**: duração e som pelas preferências; `role="alert"` apenas em erros.
- **`AppLayout`**: foco no `main` a cada troca de rota (previsível, sem roubar foco na primeira carga), atalho `?`, links “Pular para o conteúdo” e rodapé com acesso aos atalhos.
- **IDs únicos** no checklist da separação via `useId` (evita rótulos/`aria-describedby` duplicados entre cartões).

## 2. Atalhos disponíveis (documentados na interface)

| Tecla | Ação |
|---|---|
| Tab / Shift+Tab | Avançar/voltar na ordem natural (nenhum `tabindex` positivo) |
| Enter / Espaço | Ativar botões e alternar; não afetam a digitação |
| Esc | Fechar diálogos, menus, gavetas; cancelar renomeação |
| ← → / Home / End | Abas e listas com padrão horizontal |
| ↑ ↓ / Home / End | Menu do perfil, histórico e mensagens da Mar.IA |
| Ctrl+Enter | Enviar mensagem na Mar.IA (sempre) |
| `/` | Focar a busca global (fora de campos e diálogos) |
| `?` | Abrir a lista de atalhos |
| Tab (primeiro item) | Link “Pular para o conteúdo”; na Mar.IA há também “Pular para a conversa” |

## 3. Telas com navegação por teclado validada por construção

Todas as rotas: Visão geral, Demandas, Solicitações (lista, cadastro, edição, detalhe), Estoque
(lista, movimentações, detalhe), Separação, Mar.IA, Relatórios, Histórico, Notificações,
Configurações, Perfil e Login. Cobrem menus, filtros colapsáveis, tabelas (versões de lista),
diálogos, abas, seletores, notificações e formulários com validação associada (`aria-invalid`
+ `aria-describedby`).

## 4. Suporte a leitores de tela (NVDA, JAWS, VoiceOver)

- HTML semântico: `header`/`main`/`aside`/`footer`, hierarquia h1 → h2 → h3 sem saltos (verificado por varredura).
- Rótulos e dicas em todos os campos; botões só-ícone com `aria-label`.
- Anúncios: `useAnnounce` para mensagens (polite) e erros urgentes (assertive); estados de carregamento com `role="status"`; contagens de resultado com `aria-live="polite"`.
- O log da Mar.IA não é região viva ao vivo (`aria-live="off"`), evitando leitura de cada palavra gerada.
- Tabelas com `caption`, `scope` e versões de lista para telas pequenas.
- Diálogos com título acessível e gerenciamento de foco (abrir → fechar → devolver).

## 5. Integrações com backend

- **Nenhuma chave/segredo no frontend.** A Mar.IA continua usando a fachada `marIAService`
  (provedor de demonstração claramente identificado; sem respostas falsas de IA real).
- Preferências: `localStorage` por usuário (`mare:a11y:v1:<userId>`), isoladas em
  `AccessibilityContext`. Com Supabase: mesmas assinaturas para `savePreferences(userId, prefs)`.
- Histórico de conversas: já passa por `conversationService` (renomear/excluir/avaliar persistem
  no armazenamento da sessão) — troca por Supabase não altera as telas.
- Erros de rede/indisponibilidade da IA: card de erro com `role="alert"` + “Tentar novamente”;
  texto da pergunta preservado; envio bloqueado durante geração (idempotente).

## 6. Testes executados e resultados

| Teste | Resultado |
|---|---|
| `npx tsc --noEmit` (strict) | **0 erros** |
| `npm run build` | **Sucesso** (dist/index.html gerado, 2,13 MB / 608 kB gzip com axe-core) |
| Varredura de hierarquia de títulos | **Sem h4/h5 órfãos** |
| Varredura de `aria-live` | **Coerente**: polite para contagens/anúncios, assertive só para erros, log da IA com live off |
| Verificação axe-core (3 cenários) | **Implementada na aplicação** — Configurações › “Executar verificação”. Precisa ser executada **no navegador**; não rodei um navegador neste ambiente, portanto **não declaro conformidade WCAG** sem esse resultado. |
| Testes manuais (Tab/Shift+Tab por tela, Esc em modais, foco após ações, leitores de tela reais, ampliação 200%, zoom do celular) | **Pendentes de verificação manual** — checklist na seção 7 |

## 7. Pendências e problemas conhecidos

1. **Executar o axe-core na aplicação** (Configurações › Testes de acessibilidade) e corrigir as
   violações apontadas — inclusive nos cenários escuro e alto contraste, cujo contraste final
   precisa de revisão visual.
2. **Testes manuais obrigatórios** (itens 1–15 do pedido): plataforma só com teclado; foco em
   modais; envio/edição/cancelamento de mensagens; estados de IA; alto contraste e ampliação;
   redução de animações; formulários com NVDA/VoiceOver/VoiceOver anúncios; atalhos sem
   prejudicar digitação; estoque/produção no teclado; larguras de tela; correção dos problemas
   encontrados.
3. **Tema escuro** é feito por overrides de classes: funcional, mas sem revisão visual — ajustar
   se o axe apontar contraste (regra `color-contrast`).
4. **Som** está ligado a avisos (toasts), não a eventos da conversa; se desejado, adicionar
   `notifySound` na conclusão da resposta da Mar.IA.
5. **Backend inexistente**: nada sincronizado entre dispositivos; conversas e preferências são
   locais. A fiação (interfaces) está pronta para Supabase Auth/DB/Realtime.
6. Áudio do aviso depende de `AudioContext` suportado (falha silenciosa fora dele).
