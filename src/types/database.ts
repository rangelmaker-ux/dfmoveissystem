export type UserRole = "ADMIN" | "PROJETISTA";
export type UserStatus = "PENDENTE" | "ATIVO" | "BLOQUEADO";
export type ProjectStatus =
  "PRONTO" | "EM_EXECUCAO" | "PAUSADO" | "ATRASADO" | "FINALIZADO" | "EM_ACOMPANHAMENTO";
export type SaleStatus = "EM_NEGOCIACAO" | "VENDEU" | "NAO_VENDEU";

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  projetista_id?: string | null;
  created_at: string;
}

export interface Projeto {
  aguardando_cliente?: boolean;
  prazo_cliente?: string | null;
  aguardando_cliente_desde?: string | null;
  finalizado_em?: string | null;
  id: string;
  cliente_id: string;
  projetista_id: string | null;
  status: ProjectStatus;
  data_inicio: string;
  prazo_termino: string;
  status_venda: SaleStatus;
  valor_venda?: number;
  forma_pagamento?: string;
  nome?: string | null;
  fonte?: string | null;
  nome_arquiteto?: string | null;
  rt_arquiteto?: number | null;
  observacoes?: string | null;
  estagio_andamento?: string | null;
  motivo_perda?: string | null;
  created_at: string;
  cliente?: Cliente;
  projetista?: User;
}

export interface Comissao {
  id: string;
  projeto_id: string;
  projetista_id: string;
  percentual: number;
  valor_calculado: number;
  mes_referencia: string;
  created_at: string;
  projeto?: Projeto;
}
