# Plataforma Maré + Mar.IA — Frontend (protótipo)

Frontend completo para organizar solicitações de materiais, antecipar a separação de itens para a produção e melhorar a comunicação entre **PCP**, **almoxarifado** e **produção**, com a assistente de inteligência artificial **Mar.IA**.

> **Fase atual:** frontend de sistema real para **fábrica de produtos para cães**, com
> **cache local versionado** (persiste ao recarregar) e camada Supabase pronta
> (`supabase/schema.sql` + `src/services/supabase`). Sem credenciais configuradas,
> os serviços usam o armazenamento local com as mesmas assinaturas.
> Relatório completo da auditoria em [`docs/AUDITORIA.md`](docs/AUDITORIA.md).
> Acessibilidade, teclado, painel de preferências e verificação axe-core em
> [`docs/ACESSIBILIDADE.md`](docs/ACESSIBILIDADE.md).

---

## Como executar

Pré-requisitos: Node.js 20+ e npm.

```bash
npm install            # se houver erro de peer dependencies: npm install --legacy-peer-deps
npm run dev            # servidor de desenvolvimento (Vite)
npm run build          # gera dist/index.html (arquivo único, sem dependências externas)
npm run preview        # visualiza o build de produção
```

Como o build usa `vite-plugin-singlefile`, o resultado é um único `dist/index.html`. A aplicação usa **HashRouter** (`/#/rota`), o que permite abrir qualquer tela diretamente em qualquer servidor estático, inclusive na Vercel, sem configuração de rewrites.

### Acesso de demonstração
- Na tela de login, **qualquer identificação válida** (e-mail ou matrícula) e **senha com 6 caracteres ou mais** entram na demonstração.
- A senha `erro` simula uma falha de serviço, para testar o estado de erro.
- Não há autenticação real nesta fase.

---

## Funcionalidades

### Prontas para demonstração
| Módulo | Rota | Destaques |
|---|---|---|
| Login | `/login` | Validação, mostrar/ocultar senha, erro acessível, aviso de modo demonstração |
| Visão geral | `/` | 6 indicadores calculados dos dados, gráficos (status, prioridade, evolução, setores, separação), alertas de prazo, avisos de material, atividades recentes |
| Demandas de produção | `/demandas` | Quadro por etapa do fluxo, filtros por setor e prioridade, pesquisa |
| Solicitações | `/solicitacoes` | Pesquisa, filtros (status, prioridade, setor, período), ordenação, paginação, exportação CSV, estados de carregamento, erro e vazio |
| Nova / editar solicitação | `/solicitacoes/nova`, `/solicitacoes/:id/editar` | React Hook Form, validação de campos, alerta de diferença entre necessário e saldo livre, confirmação ao salvar edições |
| Detalhe da solicitação | `/solicitacoes/:id` | Fluxo de status, itens com separado/pendente/disponível, alerta de insuficiência, histórico, ações com confirmação |
| Estoque | `/estoque` | Situação (Normal, Baixo, Insuficiente, Indisponível), reservado, saldo livre, filtros, ordenação |
| Detalhe do material | `/estoque/:id` | Indicadores, alerta de diferença, solicitações que usam o item, registro de entrada (demonstração) |
| Separação de materiais | `/separacao` | Fila por prioridade e prazo, checklist por item, separar item/tudo, informar insuficiência, concluir separação, visualizar pendências |
| Mar.IA | `/mar-ia` | Boas-vindas, sugestões, streaming, interromper, copiar, ouvir, tentar novamente, histórico de conversas, Enter/Shift+Enter, respostas com tabelas e listas |
| Relatórios | `/relatorios` | Indicadores por período, cumprimento de prazos, tempo de atendimento, desempenho por responsável, exportação CSV |
| Histórico | `/historico` | Linha do tempo de rastreabilidade, filtros, paginação, exportação CSV |
| Notificações | `/notificacoes` | Categorias, lidas/não lidas, marcar todas |
| Configurações | `/configuracoes` | Preferências de notificação, teste de leitura em voz alta, restauração dos dados, status das integrações |
| Perfil | `/perfil` | Edição com validação e espaço para preferências futuras |

