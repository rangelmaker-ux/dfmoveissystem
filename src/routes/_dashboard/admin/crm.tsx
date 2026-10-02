import { Button } from "@/components/ui/button";
import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { validateStoredAccess } from '@/hooks/use-auth';
import { useProjects } from '@/hooks/use-projects';
import { useTeam } from '@/hooks/use-team';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from 'react';
import { SaleStatus } from '@/types/database';

export const Route = createFileRoute('/_dashboard/admin/crm')({
  beforeLoad: async () => {
    const access = await validateStoredAccess();
    const role = access.authorized ? access.account?.role : undefined;
    if (role !== 'ADMIN') throw redirect({ to: '/projetista/dashboard' });
  },
  component: CRMPage,
});

function CRMPage() {
  const [projetistaId, setProjetistaId] = useState<string>('all');
  const [statusVenda, setStatusVenda] = useState<string>('all');

  const { data: projects, isLoading } = useProjects({
    projetista_id: projetistaId === 'all' ? undefined : projetistaId,
    status_venda: statusVenda === 'all' ? undefined : statusVenda as SaleStatus
  });

  const { data: team } = useTeam();

  const getStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'VENDEU':
        return <Badge className="bg-green-100 text-green-800">Vendeu</Badge>;
      case 'EM_NEGOCIACAO':
        return <Badge className="bg-blue-100 text-blue-800">Em Negociação</Badge>;
      case 'NAO_VENDEU':
        return <Badge className="bg-red-100 text-red-800">Não Vendeu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">CRM - Pipeline de Vendas</h1>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to="/projetista/meus-projetos">Vendas, comissões e arquivos</Link></Button>
          <Select value={projetistaId} onValueChange={setProjetistaId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por Projetista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Projetistas</SelectItem>
              {team?.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusVenda} onValueChange={setStatusVenda}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status de Venda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="EM_NEGOCIACAO">Em Negociação</SelectItem>
              <SelectItem value="VENDEU">Vendeu</SelectItem>
              <SelectItem value="NAO_VENDEU">Não Vendeu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Leads e Projetos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Projetista</TableHead>
                <TableHead>Status Venda</TableHead>
                <TableHead>Status Projeto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="h-12 bg-muted/20" />
                  </TableRow>
                ))
              ) : projects?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{p.cliente?.nome}</TableCell>
                  <TableCell>{p.projetista?.nome}</TableCell>
                  <TableCell>{getStatusBadge(p.status_venda)}</TableCell>
                  <TableCell>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.valor_venda 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.valor_venda))
                      : '-'
                    }
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && projects?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum projeto encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

