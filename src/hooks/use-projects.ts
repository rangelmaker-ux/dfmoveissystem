import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Projeto, SaleStatus } from '@/types/database';

export function useProjects(filters?: { projetista_id?: string; status_venda?: SaleStatus }) {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: async () => {
      let query = supabase
        .from('projetos')
        .select('*, cliente:clientes(*), projetista:users(id,nome,email,role,status,avatar_url,created_at)')
        .order('created_at', { ascending: false });

      if (filters?.projetista_id) {
        query = query.eq('projetista_id', filters.projetista_id);
      }
      if (filters?.status_venda) {
        query = query.eq('status_venda', filters.status_venda);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Projeto[];
    },
  });
}
