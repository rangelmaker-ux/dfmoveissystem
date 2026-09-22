export type ChapaRoundingMode = 'up' | 'down' | 'exact';
export type ChapaDisplayMode = 'm2' | 'chapa';
export type FitaDisplayMode = 'metros' | 'rolos';

export interface BudgetItem {
  id: string;
  item_number: number;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  margin: number;
  unit_price: number;
  total_cost: number;
  total_price: number;
  found: boolean;
  has_children?: boolean;
  is_chapa?: boolean;
  is_fita?: boolean;
  fita_metros?: number;
  original_code?: string;
  original_quantity?: number;
  original_unit?: string;
  resolved_from_subcode?: boolean;
  notes?: string;
}

export interface AdditionItem {
  id: string;
  nome: string;
  valor: number;
}

export interface CompanyInfo {
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  logo_url?: string;
}

export interface BudgetSettings {
  margin: number;
  frete: number;
  montagem: number;
  comissao_vendas: number;
  comissao_executivo: number;
  outros: AdditionItem[];
  chapa_mode: ChapaDisplayMode;
  chapa_rounding: ChapaRoundingMode;
  fita_mode: FitaDisplayMode;
  pdf_show_unit_price: boolean;
  pdf_show_item_total: boolean;
  company?: CompanyInfo;
}

export interface ProductItem {
  id: string;
  code: string;
  subcodes: string[];
  description: string;
  unit: string;
  unit_cost?: number;
  unit_price: number;
  fita_metros?: number;
  category?: 'MDF' | 'FITA' | 'FERRAGEM' | 'OUTROS' | string;
  notes?: string;
}

export interface SavedBudget {
  id: string;
  name: string;
  client_name?: string;
  client_phone?: string;
  client_id?: string;
  projeto_id?: string;
  project_environment?: string;
  created_at: string;
  updated_at: string;
  status: 'RASCUNHO' | 'APROVADO' | 'PEDIDO' | 'CANCELADO';
  items: BudgetItem[];
  settings: BudgetSettings;
  totals: {
    total_cost: number;
    total_price: number;
    gross_profit: number;
    profit_margin_percent: number;
    items_count: number;
  };
  merged_from_ids?: string[];
}
