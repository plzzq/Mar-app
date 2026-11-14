# Auditoria completa — Plataforma Maré (fábrica de produtos para cães)

Data: outubro/2026 · Escopo: frontend, regras de negócio, dados, integrações, permissões e UX.
Abordagem: preservar a arquitetura existente; corrigir e implementar de forma organizada.

## 1. Funcionalidades que já existiam e foram validadas (preservadas)

- Layout com sidebar recolhível, cabeçalho com busca global, notificações e perfil.
- Dashboard com indicadores calculados dos dados + gráficos (Recharts).
- Demandas em quadro por etapa, solicitações com filtros/ordenação/paginação/CSV.
- Fluxo de status com transições permitidas, separação com checklist e progresso.
- Mar.IA com streaming, interrupção, histórico, copiar/ouvir, modo demonstração.
- Relatórios, histórico/rastreabilidade, notificações, perfil, configurações.
- Todos os botões anteriores executavam ações reais — nenhum botão decorativo encontrado.
- Identidade visual Maré mantida (apenas selos de status estendidos).

## 2. Problemas encontrados e corrigidos

| # | Problema | Correção |
|---|---|---|
| 1 | Dados de outro segmento (metalurgia: chapas, eletrodos, sensores) | Base refeita para fábrica de produtos para cães (16 itens, 6 categorias oficiais, 14 solicitações) |
| 2 | Sem cancelamento de solicitação | Status `Cancelada` + `cancelRequest` com motivo obrigatório, banner, notificação e histórico |
| 3 | Sem desfazer/recuperar | `undoService` (snapshots) + toast com botão Desfazer em todas as mutações |
| 4 | Formulário sem aviso de saída | `useUnsavedChanges` (bloqueio de rota + beforeunload) + Descartar com confirmação + Restaurar valores |
| 5 | Estoque sem cadastro/edição/saída/histórico | CRUD completo, entradas/saídas/ajustes rastreáveis, estorno por compensação, desativação com trava |
| 6 | Edição direta de saldo apagaria histórico | Saldo só muda por movimentação; formulário de cadastro não altera saldo na edição |
| 7 | Saída acima do saldo permitida? | Bloqueada no serviço (`applyMovementBalance`) e no backend (função SQL) |
| 8 | Clique duplo duplicava operação | Chaves de idempotência (frontend + UNIQUE no banco + RPC transacional) |
| 9 | Sem permissões | Matriz por perfil aplicada nos serviços + troca de perfil para teste + RLS no schema |
| 10 | Dados perdidos ao recarregar | Cache local versionado (`mare:state:v2`) com restauração |
| 11 | Solicitações canceladas poluíam indicadores | Métricas excluem canceladas de reservas, prazos e separação; faixa própria nos gráficos |
| 12 | Stepper quebrava com 7º status | `StatusStepper` trata Cancelada em destaque próprio |
| 13 | Quadro de demandas sem coluna p/ canceladas | Faixa "N cancelada(s)" com link para Solicitações |
| 14 | Mar.IA citava itens antigos | Seeds de conversa atualizadas + trata status Cancelada nas respostas |
| 15 | localStorage como única saída futura | Repositórios Supabase + `schema.sql` + cliente com detecção por env |

## 3. Funcionalidades novas implementadas

- **Estoque:** Adicionar item (SKU único, categoria oficial, fornecedor, custo, ativo), editar cadastro, desativar/reativar com trava de solicitações em aberto, entrada/saída/ajuste com motivo, aba Movimentações com estorno, histórico por item.
- **Solicitações:** cancelar com motivo, faixa de cancelamento, criado por/atualizado por, desfazer criação/edição/status/separação, anti-duplicação no cadastro.
- **Formulários:** aviso de alterações não salvas, descartar com confirmação, restaurar valores, materiais inativos bloqueados na seleção.
- **Permissões:** 4 perfis (admin, PCP, almoxarifado, produção) + leitura na matriz; troca de perfil em Configurações; backend: RLS + RPC `security definer`.
- **Testes:** `services/selfTest.ts` com 14 fluxos + tela de execução em Configurações (ambiente isolado, restaura tudo).
- **Supabase:** `src/services/supabase/{client,repositories}.ts`, `supabase/schema.sql` (tabelas, checks, função transacional, RLS), Auth real quando configurado.

## 4. Alterações no Supabase

Nenhuma alteração aplicada (sem credenciais nesta etapa). Entregue pronto para aplicar:
1. Criar projeto no Supabase → SQL Editor → executar `supabase/schema.sql`.
2. Criar usuários em Authentication → inserir perfis em `profiles` (role_key).
3. Configurar `.env`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (nunca `service_role` no frontend).
4. Rebuildar. Os serviços passam a usar Auth real; os repositórios estão prontos para assumir as leituras/escritas mantendo as assinaturas.

## 5. Dados substituídos

Apenas seeds fictícios (prefixos MAT-1xxx/SOL metalúrgicos) substituídos por seeds fictícios do segmento pet (MAT-2xxx). Nenhum dado real existia; nenhum histórico real foi apagado. Migração futura: importar cadastros reais via `createMaterial` (valida SKU/categoria) — plano em `supabase/schema.sql` (rodar com IF NOT EXISTS, sem deletes).

## 6. Testes executados e resultados

Verificação automatizada (`Configurações > Testes`, 14 fluxos, ambiente isolado com restauração):
1. Cadastro persiste · 2. Entrada atualiza saldo+histórico · 3. Saída atualiza+histórico · 4. Saída acima do saldo bloqueada, saldo intacto · 5. Edição não altera saldo · 6. Cancelamento exige motivo ≥10 e preserva · 7. Reservas liberadas após cancelar · 8. Desfazer restaura · 9. Matriz de permissões íntegra · 10. Idempotência ignora repetição · 11. Estorno compensa sem apagar; 2º estorno bloqueado · 12. Cache versionado gravado · 13. Indicadores = registros · 14. Cancelar concluída recusado.
`tsc --noEmit`: 0 erros. `npm run build`: sucesso. Testes manuais em desktop/celular e duas sessões (troca de perfil) recomendados antes da publicação.

## 7. Pendências (dependem de intervenção manual)

- Criar projeto Supabase, aplicar schema, criar usuários e configurar `.env` (seção 4).
- Ligar os serviços aos repositórios Supabase (troca interna, sem mudar telas) e ativar Realtime.
- Conectar a Mar.IA ao modelo (provedor remoto) e publicar na Vercel.
- Revisar e-mails/UUIDs nas políticas RLS de escrita antes de ativar em produção.
