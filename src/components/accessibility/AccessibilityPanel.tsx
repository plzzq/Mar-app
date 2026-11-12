import { Eye, Keyboard, RotateCcw, SlidersHorizontal, VolumeX } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { FONT_SCALES, useAccessibility, type LineSpacing } from "@/contexts/AccessibilityContext";
import { cn } from "@/lib/utils";
import { ShortcutsTable } from "./ShortcutsTable";

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-navy-700" : "bg-slate-300",
        )}
      >
        <span className="sr-only">{checked ? "Ativado" : "Desativado"}</span>
        <span
          aria-hidden="true"
          className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")}
        />
      </button>
    </div>
  );
}

export function AccessibilityPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, setPref, resetDefaults } = useAccessibility();

  const currentScaleIndex = FONT_SCALES.reduce(
    (best, scale, index) => (Math.abs(scale - prefs.fontScale) < Math.abs(FONT_SCALES[best] - prefs.fontScale) ? index : best),
    0,
  );

  const adjustFont = (delta: number) => {
    const next = Math.min(FONT_SCALES.length - 1, Math.max(0, currentScaleIndex + delta));
    setPref("fontScale", FONT_SCALES[next]);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Acessibilidade"
      description="As preferências são aplicadas em toda a plataforma e salvas por usuário neste dispositivo."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={resetDefaults}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restaurar padrões
          </Button>
          <Button onClick={onClose}>Concluir</Button>
        </>
      }
    >
      <div className="space-y-6">
        <section aria-labelledby="a11y-appearance" className="space-y-3">
          <h3 id="a11y-appearance" className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Aparência e legibilidade
          </h3>

          <div className="rounded-lg border border-slate-200 p-3">
            <p id="a11y-font-label" className="text-sm font-medium text-slate-800">
              Tamanho da fonte
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3" role="group" aria-labelledby="a11y-font-label">
              <Button variant="outline" size="sm" onClick={() => adjustFont(-1)} aria-label="Diminuir tamanho da fonte">
                A−
              </Button>
              <span aria-live="polite" className="min-w-16 text-center text-sm font-semibold tabular-nums text-slate-900">
                {prefs.fontScale}%
              </span>
              <Button variant="outline" size="sm" onClick={() => adjustFont(1)} aria-label="Aumentar tamanho da fonte">
                A+
              </Button>
              <div className="flex gap-2">
                {FONT_SCALES.map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    aria-pressed={prefs.fontScale === scale}
                    onClick={() => setPref("fontScale", scale)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium",
                      prefs.fontScale === scale ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                    )}
                  >
                    {scale}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p id="a11y-line-label" className="text-sm font-medium text-slate-800">
              Espaçamento entre linhas
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="a11y-line-label">
              {(["apertado", "normal", "folgado"] as LineSpacing[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={prefs.lineSpacing === value}
                  onClick={() => setPref("lineSpacing", value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium capitalize",
                    prefs.lineSpacing === value ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            id="a11y-theme"
            label="Tema de baixa luminosidade (escuro)"
            description="Reduz a claridade da interface para uso em ambientes escuros."
            checked={prefs.theme === "escuro"}
            onChange={(value) => setPref("theme", value ? "escuro" : "claro")}
          />
          <ToggleRow
            id="a11y-contrast"
            label="Alto contraste"
            description="Aumenta o contraste entre texto, fundo e bordas (respeita prefers-contrast do sistema)."
            checked={prefs.contrast === "alto"}
            onChange={(value) => setPref("contrast", value ? "alto" : "normal")}
          />
          <ToggleRow
            id="a11y-motion"
            label="Reduzir animações"
            description="Desativa transições e animações não essenciais (respeita prefers-reduced-motion)."
            checked={prefs.reduceMotion}
            onChange={(value) => setPref("reduceMotion", value)}
          />
          <ToggleRow
            id="a11y-links"
            label="Destacar links"
            description="Sublinha e realça elementos clicáveis na navegação."
            checked={prefs.linkHighlight}
            onChange={(value) => setPref("linkHighlight", value)}
          />
          <ToggleRow
            id="a11y-font"
            label="Fonte mais legível"
            description="Usa uma fonte de alta legibilidade do sistema (Verdana)."
            checked={prefs.readableFont}
            onChange={(value) => setPref("readableFont", value)}
          />
          <ToggleRow
            id="a11y-targets"
            label="Áreas de toque maiores"
            description="Aumenta botões e campos para alvos de 44 px."
            checked={prefs.largeTargets}
            onChange={(value) => setPref("largeTargets", value)}
          />
        </section>

        <section aria-labelledby="a11y-interaction" className="space-y-3">
          <h3 id="a11y-interaction" className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            Interação
          </h3>
          <ToggleRow
            id="a11y-sound"
            label="Avisos sonoros"
            description="Sinal curto quando um aviso aparece (sucesso, erro e informação)."
            checked={prefs.sound}
            onChange={(value) => setPref("sound", value)}
          />

          <ToggleRow
            id="a11y-enter"
            label="Enter envia a mensagem na Mar.IA"
            description="Quando desativado, Enter quebra a linha e Ctrl+Enter envia."
            checked={prefs.enterSends}
            onChange={(value) => setPref("enterSends", value)}
          />

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-800">Duração dos avisos temporários</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Duração dos avisos temporários">
              {[
                { value: 4500, label: "4,5 s" },
                { value: 7000, label: "7 s" },
                { value: 10000, label: "10 s" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={prefs.toastDuration === option.value}
                  onClick={() => setPref("toastDuration", option.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium",
                    prefs.toastDuration === option.value ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <VolumeX className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Preferências salvas por usuário
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Guardadas neste dispositivo sob o seu perfil. Com o Supabase, serão sincronizadas pela tabela de preferências do usuário.
            </p>
          </div>
        </section>

        <section aria-labelledby="a11y-shortcuts" className="space-y-2">
          <h3 id="a11y-shortcuts" className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Atalhos de teclado
          </h3>
          <ShortcutsTable />
        </section>
      </div>
    </Modal>
  );
}
