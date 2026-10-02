import { localDate } from '@/lib/finance';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { validateStoredAccess } from '@/hooks/use-auth';
import { useCommissions } from '@/hooks/use-commissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Download, Calendar, FileJson, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from 'react';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';

export const Route = createFileRoute('/_dashboard/admin/comissoes')({
  beforeLoad: async () => {
    const access = await validateStoredAccess();
    const role = access.authorized ? access.account?.role : undefined;
    if (role !== 'ADMIN') throw redirect({ to: '/projetista/dashboard' });
  },
  component: CommissionsPage,
});

function CommissionsPage() {
  const [selectedMonth, setSelectedMonth] = useState(localDate().slice(0, 7)); // YYYY-MM
  const { data: commissions, isLoading } = useCommissions(selectedMonth);

  const totalComissoes = commissions?.reduce((acc, c) => acc + Number(c.valor_calculado), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Comissões</h1>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="month" 
              className="pl-9 w-[200px]" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!commissions || commissions.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCSV(commissions || [], selectedMonth)}>
                <FileJson className="mr-2 h-4 w-4" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF(commissions || [], selectedMonth)}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Total de Comissões (Mês)</CardTitle>
            <DollarSign className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalComissoes)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projetista</TableHead>
                <TableHead>Cliente / Projeto</TableHead>
                <TableHead>Valor Venda</TableHead>
                <TableHead>%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={5} className="h-12 bg-muted/20" />
                  </TableRow>
                ))
              ) : commissions?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{(c as any).projetista?.nome}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{(c as any).projeto?.cliente?.nome}</span>
                      <span className="text-xs text-muted-foreground">ID: {c.projeto_id.slice(0, 8)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number((c as any).projeto?.valor_venda || 0))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.percentual}%</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.valor_calculado))}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && commissions?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma comissão encontrada para o período selecionado.
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

