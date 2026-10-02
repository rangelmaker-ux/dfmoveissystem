import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { commercialTotals, type CommercialDocument } from "./commercial";
export function exportCommercialDocument(document: CommercialDocument) {
  const totals = commercialTotals(document);
  const money = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pdf = new jsPDF();
  pdf.setFontSize(16);
  pdf.text(document.type === "contract" ? "CONTRATO — DF MÓVEIS" : "ORÇAMENTO — DF MÓVEIS", 14, 18);
  pdf.setFontSize(10);
  pdf.text(`Cliente: ${document.clientName}`, 14, 28);
  pdf.text(`Data: ${document.date.split("-").reverse().join("/")}`, 14, 35);
  // Internal costs/material codes never enter the customer document.
  autoTable(pdf, {
    startY: 42,
    head: [["Ambiente / Descritivo", "Valor"]],
    body: document.environments.map((e) => [`${e.name}\n${e.description}`, money(e.saleValue)]),
    columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    styles: { overflow: "linebreak", fontSize: 10 },
  });
  let y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  const line = (value: string) => {
    for (const fragment of pdf.splitTextToSize(value, 180)) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(fragment, 14, y);
      y += 6;
    }
    y += 2;
  };
  line(
    `Subtotal: ${money(totals.subtotal)} | Desconto (${document.discount}%): ${money(totals.discountValue)}`,
  );
  line(`Valor total: ${money(totals.total)} | Entrada: ${money(document.entry)}`);
  if (totals.amounts.length)
    line(
      `Parcelas: ${totals.amounts.map((amount, i) => `${i + 1}ª: ${money(amount)}`).join(" · ")}`,
    );
  if (document.observations.trim()) line(`Observações: ${document.observations}`);
  if (document.type === "contract") {
    if (document.clauses.trim()) line(`Cláusulas e serviços incluídos:\n${document.clauses}`);
    line(`Contratada: ${document.contractor || "DF Móveis"}`);
    line(`Assinatura da contratada: ____________________________________`);
    line(`Cliente: ${document.customerSignature || document.clientName}`);
    line(`Assinatura do cliente: ____________________________________`);
  }
  pdf.save(
    `${document.type === "contract" ? "Contrato" : "Orcamento"}_DF_${document.clientName.replace(/[^\p{L}\p{N}_-]/gu, "_")}.pdf`,
  );
}
