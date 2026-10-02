import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BudgetItem, BudgetSettings } from './types';

export interface GenerateBudgetPdfOptions {
  clientName: string;
  clientPhone?: string;
  projectName: string;
  dateStr?: string;
  validityDays?: number;
  paymentConditions?: string;
  items: BudgetItem[];
  settings: BudgetSettings;
  totals: {
    total_cost: number;
    total_price: number;
    gross_profit: number;
  };
}

export function generateBudgetPdf(opts: GenerateBudgetPdfOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const today = opts.dateStr || new Date().toLocaleDateString('pt-BR');
  const validity = opts.validityDays || 10;
  const company = opts.settings.company;

  const hasLogo = Boolean(company?.logo_url && company.logo_url.startsWith('data:image'));
  const headerHeight = hasLogo || company?.cnpj ? 38 : 32;

  // Header Background Bar (DF Móveis Charcoal #17191d)
  doc.setFillColor(23, 25, 29);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  let textStartX = 14;

  // Render Company Logo if available
  if (hasLogo && company?.logo_url) {
    try {
      doc.addImage(company.logo_url, 'PNG', 14, 5, 26, 26);
      textStartX = 44;
    } catch (e) {
      console.error('Erro ao renderizar logo no PDF:', e);
      textStartX = 14;
    }
  }

  // Brand Name & Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const companyTitle = company?.nome_fantasia || company?.razao_social || 'DF MÓVEIS PLANEJADOS';
  doc.text(companyTitle.toUpperCase(), textStartX, 13);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 178, 122); // #cbb27a Gold
  doc.text('ORÇAMENTO INTERNO — MATERIAIS E CUSTOS', textStartX, 20);

  // CNPJ & Contato da Empresa se informados
  const companyDetails = [
    company?.cnpj ? `CNPJ: ${company.cnpj}` : null,
    company?.telefone ? `Tel/WhatsApp: ${company.telefone}` : null,
    company?.email ? company.email : null,
  ].filter(Boolean).join(' | ');

  if (companyDetails) {
    doc.setFontSize(7.5);
    doc.setTextColor(180, 185, 195);
    doc.text(companyDetails, textStartX, 27);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Data: ${today} | Validade: ${validity} dias`, pageWidth - 14, 18, { align: 'right' });

  // Client and Project Info Card
  const clientCardY = headerHeight + 6;
  doc.setFillColor(248, 246, 240);
  doc.roundedRect(14, clientCardY, pageWidth - 28, 24, 2, 2, 'F');

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE & PROJETO', 18, clientCardY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Cliente: ${opts.clientName || 'Cliente DF Móveis'}`, 18, clientCardY + 14);
  if (opts.clientPhone) {
    doc.text(`Telefone / WhatsApp: ${opts.clientPhone}`, 18, clientCardY + 19);
  }
  doc.text(`Ambiente / Projeto: ${opts.projectName || 'Móveis Planejados'}`, pageWidth / 2 + 10, clientCardY + 14);

  // Items Table (Lista completa e integral de todos os itens do projeto)
  const tableStartY = clientCardY + 28;
  const itemsToPrint = opts.items;

  const tableRows = itemsToPrint.map((it, idx) => {
    let desc = it.description;
    if (it.dimensions && !desc.includes(it.dimensions)) {
      desc += ` (${it.dimensions})`;
    }

    const row: any[] = [
      (it.item_number || idx + 1).toString(),
      it.code,
      desc,
      it.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 4 }),
      it.unit,
    ];

    if (opts.settings.pdf_show_unit_price) {
      row.push(
        it.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      );
    }
    if (opts.settings.pdf_show_item_total) {
      row.push(
        it.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      );
    }

    return row;
  });

  const tableHeaders = ['Item', 'Código', 'Descrição do Material', 'Qtd', 'Unidade'];
  if (opts.settings.pdf_show_unit_price) tableHeaders.push('Vlr Unit.');
  if (opts.settings.pdf_show_item_total) tableHeaders.push('Total (R$)');

  autoTable(doc, {
    startY: tableStartY,
    head: [tableHeaders],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [23, 25, 29],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 28 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Summary and Total Block
  let finalY = (doc as any).lastAutoTable.finalY + 8;
  if (finalY + 45 > 280) { doc.addPage(); finalY = 20; }

  // Payment conditions box
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(14, finalY, pageWidth - 98, 28, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('CONDIÇÕES COMERCIAIS & PAGAMENTO', 18, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    doc.splitTextToSize(opts.paymentConditions ||
      'Documento interno. Prepare a proposta e as condições comerciais na área do cliente.', pageWidth - 108),
    18,
    finalY + 12
  );

  // Total Card
  doc.setFillColor(201, 32, 49); // DF Red #c92031
  doc.roundedRect(pageWidth - 80, finalY, 66, 28, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DA PROPOSTA', pageWidth - 76, finalY + 7);

  doc.setFontSize(13);
  doc.text(
    opts.totals.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    pageWidth - 76,
    finalY + 16
  );

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Qtd de Itens: ${opts.items.length}`, pageWidth - 76, finalY + 23);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('DF Móveis Planejados — Tecnologia e Excelência em Projetos', pageWidth / 2, 288, {
    align: 'center',
  });

  const filename = `Orcamento_DF_${opts.clientName ? opts.clientName.replace(/\s+/g, '_') : 'Proposta'}.pdf`;
  doc.save(filename);
}
