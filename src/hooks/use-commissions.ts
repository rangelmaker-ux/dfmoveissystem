import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { monthRange } from '@/lib/finance';
import { Comissao } from '@/types/database';

export function useCommissions(month?: string) {
  return useQuery({
    queryKey: ['commissions', month],
    queryFn: async () => {
      let query = supabase
        .from('comissoes')
        .select('*, projeto:projetos(*, cliente:clientes(*)), projetista:users(id,nome,email,role,status,avatar_url,created_at)')
        .order('created_at', { ascending: false });

      if (month) {
        // month format YYYY-MM
        const { start, end } = monthRange(month);
        query = query.gte('mes_referencia', start).lte('mes_referencia', end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Comissao[];
    },
  });
}
