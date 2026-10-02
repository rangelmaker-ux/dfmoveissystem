import { calculateInstallments } from "../finance";
import type { SavedBudget } from "./types";
export interface CommercialEnvironment {
  id: string;
  budgetId: string;
  name: string;
  description: string;
  saleValue: number;
  extraCosts: { id: string; description: string; cost: number }[];
}
export interface CommercialDocument {
  id: string;
  revision?: number;
  clientId: string;
  clientName: string;
  type: "proposal" | "contract";
  stage: "draft" | "closed";
  date: string;
  environments: CommercialEnvironment[];
  discount: number;
  entry: number;
  installments: number;
  observations: string;
  clauses: string;
  contractor: string;
  customerSignature: string;
  originProposalId?: string;
}
export function commercialTotals(document: CommercialDocument) {
  if (!document.environments.length) throw new Error("Selecione pelo menos um ambiente.");
  if (!Number.isFinite(document.discount) || document.discount < 0 || document.discount > 100)
    throw new Error("Desconto deve estar entre 0 e 100%.");
  const subtotalCents = document.environments.reduce((sum, env) => {
    if (!Number.isFinite(env.saleValue) || env.saleValue < 0)
      throw new Error("Valor de ambiente inválido.");
    if (env.extraCosts.some((item) => !Number.isFinite(item.cost) || item.cost < 0))
      throw new Error("Custo adicional inválido.");
    return sum + Math.round(env.saleValue * 100);
  }, 0);
  const discountCents = Math.round((subtotalCents * document.discount) / 100);
  const total = (subtotalCents - discountCents) / 100;
  const payments =
    total === 0 && document.entry === 0
      ? { amounts: [], regular: 0, last: 0, balance: 0 }
      : calculateInstallments(total, document.entry, document.installments);
  return { subtotal: subtotalCents / 100, discountValue: discountCents / 100, total, ...payments };
}
export function environmentFromBudget(budget: SavedBudget): CommercialEnvironment {
  return {
    id: budget.id,
    budgetId: budget.id,
    name: budget.project_environment || budget.name,
    description: budget.project_environment || budget.name,
    saleValue: budget.totals.total_price,
    extraCosts: [],
  };
}
export function contractFromProposal(
  proposal: CommercialDocument,
  selectedIds: string[],
  date: string,
  id: string,
): CommercialDocument {
  if (proposal.type !== "proposal" || proposal.stage !== "closed")
    throw new Error("Feche a proposta antes de gerar o contrato.");
  const environments = proposal.environments.filter((e) => selectedIds.includes(e.id));
  if (!environments.length) throw new Error("Selecione os ambientes fechados.");
  // Payment terms must be negotiated again when only part of the proposal was closed.
  const complete = environments.length === proposal.environments.length;
  const contract = {
    ...proposal,
    id,
    revision: undefined,
    type: "contract" as const,
    stage: "draft" as const,
    date,
    originProposalId: proposal.id,
    environments: structuredClone(environments),
    entry: complete ? proposal.entry : 0,
  };
  commercialTotals(contract);
  return contract;
}
