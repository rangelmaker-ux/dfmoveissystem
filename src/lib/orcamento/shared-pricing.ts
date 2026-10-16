import type { BudgetSettings } from './types';

export const PRICING_KEYS = ['margin', 'frete', 'montagem', 'comissao_vendas', 'comissao_executivo', 'outros', 'chapa_mode', 'chapa_rounding', 'fita_mode'] as const;
export type SharedPricing = Pick<BudgetSettings, typeof PRICING_KEYS[number]>;

export function readSharedPricing(value: unknown): SharedPricing {
  if (!value || typeof value !== 'object' || PRICING_KEYS.some(key => !(key in value)))
    throw new Error('Os parâmetros de preço da loja não foram carregados. Recarregue antes de calcular.');
  return Object.fromEntries(PRICING_KEYS.map(key => [key, (value as SharedPricing)[key]])) as SharedPricing;
}

export function applySharedPricing(settings: BudgetSettings, pricing: SharedPricing | null): BudgetSettings {
  return pricing ? { ...settings, ...readSharedPricing(pricing) } : settings;
}
