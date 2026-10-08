import { calculateInstallments, localDate, parseMoney } from './finance';

export function clientDeadline(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export interface SaleForm {
  valorVenda: string;
  percentualComissao: string;
  rtArquiteto: string;
  nomeArquiteto: string;
  valorEntrada: string;
  formaPagamentoEntrada: string;
  numParcelas: string;
  waiting: boolean;
  deadline: string | null;
}

export function saleUpdate(data: SaleForm, today = localDate()) {
  const sale = parseMoney(data.valorVenda);
  const entry = parseMoney(data.valorEntrada || '0');
  const count = Number(data.numParcelas);
  const percentage = parseMoney(data.percentualComissao || '0');
  const rt = parseMoney(data.rtArquiteto || '0');
  if (!Number.isFinite(rt) || rt < 0 || rt > 100) throw new Error('RT deve estar entre 0 e 100%.');
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error('Comissão deve estar entre 0 e 100%.');
  const installments = calculateInstallments(sale, entry, count);
  if (data.waiting && data.deadline) {
    const parsed = new Date(`${data.deadline}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.deadline) || !Number.isFinite(parsed.getTime()) || localDate(parsed) !== data.deadline || data.deadline < today)
      throw new Error('Escolha uma data de retorno válida, a partir de hoje.');
  }
  return {
    status: data.waiting ? 'PAUSADO' as const : 'FINALIZADO' as const,
    estagio_andamento: 'Fim',
    status_venda: data.waiting ? 'EM_NEGOCIACAO' as const : 'VENDEU' as const,
    aguardando_cliente: data.waiting,
    prazo_cliente: data.waiting ? data.deadline : null,
    valor_venda: sale,
    percentual_comissao: percentage,
    rt_arquiteto: rt,
    nome_arquiteto: data.nomeArquiteto.trim() || null,
    valor_entrada: entry,
    forma_pagamento_entrada: data.formaPagamentoEntrada,
    numero_parcelas: count,
    valor_parcela: installments.regular,
  };
}
