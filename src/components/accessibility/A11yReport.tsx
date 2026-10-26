/* ------------------------------------------------------------------ */
/* Verificação automatizada de acessibilidade com axe-core.            */
/* Executa no documento ao vivo (WCAG 2.0/2.1/2.2 nível A e AA) e     */
/* lista as violações encontradas, sem afirmações de conformidade.     */
/* Complementa a navegação manual por teclado e leitores de tela.      */
/* ------------------------------------------------------------------ */
import { useRef, useState } from "react";
import { Accessibility, CheckCircle2, CircleAlert, Loader2, Play } from "lucide-react";
import { useAnnounce } from "@/contexts/AnnouncerContext";
import { Button, Card, CardHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  nodes: { target: string[]; failureSummary?: string }[];
}

interface CheckResult {
  label: string;
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export function A11yReport() {
  const announce = useAnnounce();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResults(null);
    const html = document.documentElement;
    const originalTheme = html.dataset.theme;
    const originalContrast = html.dataset.contrast;
    const collected: CheckResult[] = [];

    const scenarios: { label: string; apply: () => void }[] = [
      { label: "Configurações atuais", apply: () => undefined },
      {
        label: "Tema de baixa luminosidade",
        apply: () => {
          html.dataset.theme = "escuro";
        },
      },
      {
        label: "Alto contraste",
        apply: () => {
          html.dataset.contrast = "alto";
        },
      },
    ];

    try {
      const axe = (await import("axe-core")).default;
      for (const scenario of scenarios) {
        // Restaura o estado base antes de aplicar o cenário.
        if (originalTheme === undefined) delete html.dataset.theme;
        else html.dataset.theme = originalTheme;
        if (originalContrast === undefined) delete html.dataset.contrast;
        else html.dataset.contrast = originalContrast;
        scenario.apply();
        // Aguarda um frame para as preferências serem aplicadas ao CSS.
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        const ctx = rootRef.current ? { include: [["html"]], exclude: [["#a11y-report"]] } : "html";
        const report = await axe.run(ctx as never, {
          runOnly: { type: "tag", values: TAGS },
          resultTypes: ["violations", "passes", "incomplete"],
        });
        collected.push({
          label: scenario.label,
          violations: report.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.map(String), failureSummary: n.failureSummary })),
          })),
          passes: report.passes.length,
          incomplete: report.incomplete.length,
        });
      }
      setResults(collected);
      const total = collected.reduce((sum, r) => sum + r.violations.length, 0);
      announce(
        total === 0
          ? "Verificação de acessibilidade concluída sem violações nos três cenários testados."
          : `Verificação concluída: ${total} violação(ões) encontradas para revisão.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao executar a verificação.");
      announce("Falha ao executar a verificação de acessibilidade.", { assertive: true });
    } finally {
      if (originalTheme === undefined) delete html.dataset.theme;
      else html.dataset.theme = originalTheme;
      if (originalContrast === undefined) delete html.dataset.contrast;
      else html.dataset.contrast = originalContrast;
      setRunning(false);
    }
  };

  const totalViolations = results?.reduce((sum, r) => sum + r.violations.length, 0) ?? 0;

  return (
    <div id="a11y-report" ref={rootRef}>
      <Card>
        <CardHeader
          title="Verificação automatizada de acessibilidade"
          description="axe-core executa as regras WCAG 2.0/2.1/2.2 A e AA nos três cenários de tema. Não substitui o teste manual com teclado e leitor de tela."
          icon={Accessibility}
          actions={
            <Button onClick={run} loading={running} disabled={running}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {running ? "Verificando…" : "Executar verificação"}
            </Button>
          }
        />
        <div className="p-5">
          {running && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Analisando três cenários… isso pode levar alguns segundos.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </p>
          )}

          {!running && !results && !error && (
            <p className="text-sm text-slate-600">
              Nenhuma verificação executada. Clique em “Executar verificação” para analisar a interface atual.
            </p>
          )}

          {results && (
            <div className="space-y-5">
              <p
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium",
                  totalViolations === 0 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900",
                )}
              >
                {totalViolations === 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Nenhuma violação WCAG A/AA reportada nos cenários testados. Confirme ainda com navegação manual por teclado e leitor de tela.
                  </>
                ) : (
                  <>
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                    {totalViolations} violação(ões) encontrada(s) — itens para correção e nova verificação.
                  </>
                )}
              </p>

              {results.map((result) => (
                <section key={result.label} aria-label={`Resultado: ${result.label}`}>
                  <h3 className="text-sm font-semibold text-navy-900">
                    {result.label} — {result.violations.length} violação(ões), {result.passes} verificações aprovadas
                  </h3>
                  {result.violations.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">Nenhuma violação encontrada neste cenário.</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {result.violations.map((v) => (
                        <li key={`${result.label}-${v.id}`} className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
                          <p className="text-sm font-medium text-rose-900">
                            {v.help}{" "}
                            <span className="font-normal text-rose-700">
                              ({v.id}; impacto: {v.impact ?? "desconhecido"})
                            </span>
                          </p>
                          <ul className="mt-1.5 space-y-1 text-xs text-rose-800">
                            {v.nodes.map((node, index) => (
                              <li key={index}>
                                <code className="rounded bg-white px-1">{node.target.join(" ")}</code>
                                {node.failureSummary && <p className="mt-0.5">{node.failureSummary.replace(/\n/g, " ")}</p>}
                              </li>
                            ))}
                          </ul>
                          <a
                            href={v.helpUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1 inline-block text-xs font-medium text-navy-700 underline"
                          >
                            Documentação da regra
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
