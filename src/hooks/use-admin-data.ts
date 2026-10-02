import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Projeto, User, Comissao } from '@/types/database';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Fetch projects with client and designer info
      const { data: projetos, error: pError } = await supabase
        .from('projetos')
        .select('*, cliente:clientes(*), projetista:users(id,nome,email,role,status,avatar_url,created_at)');

      if (pError) throw pError;

      // Fetch all designers
      const { data: projetistas, error: uError } = await supabase
        .from('users')
        .select('id,nome,email,role,status,avatar_url,created_at')
        .eq('role', 'PROJETISTA');

      if (uError) throw uError;

      // Calculate KPIs
      const totalVendas = (projetos as any[])
        .filter(p => p.status_venda === 'VENDEU')
        .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);

      const totalEntradas = (projetos as any[])
        .filter(p => p.status_venda === 'VENDEU')
        .reduce((acc, p) => acc + (Number(p.valor_entrada) || 0), 0);

      const totalComissoes = (projetos as any[])
        .filter(p => p.status_venda === 'VENDEU')
        .reduce((acc, p) => {
          const valor = Number(p.valor_venda) || 0;
          const perc = Number(p.percentual_comissao) || 0;
          return acc + (valor * (perc / 100));
        }, 0);

      const totalRTs = (projetos as any[])
        .filter(p => p.status_venda === 'VENDEU' && p.fonte === 'ARQUITETO')
        .reduce((acc, p) => {
          const valor = Number(p.valor_venda) || 0;
          const rt = Number(p.rt_arquiteto) || 0;
          return acc + (valor * (rt / 100));
        }, 0);

      const totalParcelasReceber = (projetos as any[])
        .filter(p => p.status_venda === 'VENDEU')
        .reduce((acc, p) => {
          const num = Number(p.numero_parcelas) || 0;
          const valor = Number(p.valor_parcela) || 0;
          return acc + (Array.isArray(p.parcelas) && p.parcelas.length ? p.parcelas.reduce((sum: number, amount: unknown) => sum + (Number(amount) || 0), 0) : num * valor);
        }, 0);

      const projetosExecucao = (projetos as any[])
        .filter(p => p.status === 'EM_EXECUCAO').length;

      const totalLeads = (projetos as any[]).length;
      const totalVendasCount = (projetos as any[])
        .filter(p => p.status_venda === 'VENDEU').length;
      
      const taxaConversao = totalLeads > 0 ? (totalVendasCount / totalLeads) * 100 : 0;

      // Data for charts
      const statusData = [
        { name: 'Pronto', value: projetos.filter(p => p.status === 'PRONTO').length },
        { name: 'Execução', value: projetos.filter(p => p.status === 'EM_EXECUCAO').length },
        { name: 'Atrasado', value: projetos.filter(p => p.status === 'ATRASADO').length },
        { name: 'Finalizado', value: projetos.filter(p => p.status === 'FINALIZADO').length },
      ].filter(d => d.value > 0);

      const vendasPorProjetista = projetistas.map(u => {
        const vendas = (projetos as Projeto[])
          .filter(p => p.projetista_id === u.id && p.status_venda === 'VENDEU')
          .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);
        return { name: u.nome, total: vendas };
      });

      const motivosPerda = [
        { name: 'Achou caro', value: (projetos as any[]).filter(p => p.motivo_perda === 'Achou caro').length },
        { name: 'Concorrência', value: (projetos as any[]).filter(p => p.motivo_perda === 'Concorrência').length },
        { name: 'Desistiu', value: (projetos as any[]).filter(p => p.motivo_perda === 'Desistiu').length },
        { name: 'Prazo', value: (projetos as any[]).filter(p => p.motivo_perda === 'Prazo').length },
        { name: 'Outros', value: (projetos as any[]).filter(p => p.motivo_perda && !['Achou caro', 'Concorrência', 'Desistiu', 'Prazo'].includes(p.motivo_perda)).length },
      ].filter(d => d.value > 0);

      return {
        totalVendas,
        totalEntradas,
        totalComissoes,
        totalRTs,
        totalParcelasReceber,
        projetosExecucao,
        taxaConversao,
        statusData,
        vendasPorProjetista,
        motivosPerda,
        projetosRecentes: (projetos as any[]).slice(0, 5),
      };
    },
  });
}