Transversais: sidebar recolhível (desktop) e gaveta (celular), busca global (atalho `/`), centro de notificações, menu do usuário, breadcrumbs, toasts, leitura da página em voz alta (Web Speech API), layout responsivo sem rolagem horizontal desnecessária, foco visível e rótulos em todos os campos.

### Dependem de integrações futuras
- **Persistência real** (Supabase): hoje os dados ficam em memória e voltam ao estado inicial ao recarregar.
- **Autenticação real**: a sessão é apenas demonstrativa.
- **Mar.IA com modelo de linguagem**: as respostas são **demonstrativas**, derivadas dos dados fictícios. Perguntas fora do conjunto suportado informam que a IA real ainda não está configurada.
- **Notificações em tempo real** e **exportações** oficiais: a interface já está preparada.

---

## Mar.IA: como funciona agora

As respostas do modo de demonstração são calculadas a partir do **contexto operacional** (`services/marIA/context.ts`), a mesma estrutura que o backend enviará no futuro. Cada resposta separa:

- **Dado confirmado** — informação registrada.
- **Cálculo derivado** — resultado de uma conta sobre os dados.
- **Recomendação** — sugestão operacional, sem alterar solicitações, estoque ou status.

Comandos úteis para testar:
- `/ajuda` — lista de capacidades.
- `/erro` — simula falha do serviço (com botão “Tentar novamente”).
- `/limite` — simula limite de requisições.
- `SOL-2026-001` (ou outro código) — situação de uma solicitação específica.

---

## Estrutura do projeto

```
src/
├── App.tsx                      Rotas (HashRouter), rota protegida e layout
├── index.css                    Tema Tailwind (paleta Maré, animações)
├── types/index.ts               Tipos do domínio e do chat
├── lib/
│   ├── businessRules.ts         Regras de negócio puras (status, prazos, estoque, separação)
│   ├── metrics.ts               Indicadores de painel e relatórios
│   ├── schemas.ts               Validações Zod (solicitação, login, perfil)
│   ├── errors.ts                Erros de domínio
│   └── utils.ts                 Datas, números, CSV, texto
├── services/                    CAMADA DE DADOS — substituível pelo Supabase
│   ├── demo/demoData.ts         Dados fictícios consistentes
│   ├── demo/demoDb.ts           Armazenamento em memória + assinatura de mudanças
│   ├── requestsService.ts       Solicitações, status, separação, insuficiência
│   ├── stockService.ts          Estoque e entradas
│   ├── activityService.ts       Histórico e notificações
│   ├── userService.ts           Login (demo) e perfil
│   ├── conversationService.ts   Conversas da Mar.IA
│   └── marIA/                   Camada independente da Mar.IA
│       ├── types.ts             Contrato MarIAProvider, erros e contexto
│       ├── context.ts           Contexto operacional estruturado
│       ├── demoProvider.ts      Provedor de demonstração (streaming, erros simulados)
│       └── index.ts             Fachada marIAService + provedor remoto (não configurado)
├── hooks/                       useQuery (carregamento/erro/atualização), useSpeech, useClickOutside
├── contexts/                    AuthContext (demo) e ToastContext
├── features/marIA/              Componentes e estado do chat (useChat, Markdown, composer)
├── components/
│   ├── ui/                      Botões, cartões, badges, formulários, modal, estados
│   ├── common/                  Badges de domínio, cabeçalho de página, indicadores, logo
│   ├── charts/                  Gráficos Recharts
│   ├── layout/                  AppLayout, Sidebar, Topbar, busca, notificações, perfil
│   └── requests/                Lista de solicitações (tabela/cartões), etapas e histórico
└── pages/                       Uma página por rota
```

