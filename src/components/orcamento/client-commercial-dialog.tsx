import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { SavedBudget } from "@/lib/orcamento/types";
import {
  commercialTotals,
  contractFromProposal,
  environmentFromBudget,
  type CommercialDocument,
} from "@/lib/orcamento/commercial";
import { exportCommercialDocument } from "@/lib/orcamento/commercial-pdf";
import { localDate, parseMoney } from "@/lib/finance";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ClientCommercialDialog({
  client,
  onClose,
}: {
  client: { id: string; nome: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [document, setDocument] = useState<CommercialDocument | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: ["client-commercial", client?.id],
    enabled: !!client,
    queryFn: async () => {
      const [budgets, documents] = await Promise.all([
        supabase
          .from("orcamento_budgets")
          .select("*")
          .eq("client_id", client!.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("commercial_documents")
          .select("*")
          .eq("client_id", client!.id)
          .order("updated_at", { ascending: false }),
      ]);
      if (budgets.error) throw budgets.error;
      if (documents.error) throw documents.error;
      return {
        budgets: (budgets.data || []).map((row) => ({
          ...(row.data as unknown as SavedBudget),
          id: row.id,
        })),
        documents: (documents.data || []).map((row) => ({
          ...(row.data as unknown as CommercialDocument),
          id: row.id,
          revision: row.revision,
        })),
      };
    },
  });
  const budgets = data?.budgets || [];
  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  const money = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let total: ReturnType<typeof commercialTotals> | null = null;
  let validation = "";
  if (document) {
    try {
      total = commercialTotals(document);
    } catch (error) {
      validation = (error as Error).message;
    }
  }
  const persist = async (next: CommercialDocument) => {
    commercialTotals(next);
    const { revision, ...snapshot } = next;
    const { data: version, error } = await supabase.rpc("save_commercial_document", {
      p_id: next.id,
      p_client_id: next.clientId,
      p_data: snapshot as unknown as Json,
      p_revision: revision ?? null,
    });
    if (error) throw error;
    const saved = { ...next, revision: version };
    setDocument(saved);
    await queryClient.invalidateQueries({ queryKey: ["client-commercial", client!.id] });
    return saved;
  };
  const save = async (closed = false) => {
    if (!document || saving) return;
    setSaving(true);
    try {
      await persist({ ...document, stage: closed ? "closed" : document.stage });
      toast.success(
        closed
          ? "Proposta fechada. Selecione os ambientes para o contrato."
          : "Documento salvo no servidor.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const update = (values: Partial<CommercialDocument>) =>
    setDocument((current) => (current ? { ...current, ...values } : current));
  return (
    <Dialog
      open={!!client}
      onOpenChange={(open) => {
        if (!open) {
          setDocument(null);
          setSelected([]);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client?.nome} · Orçamentos e contratos</DialogTitle>
        </DialogHeader>
        {isLoading && <p>Carregando…</p>}
        {error && (
          <p className="text-red-600">Não foi possível carregar os documentos. Tente novamente.</p>
        )}
        {!document ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Os orçamentos internos continuam disponíveis na Calculadora. Aqui você prepara o
              descritivo e o valor que serão enviados ao cliente.
            </p>
            <Label className="flex gap-2 items-center">
              <Checkbox
                checked={budgets.length > 0 && selected.length === budgets.length}
                onCheckedChange={(checked) => setSelected(checked ? budgets.map((b) => b.id) : [])}
              />
              Marcar todos os ambientes
            </Label>
            {budgets.map((budget) => (
              <Label
                key={budget.id}
                className="flex justify-between items-center border rounded-lg p-3"
              >
                <span className="flex flex-wrap sm:flex-nowrap gap-2">
                  <Checkbox
                    checked={selected.includes(budget.id)}
                    onCheckedChange={() => toggle(budget.id)}
                  />
                  {budget.project_environment || budget.name}
                </span>
                {money(budget.totals.total_price)}
              </Label>
            ))}
            {!budgets.length && !isLoading && (
              <p className="text-sm">
                Salve um orçamento interno vinculado a este cliente para começar.
              </p>
            )}
            <Button
              disabled={!selected.length || !!error}
              onClick={() =>
                setDocument({
                  id: crypto.randomUUID(),
                  clientId: client!.id,
                  clientName: client!.nome,
                  type: "proposal",
                  stage: "draft",
                  date: localDate(),
                  environments: budgets
                    .filter((b) => selected.includes(b.id))
                    .map(environmentFromBudget),
                  discount: 0,
                  entry: 0,
                  installments: 1,
                  observations: "",
                  clauses: "",
                  contractor: "DF Móveis",
                  customerSignature: "",
                })
              }
            >
              Criar orçamento do cliente
            </Button>
            <div className="space-y-2">
              {data?.documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap gap-2 justify-between border rounded-lg p-3">
                  <span>
                    {doc.type === "contract" ? "Contrato" : "Orçamento"} · {doc.date} ·{" "}
                    {doc.stage === "closed" ? "Fechado" : "Rascunho"}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDocument(doc);
                      setSelected(doc.environments.map((e) => e.id));
                    }}
                  >
                    Abrir e editar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="font-semibold">
                {document.type === "contract" ? "Contrato" : "Orçamento do cliente"} ·{" "}
                {document.stage === "closed" ? "Fechado" : "Rascunho"}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setDocument(null);
                  setSelected([]);
                }}
              >
                Voltar à lista
              </Button>
            </div>
            <Label>
              Data
              <Input
                type="date"
                value={document.date}
                onChange={(e) => update({ date: e.target.value })}
              />
            </Label>
            {document.environments.map((environment, index) => (
              <div key={environment.id} className="border rounded-xl p-4 space-y-2">
                <p className="font-semibold">{environment.name}</p>
                <Label>
                  Descritivo enviado ao cliente
                  <Textarea
                    value={environment.description}
                    onChange={(event) =>
                      update({
                        environments: document.environments.map((env, i) =>
                          i === index ? { ...env, description: event.target.value } : env,
                        ),
                      })
                    }
                  />
                </Label>
                <Label>
                  Valor de venda do ambiente
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={environment.saleValue}
                    onChange={(event) =>
                      update({
                        environments: document.environments.map((env, i) =>
                          i === index ? { ...env, saleValue: Number(event.target.value) } : env,
                        ),
                      })
                    }
                  />
                </Label>
                {document.type === "proposal" && (
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-slate-500">
                      Custos adicionais internos (metalon, vidro, LED, RT). Não aparecem no PDF do
                      cliente. Confira o valor de venda acima após ajustar os custos.
                    </p>
                    {environment.extraCosts.map((cost, costIndex) => (
                      <div key={cost.id} className="flex flex-wrap sm:flex-nowrap gap-2">
                        <Input
                          aria-label="Descrição do custo interno"
                          value={cost.description}
                          onChange={(event) =>
                            update({
                              environments: document.environments.map((env, i) =>
                                i === index
                                  ? {
                                      ...env,
                                      extraCosts: env.extraCosts.map((c, j) =>
                                        j === costIndex
                                          ? { ...c, description: event.target.value }
                                          : c,
                                      ),
                                    }
                                  : env,
                              ),
                            })
                          }
                        />
                        <Input
                          aria-label="Valor do custo interno"
                          type="number"
                          min="0"
                          step="0.01"
                          value={cost.cost}
                          onChange={(event) =>
                            update({
                              environments: document.environments.map((env, i) =>
                                i === index
                                  ? {
                                      ...env,
                                      saleValue:
                                        Math.round(
                                          (env.saleValue + Number(event.target.value) - cost.cost) *
                                            100,
                                        ) / 100,
                                      extraCosts: env.extraCosts.map((c, j) =>
                                        j === costIndex
                                          ? { ...c, cost: Number(event.target.value) }
                                          : c,
                                      ),
                                    }
                                  : env,
                              ),
                            })
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() =>
                            update({
                              environments: document.environments.map((env, i) =>
                                i === index
                                  ? {
                                      ...env,
                                      saleValue: Math.max(
                                        0,
                                        Math.round((env.saleValue - cost.cost) * 100) / 100,
                                      ),
                                      extraCosts: env.extraCosts.filter((c) => c.id !== cost.id),
                                    }
                                  : env,
                              ),
                            })
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() =>
                        update({
                          environments: document.environments.map((env, i) =>
                            i === index
                              ? {
                                  ...env,
                                  extraCosts: [
                                    ...env.extraCosts,
                                    { id: crypto.randomUUID(), description: "", cost: 0 },
                                  ],
                                }
                              : env,
                          ),
                        })
                      }
                    >
                      Adicionar custo interno
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Label>
                Desconto (%)
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={document.discount}
                  onChange={(e) => update({ discount: Number(e.target.value) })}
                />
              </Label>
              <Label>
                Entrada (R$)
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={document.entry}
                  onChange={(e) => update({ entry: parseMoney(e.target.value) })}
                />
              </Label>
              <Label>
                Parcelas
                <Input
                  type="number"
                  min="0"
                  max="120"
                  value={document.installments}
                  onChange={(e) => update({ installments: Number(e.target.value) })}
                />
              </Label>
            </div>
            {total && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p>
                  Total: <strong>{money(total.total)}</strong> · Desconto:{" "}
                  {money(total.discountValue)} · Saldo: {money(total.balance)}
                </p>
                <p className="text-sm">
                  {total.amounts
                    .map((amount, index) => `${index + 1}ª: ${money(amount)}`)
                    .join(" · ")}
                </p>
              </div>
            )}
            {validation && (
              <p className="text-red-600" role="alert">
                {validation}
              </p>
            )}
            <Label>
              Observações
              <Textarea
                value={document.observations}
                onChange={(e) => update({ observations: e.target.value })}
              />
            </Label>
            {document.type === "contract" && (
              <>
                <Label>
                  Cláusulas e serviços incluídos
                  <Textarea
                    rows={6}
                    value={document.clauses}
                    onChange={(e) => update({ clauses: e.target.value })}
                  />
                </Label>
                <Label>
                  Nome / razão social da contratada
                  <Input
                    value={document.contractor}
                    onChange={(e) => update({ contractor: e.target.value })}
                  />
                </Label>
                <Label>
                  Nome do cliente para assinatura
                  <Input
                    value={document.customerSignature}
                    onChange={(e) => update({ customerSignature: e.target.value })}
                  />
                </Label>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving || !!validation} onClick={() => save()}>
                Salvar documento
              </Button>
              <Button
                variant="outline"
                disabled={!!validation}
                onClick={() => exportCommercialDocument(document)}
              >
                Baixar PDF do cliente
              </Button>
              {document.type === "proposal" && document.stage !== "closed" && (
                <Button disabled={saving || !!validation} onClick={() => save(true)}>
                  Fechar negociação
                </Button>
              )}
            </div>
            {document.type === "proposal" && document.stage === "closed" && (
              <div className="border rounded-lg p-3 space-y-3">
                <p>Ambientes fechados para o contrato:</p>
                <Label className="flex items-center gap-2">
                  <Checkbox
                    checked={document.environments.every((e) => selected.includes(e.id))}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? document.environments.map((e) => e.id) : [])
                    }
                  />
                  Marcar todos
                </Label>
                {document.environments.map((env) => (
                  <Label className="flex gap-2 items-center" key={env.id}>
                    <Checkbox
                      checked={selected.includes(env.id)}
                      onCheckedChange={() => toggle(env.id)}
                    />
                    {env.name}
                  </Label>
                ))}
                <Button
                  disabled={saving || !!validation || !selected.length}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const saved = await persist(document);
                      const contract = contractFromProposal(
                        saved,
                        selected,
                        localDate(),
                        crypto.randomUUID(),
                      );
                      setDocument(contract);
                      toast.info("Revise as cláusulas e salve o contrato.");
                    } catch (error) {
                      toast.error((error as Error).message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Gerar contrato dos ambientes selecionados
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
