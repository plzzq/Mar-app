import { useEffect, useMemo, useState } from "react";
import { Eye, Layers, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoBadge } from "@/components/common/Widgets";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Input, Select, Textarea, ToggleField } from "@/components/ui/forms";
import { useToast } from "@/contexts/ToastContext";
import { useQuery } from "@/hooks/useQuery";
import { cn, formatNumber, normalizeText } from "@/lib/utils";
import {
  createBomTemplate,
  listBomTemplates,
  setBomTemplateActive,
  suggestBomCode,
  updateBomTemplate,
  type BomTemplateView,
} from "@/services/bomService";
import { listMaterials } from "@/services/stockService";
import { STOCK_CATEGORIES, type BomTemplateInput } from "@/types";

type Tab = "templates" | "form";

interface BomFormItem {
  materialId: string;
  quantity: number;
}

interface FormErrors {
  name?: string;
  code?: string;
  description?: string;
  productCategory?: string;
  items?: string;
}

function initialForm(): {
  name: string;
  code: string;
  description: string;
  productCategory: string;
  active: boolean;
  items: BomFormItem[];
} {
  return { name: "", code: "", description: "", productCategory: "", active: true, items: [] };
}

export function BomPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = useQuery(listBomTemplates);
  const materialsQuery = useQuery(listMaterials);

  const [tab, setTab] = useState<Tab>("templates");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState(initialForm());
  const [errors, setErrors] = useState<FormErrors>({});

  // Item adder
  const [matSearch, setMatSearch] = useState("");
  const [itemQty, setItemQty] = useState<string>("");
  const [selectedMatId, setSelectedMatId] = useState("");
  const [itemError, setItemError] = useState("");

  const templates = useMemo(() => {
    const term = normalizeText(search);
    return (data ?? []).filter((t) => {
      if (!term) return true;
      return normalizeText(`${t.code} ${t.name} ${t.productCategory}`).includes(term);
    });
  }, [data, search]);

  const detailTemplate = useMemo(
    () => (detailId ? (data ?? []).find((t) => t.id === detailId) ?? null : null),
    [data, detailId],
  );

  const materials = materialsQuery.data ?? [];

  const filteredMats = useMemo(() => {
    const term = normalizeText(matSearch);
    if (!term) return materials.filter((m) => m.active).slice(0, 20);
    return materials
      .filter((m) => m.active && normalizeText(`${m.code} ${m.name}`).includes(term))
      .slice(0, 20);
  }, [materials, matSearch]);

  function openNew() {
    setEditId(null);
    setForm(initialForm());
    setErrors({});
    setMatSearch("");
    setItemQty("");
    setSelectedMatId("");
    setItemError("");
    setTab("form");
  }

  function openEdit(template: BomTemplateView) {
    setEditId(template.id);
    setForm({
      name: template.name,
      code: template.code,
      description: template.description,
      productCategory: template.productCategory,
      active: template.active,
      items: template.items.map((i) => ({ materialId: i.materialId, quantity: i.quantity })),
    });
    setErrors({});
    setMatSearch("");
    setItemQty("");
    setSelectedMatId("");
    setItemError("");
    setDetailId(null);
    setTab("form");
  }

  function cancelForm() {
    setTab("templates");
    setEditId(null);
    setErrors({});
  }

  async function handleSuggestCode() {
    try {
      const code = await suggestBomCode();
      setForm((f) => ({ ...f, code }));
    } catch {
      // silent
    }
  }

  function addItem() {
    setItemError("");
    if (!selectedMatId) {
      setItemError("Selecione um material.");
      return;
    }
    const qty = parseFloat(itemQty);
    if (!qty || qty <= 0) {
      setItemError("Informe uma quantidade maior que zero.");
      return;
    }
    if (form.items.some((i) => i.materialId === selectedMatId)) {
      setItemError("Este material já foi adicionado.");
      return;
    }
    setForm((f) => ({ ...f, items: [...f.items, { materialId: selectedMatId, quantity: qty }] }));
    setSelectedMatId("");
    setMatSearch("");
    setItemQty("");
  }

  function removeItem(materialId: string) {
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.materialId !== materialId) }));
  }

  async function handleSubmit() {
    const newErrors: FormErrors = {};
    if (!form.name.trim() || form.name.trim().length < 3)
      newErrors.name = "O nome deve ter pelo menos 3 caracteres.";
    if (!form.code.trim() || form.code.trim().length < 3)
      newErrors.code = "O código deve ter pelo menos 3 caracteres.";
    if (!form.productCategory) newErrors.productCategory = "Selecione a categoria do produto.";
    if (form.items.length === 0) newErrors.items = "Adicione ao menos um material ao BOM.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const input: BomTemplateInput = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim(),
      productCategory: form.productCategory,
      items: form.items,
      active: form.active,
    };

    setSaving(true);
    try {
      if (editId) {
        await updateBomTemplate(editId, input);
        toast({ title: "Template atualizado", description: `${input.code} · ${input.name} atualizado com sucesso.`, variant: "success" });
      } else {
        await createBomTemplate(input);
        toast({ title: "Template cadastrado", description: `${input.code} · ${input.name} criado com sucesso.`, variant: "success" });
      }
      refetch();
      cancelForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar o template.";
      setErrors({ name: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    try {
      await setBomTemplateActive(id, active);
      refetch();
    } catch {
      toast({ title: "Erro", description: "Não foi possível alterar o status.", variant: "error" });
    }
  }

  // Suggest code when switching to new form
  useEffect(() => {
    if (tab === "form" && !editId && form.code === "") {
      suggestBomCode()
        .then((code) => setForm((f) => (f.code === "" ? { ...f, code } : f)))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editId]);

  return (
    <>
      <div className="mb-3">
        <DemoBadge />
      </div>

      <PageHeader
        title="Bill of Materials"
        description="Defina a composição (receita) de cada produto acabado: materiais, quantidades e custo estimado."
        breadcrumbs={[{ label: "Visão geral", to: "/" }, { label: "Bill of Materials" }]}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo template
          </Button>
        }
      />

      {/* Abas */}
      <div role="group" aria-label="Visões do BOM" className="mb-4 flex gap-2">
        {(["templates", "form"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => {
              if (t === "templates") cancelForm();
              else openNew();
            }}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "bg-navy-800 text-white"
                : "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
            )}
          >
            {t === "templates"
              ? "Templates"
              : editId
              ? "Editar template"
              : "Novo template"}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* ABA: LISTA DE TEMPLATES                                       */}
      {/* ============================================================ */}
      {tab === "templates" && (
        <>
          {/* Filtro */}
          <Card className="mb-4 p-4">
            <div className="relative max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por código, nome ou categoria"
                className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
              />
            </div>
          </Card>

          {loading && <LoadingState label="Carregando templates BOM…" rows={4} />}
          {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}
          {!loading && !error && (data ?? []).length === 0 && (
            <EmptyState
              icon={Layers}
              title="Nenhum template cadastrado"
              description="Crie o primeiro template de composição de produto."
              action={
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Novo template
                </Button>
              }
            />
          )}

          {!loading && !error && (data ?? []).length > 0 && templates.length === 0 && (
            <EmptyState
              icon={Search}
              title="Nenhum template encontrado"
              description="Tente outros termos de pesquisa."
              action={
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Limpar pesquisa
                </button>
              }
            />
          )}

          {!loading && !error && templates.length > 0 && (
            <>
              {/* Tabela desktop */}
              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Templates de Bill of Materials</caption>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Código</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Nome</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Categoria</th>
                      <th scope="col" className="px-4 py-3 text-center font-semibold">Itens</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Custo estimado</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Disponibilidade</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Ativo</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {templates.map((t) => (
                      <BomRow
                        key={t.id}
                        template={t}
                        onView={() => setDetailId(detailId === t.id ? null : t.id)}
                        onEdit={() => openEdit(t)}
                        onToggleActive={(active) => handleToggleActive(t.id, active)}
                        isViewing={detailId === t.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards mobile */}
              <ul className="space-y-3 lg:hidden">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      "rounded-lg border bg-white p-4",
                      t.active ? "border-slate-200" : "border-slate-200 opacity-75",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy-800">{t.code}</p>
                        <p className="text-sm font-medium text-slate-900">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.productCategory}</p>
                      </div>
                      <Badge tone={t.fullyAvailable ? "success" : "danger"}>
                        {t.fullyAvailable ? "Disponível" : "Indisponível"}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div>
                        <dt>Itens</dt>
                        <dd className="font-semibold text-slate-900">{t.items.length}</dd>
                      </div>
                      <div>
                        <dt>Custo estimado</dt>
                        <dd className="font-semibold text-slate-900">
                          {t.estimatedCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailId(detailId === t.id ? null : t.id)}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        {detailId === t.id ? "Fechar" : "Ver"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Painel de detalhes */}
          {detailTemplate && (
            <Card className="mt-4">
              <CardHeader
                icon={Layers}
                title={`${detailTemplate.code} · ${detailTemplate.name}`}
                description={detailTemplate.description || detailTemplate.productCategory}
                actions={
                  <button
                    type="button"
                    onClick={() => setDetailId(null)}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Fechar painel"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Material</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Qtd</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Unidade</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Saldo atual</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Custo item</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Disponível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailTemplate.itemViews.map((iv) => (
                      <tr key={iv.materialId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{iv.materialCode}</p>
                          <p className="text-xs text-slate-500">{iv.materialName}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatNumber(iv.quantity, 4)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{iv.unit}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatNumber(iv.available, 2)} {iv.unit}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {iv.itemCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={iv.available1 ? "success" : "danger"}>
                            {iv.available1 ? "Sim" : "Não"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-slate-700">
                        Custo total estimado (1 unidade)
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy-900">
                        {detailTemplate.estimatedCost.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={detailTemplate.fullyAvailable ? "success" : "danger"}>
                          {detailTemplate.fullyAvailable ? "Disponível" : "Indisponível"}
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* ABA: FORMULÁRIO                                               */}
      {/* ============================================================ */}
      {tab === "form" && (
        <Card>
          <CardHeader
            icon={Layers}
            title={editId ? "Editar template BOM" : "Novo template BOM"}
            description="Preencha os dados do template e adicione os materiais que compõem o produto."
          />
          <div className="space-y-5 p-4 lg:p-5">
            {/* Linha 1: Nome */}
            <Input
              id="bom-name"
              label="Nome do template"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={errors.name}
              placeholder="Ex.: Coleira Ajustável P"
            />

            {/* Linha 2: Código + botão sugerir */}
            <div>
              <label htmlFor="bom-code" className="mb-1.5 block text-sm font-medium text-slate-700">
                Código
                <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="bom-code"
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  aria-invalid={errors.code ? true : undefined}
                  aria-describedby={errors.code ? "bom-code-error" : "bom-code-hint"}
                  placeholder="Ex.: BOM-006"
                  className={cn(
                    "block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700",
                    errors.code && "border-rose-600 ring-1 ring-rose-200",
                  )}
                />
                <Button variant="outline" size="sm" type="button" onClick={handleSuggestCode}>
                  Sugerir
                </Button>
              </div>
              {!errors.code && (
                <p id="bom-code-hint" className="mt-1 text-xs text-slate-500">
                  Sugerido automaticamente — edite se necessário.
                </p>
              )}
              {errors.code && (
                <p id="bom-code-error" className="mt-1 text-xs font-medium text-rose-700">
                  {errors.code}
                </p>
              )}
            </div>

            {/* Linha 3: Descrição */}
            <Textarea
              id="bom-description"
              label="Descrição"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              error={errors.description}
              placeholder="Descrição opcional do produto acabado"
              rows={2}
            />

            {/* Linha 4: Categoria */}
            <Select
              id="bom-category"
              label="Categoria do produto"
              required
              value={form.productCategory}
              onChange={(e) => setForm((f) => ({ ...f, productCategory: e.target.value }))}
              error={errors.productCategory}
            >
              <option value="">Selecione a categoria</option>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>

            {/* Linha 5: Ativo */}
            <ToggleField
              id="bom-active"
              label="Template ativo"
              description="Templates inativos não aparecem nas seleções de produção."
              checked={form.active}
              onChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />

            {/* Seção de itens */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Itens do BOM</h3>

              {/* Adicionador de item */}
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-xs font-medium text-slate-600">Adicionar material</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="bom-mat-search" className="mb-1 block text-xs font-medium text-slate-700">
                      Material
                    </label>
                    <input
                      id="bom-mat-search"
                      type="search"
                      value={matSearch}
                      onChange={(e) => {
                        setMatSearch(e.target.value);
                        setSelectedMatId("");
                      }}
                      placeholder="Pesquisar por código ou nome"
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
                    />
                    {/* Dropdown de sugestões */}
                    {matSearch && !selectedMatId && filteredMats.length > 0 && (
                      <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md">
                        {filteredMats.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-navy-50"
                              onClick={() => {
                                setSelectedMatId(m.id);
                                setMatSearch(`${m.code} · ${m.name}`);
                              }}
                            >
                              <span className="font-medium text-navy-800">{m.code}</span>
                              <span className="truncate text-slate-700">{m.name}</span>
                              <span className="ml-auto shrink-0 text-xs text-slate-400">{m.unit}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="w-28">
                    <label htmlFor="bom-item-qty" className="mb-1 block text-xs font-medium text-slate-700">
                      Quantidade
                    </label>
                    <input
                      id="bom-item-qty"
                      type="number"
                      min="0.001"
                      step="any"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
                    />
                  </div>
                  <Button type="button" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Adicionar
                  </Button>
                </div>
                {itemError && (
                  <p className="mt-2 text-xs font-medium text-rose-700">{itemError}</p>
                )}
              </div>

              {/* Lista de itens adicionados */}
              {form.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                  Nenhum material adicionado. Pesquise e adicione os componentes acima.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold">Material</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Qtd</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Un</th>
                        <th scope="col" className="w-10 px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.items.map((item) => {
                        const mat = materials.find((m) => m.id === item.materialId);
                        return (
                          <tr key={item.materialId} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-900">{mat?.code ?? item.materialId}</p>
                              <p className="text-xs text-slate-500">{mat?.name ?? "—"}</p>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNumber(item.quantity, 4)}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{mat?.unit ?? "—"}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removeItem(item.materialId)}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                aria-label={`Remover ${mat?.name ?? item.materialId}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {errors.items && (
                <p className="mt-2 text-xs font-medium text-rose-700">{errors.items}</p>
              )}
            </div>

            {/* Botões */}
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={cancelForm} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} loading={saving}>
                {editId ? "Salvar alterações" : "Salvar template"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-componente: linha da tabela de templates                        */
/* ------------------------------------------------------------------ */
function BomRow({
  template: t,
  onView,
  onEdit,
  onToggleActive,
  isViewing,
}: {
  template: BomTemplateView;
  onView: () => void;
  onEdit: () => void;
  onToggleActive: (active: boolean) => void;
  isViewing: boolean;
}) {
  return (
    <tr className={cn("hover:bg-slate-50/70", !t.active && "opacity-70")}>
      <td className="whitespace-nowrap px-4 py-3 font-semibold text-navy-800">{t.code}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{t.name}</p>
        {t.description && (
          <p className="line-clamp-1 text-xs text-slate-500">{t.description}</p>
        )}
      </td>
      <td className="px-4 py-3 text-slate-700">{t.productCategory}</td>
      <td className="px-4 py-3 text-center tabular-nums">{t.items.length}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-800">
        {t.estimatedCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </td>
      <td className="px-4 py-3">
        <Badge tone={t.fullyAvailable ? "success" : "danger"}>
          {t.fullyAvailable ? "Disponível" : "Indisponível"}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={t.active}
          onClick={() => onToggleActive(!t.active)}
          aria-label={t.active ? "Desativar template" : "Ativar template"}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-1",
            t.active ? "bg-navy-700" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              t.active ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onView}
            aria-pressed={isViewing}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              isViewing
                ? "bg-navy-100 text-navy-800"
                : "text-navy-700 hover:bg-navy-50",
            )}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Ver
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Editar
          </button>
        </div>
      </td>
    </tr>
  );
}
