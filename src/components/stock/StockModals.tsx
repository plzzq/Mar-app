/* Modais do módulo de estoque: cadastro, movimentação, estorno e cancelamento. */
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/forms";
import { usePermissions } from "@/hooks/usePermissions";
import { STOCK_CATEGORIES, STOCK_UNITS, type Material, type MaterialInput, type StockMovement } from "@/types";
import { createOperationKey } from "@/services/demo/demoDb";
import { permissionHint } from "@/services/permissions";
import { formatNumber } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { createMaterial, suggestMaterialCode, updateMaterial } from "@/services/stockService";

/* ------------------------- Cadastro de material --------------------- */

interface MaterialFormProps {
  open: boolean;
  initial?: Material;
  onClose: () => void;
  onSaved: (material: Material) => void;
}

const EMPTY_MATERIAL: MaterialInput = {
  name: "",
  code: "",
  description: "",
  category: "Matéria-prima",
  unit: "un",
  available: 0,
  minimumStock: 0,
  location: "",
  supplier: "",
  cost: undefined,
  active: true,
};

export function MaterialFormModal({ open, initial, onClose, onSaved }: MaterialFormProps) {
  const { can } = usePermissions();
  const [values, setValues] = useState<MaterialInput>(EMPTY_MATERIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubmitError(null);
    setSaving(false);
    if (initial) {
      setValues({
        name: initial.name,
        code: initial.code,
        description: initial.description,
        category: initial.category,
        unit: initial.unit,
        available: initial.available,
        minimumStock: initial.minimumStock,
        location: initial.location,
        supplier: initial.supplier ?? "",
        cost: initial.cost,
        active: initial.active,
      });
    } else {
      setValues(EMPTY_MATERIAL);
      void suggestMaterialCode().then((code) => setValues((v) => (v.code ? v : { ...v, code })));
    }
  }, [open, initial]);

  const dirty = useMemo(() => {
    if (!initial) return values.name !== "" || values.code !== "" || values.description !== "";
    return (
      values.name !== initial.name ||
      values.code !== initial.code ||
      values.description !== initial.description ||
      values.category !== initial.category ||
      values.unit !== initial.unit ||
      values.minimumStock !== initial.minimumStock ||
      values.location !== initial.location ||
      (values.supplier ?? "") !== (initial.supplier ?? "") ||
      (values.cost ?? undefined) !== (initial.cost ?? undefined) ||
      values.active !== initial.active
    );
  }, [values, initial]);

  const set = <K extends keyof MaterialInput>(key: K, value: MaterialInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const close = () => {
    if (dirty && !saving) setConfirmDiscard(true);
    else onClose();
  };

  const save = async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      const payload: MaterialInput = {
        ...values,
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description.trim(),
        location: values.location.trim().toUpperCase(),
        supplier: values.supplier?.trim() || undefined,
      };
      const saved = initial ? await updateMaterial(initial.id, payload) : await createMaterial(payload);
      onSaved(saved);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error);
      setSubmitError(message);
      setErrors({ form: message });
    } finally {
      setSaving(false);
    }
  };

  const allowed = initial ? can("material.edit") : can("material.create");
  const canToggleActive = can("material.deactivate");

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title={initial ? `Editar ${initial.code}` : "Adicionar item ao estoque"}
        description={
          initial
            ? "A quantidade só muda por movimentação rastreável — este formulário edita o cadastro."
            : "Cadastre um novo material, componente ou produto. A quantidade inicial gera uma movimentação de entrada."
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={!allowed}>
              {initial ? "Salvar alterações" : "Cadastrar item"}
            </Button>
          </>
        }
      >
        {!allowed ? (
          <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Seu perfil não tem permissão para esta operação. {permissionHint(initial ? "material.edit" : "material.create")}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Input id="mat-name" label="Nome do produto ou material" required value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name || errors.form} maxLength={120} />
            <Input id="mat-code" label="SKU / código interno único" required value={values.code} onChange={(e) => set("code", e.target.value.toUpperCase())} error={errors.code} maxLength={20} hint="Letras, números, ponto, hífen ou sublinhado." />
            <Textarea id="mat-desc" label="Descrição" required value={values.description} onChange={(e) => set("description", e.target.value)} error={errors.description} wrapperClassName="md:col-span-2" maxLength={300} />
            <Select id="mat-category" label="Categoria" required value={values.category} onChange={(e) => set("category", e.target.value)}>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select id="mat-unit" label="Unidade de medida" required value={values.unit} onChange={(e) => set("unit", e.target.value)}>
              {STOCK_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
            {initial ? (
              <Input id="mat-available" label={`Quantidade atual (${initial.unit})`} value={String(initial.available)} disabled hint="Somente por movimentação (entrada, saída, ajuste ou estorno)." />
            ) : (
              <Input id="mat-available" label="Quantidade atual" type="number" min={0} step={1} required value={String(values.available)} onChange={(e) => set("available", Number(e.target.value))} error={errors.available} hint="Gera a movimentação de estoque inicial." />
            )}
            <Input id="mat-min" label="Estoque mínimo" type="number" min={0} step={1} required value={String(values.minimumStock)} onChange={(e) => set("minimumStock", Number(e.target.value))} error={errors.minimumStock} />
            <Input id="mat-location" label="Localização no almoxarifado" required value={values.location} onChange={(e) => set("location", e.target.value.toUpperCase())} error={errors.location} placeholder="Ex.: A-01-01" maxLength={20} />
            <Input id="mat-supplier" label="Fornecedor (opcional)" value={values.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} maxLength={120} />
            <Input id="mat-cost" label="Custo unitário em R$ (opcional)" type="number" min={0} step={0.01} value={values.cost === undefined ? "" : String(values.cost)} onChange={(e) => set("cost", e.target.value === "" ? undefined : Number(e.target.value))} error={errors.cost} />
            {initial && (
              <div className="md:col-span-2">
                <label htmlFor="mat-active" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    id="mat-active"
                    type="checkbox"
                    checked={values.active}
                    disabled={!canToggleActive}
                    onChange={(e) => set("active", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Item ativo
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  {canToggleActive
                    ? "Desativar preserva o histórico e remove o item das seleções."
                    : `A ativação/desativação exige perfil administrador. ${permissionHint("material.deactivate")}`}
                </p>
              </div>
            )}
            {submitError && (
              <p role="alert" className="text-sm font-medium text-rose-700 md:col-span-2">
                {submitError}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        title="Descartar alterações?"
        description="Há alterações não salvas neste formulário. Elas serão perdidas."
        confirmLabel="Descartar"
        tone="danger"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

/* --------------------------- Movimentação --------------------------- */

interface MovementModalProps {
  open: boolean;
  material: Material | null;
  defaultType?: "entrada" | "saida" | "ajuste";
  onClose: () => void;
  onSaved: (duplicate: boolean) => void;
}

export function MovementModal({ open, material, defaultType = "entrada", onClose, onSaved }: MovementModalProps) {
  const { can } = usePermissions();
  const [type, setType] = useState<"entrada" | "saida" | "ajuste">(defaultType);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [related, setRelated] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opKey, setOpKey] = useState("");
  const formId = useId();

  useEffect(() => {
    if (open && material) {
      setType(defaultType);
      setQuantity("");
      setReason("");
      setRelated("");
      setError(null);
      setBusy(false);
      setOpKey(createOperationKey());
    }
  }, [open, material, defaultType]);

  if (!material) return null;
  const qty = Number(quantity);
  const preview =
    quantity && Number.isInteger(qty) && qty > 0
      ? type === "saida"
        ? material.available - qty
        : material.available + qty
      : null;
  const overExit = type === "saida" && Number.isInteger(qty) && qty > 0 && qty > material.available;

  const submit = async () => {
    if (busy) return;
    if (!can("stock.move")) {
      setError(`Sem permissão. ${permissionHint("stock.move")}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { registerMovement } = await import("@/services/stockService");
      const { duplicate } = await registerMovement({
        materialId: material.id,
        type,
        quantity: qty,
        reason,
        relatedRequestCode: related.trim() || undefined,
        idempotencyKey: opKey,
      });
      onSaved(duplicate);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${type === "entrada" ? "Registrar entrada" : type === "saida" ? "Registrar saída" : "Registrar ajuste"} — ${material.code}`}
      description={`${material.name} · Saldo atual: ${formatNumber(material.available)} ${material.unit}. Toda movimentação fica registrada no histórico.`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy} disabled={busy || overExit}>
            Confirmar {type}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select id={`${formId}-type`} label="Tipo de movimentação" required value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="entrada">Entrada (soma ao saldo)</option>
          <option value="saida">Saída (subtrai do saldo)</option>
          <option value="ajuste">Ajuste (soma ao saldo, com motivo)</option>
        </Select>
        <Input
          id={`${formId}-qty`}
          label={`Quantidade (${material.unit})`}
          type="number"
          min={1}
          step={1}
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          error={overExit ? `Saída acima do saldo disponível (${formatNumber(material.available)} ${material.unit}).` : undefined}
          hint={preview !== null && !overExit ? `Novo saldo: ${formatNumber(preview)} ${material.unit}.` : undefined}
        />
        <Textarea id={`${formId}-reason`} label="Motivo" required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="Ex.: NF 10250, consumo na SOL-2026-003, inventário." />
        <Input id={`${formId}-related`} label="Solicitação relacionada (opcional)" value={related} onChange={(e) => setRelated(e.target.value.toUpperCase())} placeholder="Ex.: SOL-2026-003" maxLength={20} />
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------ Estorno ----------------------------- */

export function ReverseModal({
  open,
  movement,
  material,
  onClose,
  onSaved,
}: {
  open: boolean;
  movement: StockMovement | null;
  material: Material | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can } = usePermissions();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opKey, setOpKey] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setBusy(false);
      setOpKey(createOperationKey());
    }
  }, [open ]);

  if (!movement || !material) return null;

  const submit = async () => {
    if (busy) return;
    if (!can("stock.reverse")) {
      setError(`Sem permissão. ${permissionHint("stock.reverse")}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { reverseMovement } = await import("@/services/stockService");
      await reverseMovement(movement.id, reason, opKey);
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Estornar movimentação"
      description={`Será criada uma movimentação de compensação — o registro original é preservado. ${movement.quantity} ${material.unit} · ${movement.reason}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={busy}>
            Confirmar estorno
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea id="reverse-reason" label="Motivo do estorno" required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* --------------------- Cancelamento de solicitação ------------------ */

export function CancelRequestModal({
  open,
  requestCode,
  separatedCount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  requestCode: string;
  separatedCount: number;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setBusy(false);
    }
  }, [open ]);

  const submit = () => {
    if (reason.trim().length < 10) {
      setError("Descreva o motivo com pelo menos 10 caracteres.");
      return;
    }
    setBusy(true);
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cancelar ${requestCode}?`}
      description="O cancelamento exige motivo, libera as reservas pendentes e preserva todo o histórico. Solicitações canceladas ficam somente para consulta."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Confirmar cancelamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {separatedCount > 0 && (
          <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            {separatedCount} unidade(s) já separada(s) permanecerão registradas no histórico; apenas as pendências serão liberadas.
          </p>
        )}
        <Textarea id="cancel-reason" label="Motivo do cancelamento" required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="Ex.: demanda reagendada, produto descontinuado, erro de digitação." />
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
