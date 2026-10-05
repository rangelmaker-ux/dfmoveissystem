import type { ReactNode } from 'react';
import { Box, FolderKanban, Sparkles, Wrench } from 'lucide-react';
import type { BudgetItem, ModuleGroup } from '@/lib/orcamento/types';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function budgetSections(groups: ModuleGroup[]) {
  const sections = new Map<string, { id: string; name: string; kind: 'materials' | 'process' | 'hardware'; groups: ModuleGroup[] }>();
  for (const group of groups) {
    const category = normalize(group.category || '');
    const root = group.parent_item || group.parentModuleItem;
    const hardware = group.is_hardware_only || root?.itemCategory === 'ACCESSORY';
    const process = group.is_process_only || root?.itemCategory === 'MANUFACTURING_PROCESS' || category.includes('processo') || category.includes('mao de obra');
    const kind = hardware ? 'hardware' : process ? 'process' : 'materials';
    const name = hardware ? 'Acessórios' : process ? 'Processos de fabricação' : group.category || 'Móveis e peças';
    const id = `${kind}:${normalize(name)}`;
    if (!sections.has(id)) sections.set(id, { id, name, kind, groups: [] });
    sections.get(id)!.groups.push(group);
  }
  return [...sections.values()].sort((a, b) => ['materials', 'process', 'hardware'].indexOf(a.kind) - ['materials', 'process', 'hardware'].indexOf(b.kind));
}
function hardwareFamily(group: ModuleGroup) {
  const text = normalize(`${group.name} ${group.items.map(item => item.description).join(' ')}`);
  if (/puxador|pux\.|citizen/.test(text)) return 'Puxadores';
  if (/dobradica/.test(text)) return 'Dobradiças';
  if (/corredica/.test(text)) return 'Corrediças';
  return 'Outras ferragens e acessórios';
}

export function BudgetProjectCards({ groups, projectName, clientName, hidden, expanded, onExpand, renderItemRow }: {
  groups: ModuleGroup[]; projectName: string; clientName: string; hidden: boolean;
  expanded: Record<string, boolean>; onExpand: (id: string) => void;
  renderItemRow: (item: BudgetItem, index: number) => ReactNode;
}) {
  const money = (value: number) => hidden ? '••••••' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const sections = budgetSections(groups);
  return <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs sm:p-5">
    <div className="mb-5 flex items-center gap-3"><FolderKanban className="h-5 w-5 text-[#8b1733]" /><div>
      <h2 className="text-xl font-bold tracking-tight text-slate-900">Projeto · {projectName}</h2>
      <p className="mt-1 text-sm text-stone-500">Cliente: {clientName}</p>
    </div></div>
    {sections.length === 0 && <p className="p-6 text-center text-sm text-stone-500">Nenhum item encontrado com este filtro.</p>}
    <div className="space-y-4">{sections.map(section => {
      const Icon = section.kind === 'hardware' ? Wrench : section.kind === 'process' ? Sparkles : Box;
      const families = new Map<string, ModuleGroup[]>();
      for (const group of section.groups) {
        const family = section.kind === 'hardware' ? hardwareFamily(group) : '';
        if (!families.has(family)) families.set(family, []);
        families.get(family)!.push(group);
      }
      return <section key={section.id} className="overflow-hidden rounded-xl border border-stone-200">
        <div className="flex items-center gap-3 px-4 py-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8b1733]/7 text-[#8b1733]"><Icon className="h-5 w-5" /></div><div>
          <h3 className="text-base font-bold text-slate-900">{section.name}</h3>
          <p className="text-xs text-stone-500">{section.kind === 'hardware' ? 'Componentes e ferragens do projeto' : section.kind === 'process' ? 'Serviços e usinagens do projeto' : 'Móveis e peças do ambiente'}</p>
        </div></div>
        <div className="space-y-3 px-4 pb-3">{[...families].map(([family, rows]) => <div key={family}>
          {family && <h4 className="mb-2 text-sm font-semibold text-[#8b1733]">{family}</h4>}
          <div className="overflow-x-auto rounded-lg border border-stone-100"><table className="w-full min-w-[650px] text-left text-xs text-slate-700">
            <thead className="bg-stone-50 text-stone-600"><tr><th className="px-3 py-2.5 font-semibold">Item</th><th className="px-3 py-2.5 font-semibold">Quantidade</th><th className="px-3 py-2.5 font-semibold">Dimensões</th><th className="px-3 py-2.5 text-right font-semibold">Custo total</th><th className="px-3 py-2.5 text-right font-semibold">Venda</th></tr></thead>
            <tbody className="divide-y divide-stone-100">{rows.map(group => <tr key={group.id} className="hover:bg-stone-50/60">
              <td className="px-3 py-3 font-medium text-slate-800">{group.name}</td><td className="whitespace-nowrap px-3 py-3">{group.piecesCount.toLocaleString('pt-BR')} {group.parent_item?.unit || 'un'}</td>
              <td className="px-3 py-3 text-stone-500">{group.dimensions ? `${group.dimensions} mm` : '—'}</td><td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{money(group.subtotal_cost)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{money(group.subtotal_price)}</td>
            </tr>)}</tbody>
          </table></div>
        </div>)}</div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-stone-100 bg-stone-50/60 px-4 py-3 text-xs"><span className="font-medium text-stone-600">Subtotal · {section.name}</span><div className="flex gap-5 tabular-nums"><span>Custo {money(section.groups.reduce((sum, group) => sum + group.subtotal_cost, 0))}</span><span className="font-semibold">Venda {money(section.groups.reduce((sum, group) => sum + group.subtotal_price, 0))}</span></div></div>
        <button type="button" aria-expanded={expanded[section.id] === true} onClick={() => onExpand(section.id)} className="px-4 py-3 text-xs font-semibold text-[#8b1733] underline underline-offset-4">{expanded[section.id] ? 'Ocultar peças e referências' : 'Ver peças e referências'}</button>
        {expanded[section.id] && <div className="overflow-x-auto border-t border-stone-100"><table className="w-full min-w-[1000px] text-left text-xs text-slate-700"><thead className="bg-stone-50 text-[10px] text-stone-600"><tr>{['#', 'Código / Peça', 'Descrição / Dimensões', 'Rep', 'Qtd unit.', 'Total matéria', 'Un', 'Custo unit.', 'Total custo', 'Ação'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{section.groups.flatMap(group => group.items).map(renderItemRow)}</tbody></table></div>}
      </section>;
    })}</div>
    {groups.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#8b1733]/5 px-4 py-4 text-sm">
      <strong className="text-slate-900">{groups.length} móveis e itens · total exibido</strong>
      <div className="flex flex-wrap gap-6 tabular-nums"><span>Custo <strong>{money(groups.reduce((sum, group) => sum + group.subtotal_cost, 0))}</strong></span><span>Venda <strong>{money(groups.reduce((sum, group) => sum + group.subtotal_price, 0))}</strong></span></div>
    </div>}
  </div>;
}
