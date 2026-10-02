import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
async function load(paths) {
  const code = paths
    .map((p) => stripTypeScriptTypes(fs.readFileSync(p, "utf8")))
    .join("\n")
    .replace(/^import .*;$/gm, "");
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const math = await load([
  "src/lib/finance.ts",
  "src/lib/orcamento/chapas-catalog.ts",
  "src/lib/orcamento/default-materials.ts",
  "src/lib/orcamento/calculator.ts",
  "src/lib/orcamento/consolidation.ts",
  "src/lib/orcamento/commercial.ts",
]);
const settings = {
  margin: 50,
  frete: 0,
  montagem: 0,
  comissao_vendas: 0,
  comissao_executivo: 0,
  outros: [],
  chapa_mode: "m2",
  chapa_rounding: "up",
  fita_mode: "metros",
  pdf_show_unit_price: true,
  pdf_show_item_total: true,
};
const item = {
  id: "part",
  item_number: 1,
  code: "CUSTOM",
  description: "Peça especial",
  quantity: 1,
  unit: "UN",
  unit_cost: 100,
  unit_price: 150,
  total_cost: 100,
  total_price: 150,
  itemCategory: "CUT_PART",
};
test("preço derivado reage à margem global e permanece estável em recálculos", () => {
  const initial = math.recalculateBudget([item], [], settings);
  assert.equal(initial.totals.total_price, 150);
  const changed = math.recalculateBudget(initial.items, [], { ...settings, margin: 200 });
  assert.equal(changed.totals.total_price, 300);
  assert.equal(
    math.recalculateBudget(changed.items, [], { ...settings, margin: 200 }).totals.total_price,
    300,
  );
});
test("preço final importado permanece fixo até intervenção explícita", () => {
  const initial = math.recalculateBudget([{ ...item, final_price: 123 }], [], settings);
  assert.equal(
    math.recalculateBudget(initial.items, [], { ...settings, margin: 200 }).totals.total_price,
    123,
  );
});
test("repetição de módulo contabiliza custo e venda na mesma quantidade", () => {
  const result = math.recalculateBudget(
    [
      {
        ...item,
        itemCategory: "MODULE",
        is_parent_module: true,
        table_price: 100,
        quantity: 2,
        original_quantity: 2,
        rep: 2,
        unit_quantity: 1,
      },
    ],
    [],
    settings,
  );
  assert.equal(result.totals.total_cost, 200);
  assert.equal(result.totals.total_price, 300);
});
test("peça avulsa manual entra no total; peça filha não é cobrada duas vezes", () => {
  const result = math.recalculateBudget(
    [{ ...item, price_unlinked: true, unit_price: 300 }],
    [],
    settings,
  );
  assert.equal(result.totals.total_price, 300);
  const child = math.recalculateBudget(
    [
      { ...item, id: "parent", itemCategory: "MODULE", final_price: 300 },
      { ...item, id: "child", parentId: "parent", price_unlinked: true },
    ],
    [],
    settings,
  );
  assert.equal(child.totals.total_price, 300);
});
test("consolidação preserva dimensões, ambientes e hierarquia e rejeita outro cliente", () => {
  const b = (id, price) => ({
    id,
    client_id: "client",
    name: id,
    items: [
      { ...item, id: "module", itemCategory: "MODULE", final_price: price },
      { ...item, id: "child", parentId: "module", dimensions: id },
    ],
    totals: { total_price: price },
  });
  const items = math.consolidateBudgets([b("cozinha", 200), b("quarto", 500)]);
  assert.equal(items.length, 4);
  assert.equal(items[1].parentId, "cozinha:module");
  assert.equal(items[3].parentId, "quarto:module");
  assert.equal(math.recalculateBudget(items, [], settings).totals.total_price, 700);
  assert.throws(() =>
    math.consolidateBudgets([b("a", 200), { ...b("b", 500), client_id: "other" }]),
  );
});
test("parcelas somam exatamente o saldo e rejeitam entrada acima da venda", () => {
  const result = math.calculateInstallments(100, 0, 3);
  assert.deepEqual(result.amounts, [33.34, 33.33, 33.33]);
  assert.equal(
    result.amounts.reduce((sum, n) => sum + Math.round(n * 100), 0),
    10000,
  );
  assert.throws(() => math.calculateInstallments(100, 101, 3));
  assert.throws(() => math.calculateInstallments(100, 0, 0));
});
test("filtro de outubro e fevereiro independe do fuso", () => {
  assert.deepEqual(math.monthRange("2026-10"), { start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(math.monthRange("2028-02"), { start: "2028-02-01", end: "2028-02-29" });
});
test("contrato exige proposta fechada e preserva só ambientes selecionados", () => {
  const proposal = {
    id: "proposal",
    type: "proposal",
    stage: "draft",
    discount: 10,
    entry: 0,
    installments: 3,
    environments: [
      { id: "a", saleValue: 100, extraCosts: [] },
      { id: "b", saleValue: 200, extraCosts: [] },
    ],
  };
  assert.throws(() => math.contractFromProposal(proposal, ["a"], "2026-10-01", "contract"));
  const contract = math.contractFromProposal(
    { ...proposal, stage: "closed" },
    ["a"],
    "2026-10-01",
    "contract",
  );
  assert.equal(contract.environments.length, 1);
  assert.equal(math.commercialTotals(contract).total, 90);
  assert.equal(contract.originProposalId, "proposal");
});

test("quantidade alterada atualiza acessórios, serviços e peças externas sem congelar totais", () => {
  for (const category of ["ACCESSORY", "MANUFACTURING_PROCESS", "EXTERNAL_ITEM"]) {
    const initial = math.recalculateBudget(
      [{ ...item, itemCategory: category, table_price: 100, price_origin: "calculated" }],
      [],
      settings,
    );
    const changed = math.recalculateBudget(
      initial.items.map((i) => ({
        ...i,
        quantity: 2,
        original_quantity: 2,
        rep: 2,
        unit_quantity: 1,
      })),
      [],
      settings,
    );
    assert.equal(changed.totals.total_cost, initial.totals.total_cost * 2, category);
    assert.equal(changed.totals.total_price, initial.totals.total_price * 2, category);
  }
});
