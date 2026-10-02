export type ChapaRoundingMode = 'up' | 'down' | 'exact';
export type ChapaDisplayMode = 'm2' | 'chapa';
export type FitaDisplayMode = 'metros' | 'rolos';

export type ItemCategory =
  | 'MODULE'
  | 'SUBMODULE'
  | 'CUT_PART'
  | 'ACCESSORY'
  | 'MANUFACTURING_PROCESS'
  | 'EXTERNAL_ITEM'
  | 'INFORMATIONAL';

export interface PricingAudit {
  id?: string;
  description: string;
  category: ItemCategory;
  parentId?: string;
  productionCost: number;
  salePrice: number;
  saleIncluded: boolean;
  pricingRule: string;
}

export interface BudgetItem {
  id: string;
  item_number: number;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  margin: number;
  margin_override?: boolean;
  unit_price: number;
  total_cost: number;
  total_price: number;
  found: boolean;
  price_unlinked?: boolean;
  has_children?: boolean;
  promob_xml?: boolean;
  promob_structure?: boolean;
  promob_description?: string;
  catalog_match?: { source: string; code: string; brand?: string; line?: string };
  is_parent_module?: boolean;
  is_chapa?: boolean;
  is_fita?: boolean;
  fita_metros?: number;
  original_code?: string;
  original_quantity?: number;
  original_unit?: string;
  resolved_from_subcode?: boolean;
  rep?: number;
  unit_quantity?: number;
  dimensions?: string;
  category?: string;
  external_model?: string;
  table_price?: number;
  final_price?: number;
  price_origin?: 'calculated' | 'imported' | 'manual';
  environment_id?: string;
  module_name?: string;
  is_module_header?: boolean;
  module_id?: string;
  is_processo?: boolean;
  is_mao_de_obra?: boolean;
  notes?: string;

  // Promob Hierarchy & Industrial vs Commercial pricing:
  itemCategory?: ItemCategory;
  parentId?: string;
  productionCost?: number;
  salePrice?: number;
  saleIncluded?: boolean;
  pricingAudit?: PricingAudit;
}

export interface ModuleGroup {
  id: string;
  name: string;
  category?: string;
  dimensions?: string;
  piecesCount: number;
  totalCost: number;
  totalPrice: number;
  subtotal_cost: number;
  subtotal_price: number;
  total_pieces: number;
  parentModuleItem?: BudgetItem;
  parent_item?: BudgetItem;
  items: BudgetItem[];
  is_hardware_only?: boolean;
  is_process_only?: boolean;
}

export interface PromobReportMetadata {
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  project_name?: string;
  report_date?: string;
  report_time?: string;
  total_tabela?: number;
  total_final?: number;
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
  revision?: number;
  user_id?: string;
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
