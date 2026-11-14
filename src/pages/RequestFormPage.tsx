import { Component, useState, type ReactNode, type ErrorInfo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowLeft, FileText, History, Info, Package, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { PageHeader, type Crumb } from "@/components/common/PageHeader";
import { Button, Card, CardHeader, ErrorState, LoadingState, buttonClasses } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/forms";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useQuery } from "@/hooks/useQuery";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import type { ProductionRequest } from "@/types";
import { PRIORITIES, SECTORS, type Priority, type RequestInput, type Sector } from "@/types";
import { isTerminal } from "@/lib/businessRules";
import { getErrorMessage } from "@/lib/errors";
import { dateOffset, formatNumber } from "@/lib/utils";
import { createOperationKey } from "@/services/demo/demoDb";
import { createRequest, getRequestAnalysis, updateRequest } from "@/services/requestsService";
import { undoLastAction } from "@/services/undoService";
import { listMaterials, type MaterialView } from "@/services/stockService";

interface FormValues {
  description: string;
  sector: Sector | "";
  responsible: string;
  priority: Priority;
  dueDate: string;
  notes: string;
  items: { materialId: string; requested: number }[];
}

export function RequestFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const materialsQuery = useQuery(listMaterials);
  const requestQuery = useQuery(async () => (id ? getRequestAnalysis(id) : null), [id]);

  const crumbs: Crumb[] = [
    { label: "Visão geral", to: "/" },
    { label: "Solicitações", to: "/solicitacoes" },
    isEdit && requestQuery.data
      ? { label: requestQuery.data.request.code, to: `/solicitacoes/${id}` }
      : { label: "Nova solicitação" },
    ...(isEdit ? [{ label: "Editar" }] : []),
  ];

  const header = (
    <PageHeader
      title={isEdit ? "Editar solicitação" : "Nova solicitação de materiais"}
      description={
        isEdit
          ? "Altere os dados ou os materiais. Itens já separados não podem ser alterados."
          : "Registre a demanda, os materiais e as quantidades necessárias para a produção."
      }
      breadcrumbs={crumbs}
    />
  );

  if (materialsQuery.loading || (isEdit && requestQuery.loading)) {
    return (
      <>
        {header}
        <LoadingState label={isEdit ? "Carregando solicitação…" : "Carregando formulário…"} rows={5} />
      </>
    );
  }

  if (requestQuery.error || materialsQuery.error) {
    const error = requestQuery.error ?? materialsQuery.error;
    return (
      <>
        {header}
        <ErrorState
          title={error?.message === "Solicitação não encontrada." ? "Solicitação não encontrada" : "Não foi possível carregar o formulário"}
          message={error?.message}
          onRetry={() => {
            requestQuery.refetch();
            materialsQuery.refetch();
          }}
        />
      </>
    );
  }

  if (!materialsQuery.data || (isEdit && !requestQuery.data)) {
    return (
      <>
        {header}
        <LoadingState rows={4} />
      </>
    );
  }

  const analysis = requestQuery.data;
  if (analysis && isTerminal(analysis.request.status)) {
    return (
      <>
        {header}
        <Card className="p-6 text-center">
          <p className="font-semibold text-slate-900">
            {analysis.request.status === "Cancelada" ? "Esta solicitação foi cancelada." : "Esta solicitação já foi concluída."}
          </p>
          <p className="mt-1 text-sm text-slate-600">Solicitações concluídas ou canceladas são somente para consulta. O histórico foi preservado.</p>
          <Link to={`/solicitacoes/${analysis.request.id}`} className={buttonClasses("primary", "md", "mt-5")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para a solicitação
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <FormErrorBoundary>
        <RequestForm
          key={analysis?.request.id ?? "new"}
          mode={isEdit ? "edit" : "create"}
          request={analysis?.request}
          materials={materialsQuery.data}
        />
      </FormErrorBoundary>
    </>
  );
}

class FormErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RequestFormPage] Erro no formulário:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-6 text-center">
          <p className="font-semibold text-rose-900">Não foi possível carregar o formulário</p>
          <p className="mt-1 text-sm text-rose-800">{this.state.error.message}</p>
          <Link to="/solicitacoes" className="mt-4 inline-block text-sm text-navy-700 underline">
            Voltar para solicitações
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequestForm({
  mode,
  request,
  materials,
}: {
  mode: "create" | "edit";
  request?: ProductionRequest;
  materials: MaterialView[];
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [opKey] = useState(() => createOperationKey());
  const today = dateOffset(0);

  const defaultValues: FormValues = request
    ? {
        description: request.description,
        sector: request.sector,
        responsible: request.responsible,
        priority: request.priority,
        dueDate: request.dueDate,
        notes: request.notes ?? "",
        items: request.items.map((i) => ({ materialId: i.materialId, requested: i.requested })),
      }
    : {
        description: "",
        sector: "",
        responsible: "",
        priority: "Média",
        dueDate: dateOffset(7),
        notes: "",
        items: [{ materialId: "", requested: 1 }],
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues, mode: "onTouched" });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" }) ?? [];

  useUnsavedChanges(isDirty && !submitted && !confirmOpen);

  const notifyUndone = () => {
    const label = undoLastAction(user.name);
    toast({
      title: label ? "Operação desfeita" : "Nada para desfazer",
      description: label ?? undefined,
      variant: label ? "success" : "warning",
    });
  };

  const save = async (values: FormValues) => {
    setSaving(true);
    const input: RequestInput = {
      description: values.description,
      sector: values.sector as Sector,
      responsible: values.responsible,
      priority: values.priority,
      dueDate: values.dueDate,
      notes: values.notes || undefined,
      items: values.items.map((i) => ({ materialId: i.materialId, requested: Number(i.requested) })),
    };
    try {
      if (mode === "create") {
        const created = await createRequest(input, opKey);
        setSubmitted(true);
        toast({
          title: "Solicitação cadastrada",
          description: `${created.code} foi registrada como Pendente.`,
          variant: "success",
          action: { label: "Desfazer", onClick: notifyUndone },
        });
        navigate(`/solicitacoes/${created.id}`);
      } else if (request) {
        const updated = await updateRequest(request.id, input);
        setSubmitted(true);
        toast({
          title: "Alterações salvas",
          description: `${updated.code} foi atualizada.`,
          variant: "success",
          action: { label: "Desfazer", onClick: notifyUndone },
        });
        navigate(`/solicitacoes/${updated.id}`);
      }
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getErrorMessage(error), variant: "error" });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    if (mode === "edit") {
      setPendingValues(values);
      setConfirmOpen(true);
    } else {
      void save(values);
    }
  };

  const cancelHref = request ? `/solicitacoes/${request.id}` : "/solicitacoes";

  return (
    <>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4 pb-24 lg:pb-0 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Dados da demanda" icon={FileText} />
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Textarea
                id="description"
                label="Descrição da demanda"
                required
                wrapperClassName="md:col-span-2"
                hint="Informe o produto, lote ou ordem relacionada e o que será produzido ou reparado."
                error={errors.description?.message}
                {...register("description", {
                  required: "Informe a descrição da demanda.",
                  minLength: { value: 10, message: "A descrição deve ter pelo menos 10 caracteres." },
                  maxLength: { value: 180, message: "A descrição deve ter no máximo 180 caracteres." },
                })}
              />
              <Select
                id="sector"
                label="Setor solicitante"
                required
                error={errors.sector?.message}
                {...register("sector", { required: "Selecione o setor solicitante." })}
              >
                <option value="">Selecione…</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Input
                id="responsible"
                label="Responsável"
                required
                error={errors.responsible?.message}
                {...register("responsible", {
                  required: "Informe o responsável.",
                  minLength: { value: 3, message: "Informe o nome do responsável." },
                })}
              />
              <Select id="priority" label="Prioridade" required error={errors.priority?.message} {...register("priority", { required: "Selecione a prioridade." })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <Input
                id="dueDate"
                type="date"
                label="Prazo de atendimento"
                required
                min={mode === "create" ? today : undefined}
                error={errors.dueDate?.message}
                {...register("dueDate", {
                  required: "Informe o prazo de atendimento.",
                  validate: (value) => mode === "edit" || value >= today || "O prazo não pode ser anterior a hoje.",
                })}
              />
              <Textarea
                id="notes"
                label="Observações"
                wrapperClassName="md:col-span-2"
                hint="Opcional. Ex.: restrições de entrega ou instruções para o almoxarifado."
                error={errors.notes?.message}
                {...register("notes", { maxLength: { value: 500, message: "As observações devem ter no máximo 500 caracteres." } })}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Materiais necessários"
              description="A verificação compara a quantidade com o saldo livre do estoque (disponível menos reservado)."
              icon={Package}
              actions={
                <Button variant="outline" size="sm" onClick={() => append({ materialId: "", requested: 1 })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar material
                </Button>
              }
            />
            <div className="space-y-3 p-5">
              {fields.map((field, index) => {
                const row = watchedItems[index];
                const material = materials.find((m) => m.id === row?.materialId);
                const qty = Number(row?.requested) || 0;
                const free = material?.freeBalance ?? 0;
                const shortage = material && qty > free ? qty - free : 0;
                const duplicated = watchedItems.filter((i) => i?.materialId && i.materialId === row?.materialId).length > 1;
                const itemErrors = errors.items?.[index];

                return (
                  <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-[minmax(0,1fr)_170px_auto] md:items-start">
                    <Select
                      id={`item-${index}-material`}
                      label={`Material ${index + 1}`}
                      required
                      error={itemErrors?.materialId?.message ?? (duplicated ? "Este material já foi adicionado." : undefined)}
                      {...register(`items.${index}.materialId`, { required: "Selecione um material." })}
                    >
                      <option value="">Selecione…</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id} disabled={!m.active}>
                          {m.code} · {m.name} ({formatNumber(m.available)} {m.unit} em estoque){!m.active ? " — inativo" : ""}
                        </option>
                      ))}
                    </Select>
                    <Input
                      id={`item-${index}-qty`}
                      label="Quantidade"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      required
                      error={itemErrors?.requested?.message}
                      hint={material ? `Saldo livre: ${formatNumber(free)} ${material.unit}` : "Selecione um material"}
                      {...register(`items.${index}.requested`, {
                        valueAsNumber: true,
                        required: "Informe a quantidade.",
                        min: { value: 1, message: "A quantidade deve ser maior que zero." },
                        validate: (value) => Number.isInteger(value) || "A quantidade deve ser um número inteiro.",
                      })}
                    />
                    <div className="md:pt-7">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label={`Remover material ${index + 1}`}
                        className="flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:cursor-not-allowed disabled:opacity-40 md:h-10 md:w-10"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    {shortage > 0 && (
                      <p role="alert" className="flex gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 ring-1 ring-rose-200 md:col-span-3">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          Necessário {formatNumber(qty)} {material?.unit}, disponível livre {formatNumber(free)} {material?.unit}.
                          Diferença: faltam {formatNumber(shortage)} {material?.unit}. A solicitação poderá aguardar materiais.
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <aside className="hidden space-y-4 lg:block">
          <Card>
            <CardHeader title="Regras aplicadas" icon={Info} />
            <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-slate-600">
              <li>Toda solicitação começa como <strong>Pendente</strong>.</li>
              <li>A separação só é iniciada sem faltas de material.</li>
              <li>Itens separados não podem ser removidos da solicitação.</li>
              <li>Solicitações concluídas ou canceladas não podem ser editadas.</li>
              <li>Após salvar, é possível <strong>desfazer</strong> pelo aviso de confirmação.</li>
            </ul>
          </Card>
          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" loading={saving && mode === "create"}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {mode === "create" ? "Cadastrar solicitação" : "Salvar alterações"}
            </Button>
            {mode === "edit" && (
              <Button variant="ghost" onClick={() => reset()} disabled={!isDirty || saving}>
                <History className="h-4 w-4" aria-hidden="true" />
                Restaurar valores anteriores
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => (isDirty ? setDiscardOpen(true) : navigate(cancelHref))}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Descartar alterações
            </Button>
          </div>
        </aside>

        {/* Barra de ações fixa no celular: salva sem exigir rolagem até o fim do formulário. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button type="submit" size="lg" className="flex-1" loading={saving && mode === "create"}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {mode === "create" ? "Cadastrar" : "Salvar"}
            </Button>
            <button type="button" onClick={() => (isDirty ? setDiscardOpen(true) : navigate(cancelHref))} className={buttonClasses("outline", "lg")} aria-label="Descartar alterações">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Descartar</span>
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Salvar alterações?"
        description={`As alterações em ${request?.code ?? "esta solicitação"} serão registradas no histórico.`}
        confirmLabel="Salvar alterações"
        loading={saving}
        onConfirm={() => pendingValues && void save(pendingValues)}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={discardOpen}
        title="Descartar alterações?"
        description="Há alterações não salvas. Elas serão perdidas se você sair agora."
        confirmLabel="Descartar"
        tone="danger"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          setSubmitted(true);
          navigate(cancelHref);
        }}
      />
    </>
  );
}