### Princípios
- As **regras de negócio** ficam em `lib/businessRules.ts` e nos serviços, sem JSX. As telas só chamam serviços.
- Todos os serviços são **assíncronos** e tipados. Trocar a demonstração por consultas reais não exige reescrever páginas.
- Nenhuma chave de API, credencial ou variável de ambiente é usada. Não há `localStorage` como banco.

---

## Regras de negócio configuráveis

Em `src/lib/businessRules.ts`:

- **`STATUS_TRANSITIONS`**: fluxo permitido entre status (Pendente → Em análise → Aguardando materiais / Em separação → Pronta para disponibilização → Concluída). Altere este mapa para adaptar o processo.
- **`TRANSITIONS_REQUIRING_CONFIRMATION`**: transições que exigem confirmação.
- **`NEAR_DEADLINE_DAYS`**: antecedência para alertas de prazo próximo (2 dias).
- **Estoque**: `computeMaterialMetrics` define reservado (separação em andamento), demanda em aberto, saldo livre, saldo projetado e situação.
- **Separação**: a solicitação só pode iniciar a separação sem faltas de material, e só pode ficar pronta com todos os itens separados.

---

## Plano de integração futura

| Integração | Onde trocar | O que já está pronto |
|---|---|---|
| **Supabase (dados)** | `services/demo/demoDb.ts` e os `*Service.ts` | Assinaturas assíncronas; `useQuery` já reage a mudanças (base para Realtime) |
| **Autenticação** | `services/userService.ts` (`signIn`) e `contexts/AuthContext.tsx` | Tela de login, rota protegida, perfil |
| **Mar.IA (IA real)** | `services/marIA/index.ts` (criar `createRemoteProvider` com o endpoint seguro do backend) | Contrato `MarIAProvider`, streaming (`onChunk`), `AbortSignal`, erros tipados (`rate_limit`, `unavailable`, `not_configured`), histórico, contexto operacional |
| **Notificações reais** | `services/activityService.ts` | Centro de notificações com leitura e não leitura |
| **Vercel** | Nenhuma alteração necessária | Build estático único, HashRouter |

Para a IA real, o frontend deve chamar apenas um endpoint seguro do backend, sem chaves no navegador. O backend deve enviar o contexto operacional já filtrado pela autorização do usuário.

---

## Identidade visual
- Densidade alta e hierarquia feita por **bordas de 1 px**, não por volume: nada de cartões muito arredondados, sombras macias ou gradientes decorativos.
- Raio de canto pequeno e uniforme, definido nos tokens `--radius-*` de `src/index.css`, o que dá aspecto de sistema industrial em vez de aplicativo.
- Azul-marinho como cor principal, azul-claro nos elementos de apoio, verde para concluído, âmbar para alerta e vermelho para atraso ou erro.
- Ícones Lucide sempre acompanhados de texto quando definem um estado.
- Sem "efeito de levitar" nos cartões ao passar o mouse: o realce é feito pela cor da borda.

## Acessibilidade e responsividade
- Contraste adequado, foco visível e navegação por teclado (atalho `/` para pesquisar).
- Campos com rótulo, dica e mensagem de erro associados (`aria-describedby`, `aria-invalid`).
- Estados que não dependem só da cor: ícone e texto em cada badge.
- Leitura em voz alta da página e das respostas da Mar.IA (Web Speech API), com botões para iniciar e interromper.
- Respeita `prefers-reduced-motion`.

### Comportamento no celular
- Cabeçalho em duas linhas: marca e ações na primeira, busca em campo largo na segunda.
- Filtros recolhidos em um painel único, com contador de filtros ativos.
- Tabelas viram listas compactas, sem rolagem horizontal forçada.
- Barra de ações fixa no rodapé do formulário de solicitação, para salvar sem rolar até o fim.
- Alvos de toque de 44 px nos botões de ícone.
- A Mar.IA ocupa a altura útil da tela: o campo de pergunta fica sempre visível e o histórico vira uma gaveta.
