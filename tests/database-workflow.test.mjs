import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const adminId = "00000000-0000-0000-0000-000000000011";
const designerId = "00000000-0000-0000-0000-000000000012";
const otherId = "00000000-0000-0000-0000-000000000013";
const pendingId = "00000000-0000-0000-0000-000000000014";
let db;
async function actor(id, role = "authenticated") {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SELECT set_config('request.jwt.claim.role','${role}',false); SET ROLE ${role};`,
  );
}
async function root() {
  await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role','',false);");
}

test("migrações, aprovação, orçamento e financeiro no PostgreSQL", async (t) => {
  db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB DEFAULT '{}',raw_app_meta_data JSONB DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN);
    CREATE TABLE storage.objects(id UUID DEFAULT gen_random_uuid(),bucket_id TEXT,name TEXT);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE SQL AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
    GRANT ALL ON storage.objects,storage.buckets TO authenticated;
  `);
  for (const file of fs.readdirSync("supabase/migrations").sort()) {
    // All exclusions here use a tstzrange-only GiST, provided by PostgreSQL core.
    // Supabase supplies btree_gist for other schemas; it is not bundled with PGlite.
    const sql = fs
      .readFileSync(`supabase/migrations/${file}`, "utf8")
      .replace(/CREATE EXTENSION IF NOT EXISTS btree_gist;/g, "");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migração ${file}: ${error.message}`);
    }
  }
  await db.exec(`INSERT INTO public.users(id,nome,email,role,status) VALUES
    ('${adminId}','Admin Teste','admin@teste.local','ADMIN','ATIVO'),
    ('${designerId}','Designer Teste','designer@teste.local','PROJETISTA','ATIVO'),
    ('${otherId}','Outro Teste','outro@teste.local','PROJETISTA','ATIVO'),
    ('${pendingId}','Pendente Teste','pendente@teste.local','PROJETISTA','PENDENTE');
    UPDATE public.users SET role='ADMIN',status='ATIVO' WHERE id='${adminId}';
    UPDATE public.users SET status='ATIVO' WHERE id IN ('${designerId}','${otherId}');
    INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
    ('${adminId}','admin@teste.local','{"legacy_profile_id":"${adminId}"}'),
    ('${designerId}','designer@teste.local','{"legacy_profile_id":"${designerId}"}'),
    ('${otherId}','outro@teste.local','{"legacy_profile_id":"${otherId}"}'),
    ('${pendingId}','pendente@teste.local','{"legacy_profile_id":"${pendingId}"}');`);
  await t.test(
    "cadastro público ignora privilégio informado e não toma perfil existente",
    async () => {
      const newId = "00000000-0000-0000-0000-000000000099";
      await db.query(
        `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'novo@teste.local','{"nome":"Novo","role":"ADMIN","status":"ATIVO","legacy_profile_id":"${adminId}"}')`,
        [newId],
      );
      const profile = (await db.query("SELECT role,status FROM public.users WHERE id=$1", [newId]))
        .rows[0];
      assert.deepEqual(profile, { role: "PROJETISTA", status: "PENDENTE" });
      await assert.rejects(
        db.query("INSERT INTO auth.users(id,email) VALUES(gen_random_uuid(),'admin@teste.local')"),
      );
    },
  );
  let clientId, projectId;
  await t.test("cadastro pendente não lê dados operacionais nem pode se aprovar", async () => {
    await actor(pendingId);
    assert.equal((await db.query("SELECT id FROM public.clientes")).rows.length, 0);
    assert.equal((await db.query("SELECT id FROM public.users")).rows.length, 1);
    const response = await db.query(
      "UPDATE public.users SET status='ATIVO' WHERE id=$1 RETURNING id",
      [pendingId],
    );
    assert.equal(response.rows.length, 0);
  });
  await t.test("senha não fica legível pelo navegador, aprovação só pelo admin", async () => {
    await actor(designerId);
    await assert.rejects(db.query("SELECT password FROM public.users"));
    await assert.rejects(
      db.query("UPDATE public.users SET status='BLOQUEADO' WHERE id=$1", [designerId]),
    );
    await actor(adminId);
    await db.query("UPDATE public.users SET status='ATIVO' WHERE id=$1", [pendingId]);
  });
  await t.test("cliente e projeto são criados atomicamente", async () => {
    await actor(designerId);
    const before = (await db.query("SELECT count(*)::int AS n FROM public.clientes")).rows[0].n;
    await assert.rejects(
      db.query("SELECT public.create_client_with_project($1::jsonb,$2::jsonb)", [
        JSON.stringify({ nome: "Cliente inválido", projetista_id: designerId }),
        JSON.stringify({ data_inicio: "invalida", prazo_termino: "2026-12-01" }),
      ]),
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM public.clientes")).rows[0].n,
      before,
    );
    const response = await db.query(
      "SELECT public.create_client_with_project($1::jsonb,$2::jsonb) AS client",
      [
        JSON.stringify({ nome: "Cliente teste", projetista_id: designerId }),
        JSON.stringify({ data_inicio: "2026-10-01", prazo_termino: "2026-12-01" }),
      ],
    );
    clientId = response.rows[0].client.id;
    projectId = (await db.query("SELECT id FROM public.projetos WHERE cliente_id=$1", [clientId]))
      .rows[0].id;
  });
  await t.test("distribuição exige administrador e mantém dono do cliente", async () => {
    await assert.rejects(
      db.query("SELECT public.assign_project($1,$2,$3)", [projectId, designerId, "2026-12-01"]),
    );
    await actor(adminId);
    await db.query("SELECT public.assign_project($1,$2,$3)", [projectId, designerId, "2026-12-01"]);
    assert.equal(
      (await db.query("SELECT projetista_id FROM public.clientes WHERE id=$1", [clientId])).rows[0]
        .projetista_id,
      designerId,
    );
  });
  await t.test(
    "venda e comissão na mesma transação, sem duplicação e com centavos exatos",
    async () => {
      await actor(designerId);
      await db.query(
        "UPDATE public.projetos SET status_venda='VENDEU',valor_venda=100,valor_entrada=0,numero_parcelas=3,percentual_comissao=5 WHERE id=$1",
        [projectId],
      );
      assert.deepEqual(
        (await db.query("SELECT parcelas FROM public.projetos WHERE id=$1", [projectId])).rows[0]
          .parcelas,
        [33.34, 33.33, 33.33],
      );
      assert.equal(
        (
          await db.query("SELECT valor_calculado FROM public.comissoes WHERE projeto_id=$1", [
            projectId,
          ])
        ).rows[0].valor_calculado,
        "5.00",
      );
      await db.query("UPDATE public.projetos SET valor_venda=200 WHERE id=$1", [projectId]);
      assert.equal(
        (
          await db.query("SELECT count(*)::int AS n FROM public.comissoes WHERE projeto_id=$1", [
            projectId,
          ])
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        db.query("UPDATE public.projetos SET valor_entrada=999 WHERE id=$1", [projectId]),
      );
      assert.equal(
        (await db.query("SELECT valor_venda FROM public.projetos WHERE id=$1", [projectId])).rows[0]
          .valor_venda,
        "200.00",
      );
    },
  );
  await t.test("orçamento individual impede leitura alheia e gravação concorrente", async () => {
    const budget = JSON.stringify({
      id: "budget-test",
      client_id: clientId,
      projeto_id: projectId,
    });
    assert.equal(
      (
        await db.query("SELECT public.save_budget_record('budget-test',$1::jsonb,NULL) AS v", [
          budget,
        ])
      ).rows[0].v,
      1,
    );
    await assert.rejects(
      db.query("SELECT public.save_budget_record('budget-test',$1::jsonb,0)", [budget]),
    );
    assert.equal(
      (await db.query("SELECT public.save_budget_record('budget-test',$1::jsonb,1) AS v", [budget]))
        .rows[0].v,
      2,
    );
    await actor(otherId);
    assert.equal((await db.query("SELECT id FROM public.orcamento_budgets")).rows.length, 0);
    await assert.rejects(
      db.query("SELECT public.save_budget_record('budget-test',$1::jsonb,2)", [budget]),
    );
    await actor(designerId);
  });
  await t.test("catálogo e rascunho separados, ambos com controle de versão", async () => {
    await db.query("SELECT public.save_company_catalog('[{" + '"code":"teste"' + "}]','{}',0)");
    await db.query("SELECT public.save_budget_workspace('[]','{}',NULL,0)");
    assert.equal(
      (await db.query("SELECT revision FROM public.orcamento_catalog")).rows[0].revision,
      1,
    );
    await assert.rejects(db.query("SELECT public.save_company_catalog('[]','{}',0)"));
    await assert.rejects(db.query("SELECT public.save_budget_workspace('[]','{}',NULL,0)"));
  });
  await t.test("bloqueio da agenda é conferido também na aprovação", async () => {
    await actor(adminId);
    await db.query(
      "INSERT INTO public.agendamentos(titulo,tipo,criado_por,data_inicio,data_fim) VALUES('Bloqueio','BLOQUEIO',$1,'2026-10-05T10:00:00Z','2026-10-05T11:00:00Z')",
      [adminId],
    );
    const response = await db.query(
      "INSERT INTO public.agendamentos(titulo,tipo,criado_por,data_inicio,data_fim) VALUES('Reunião','REUNIAO',$1,'2026-10-05T12:00:00Z','2026-10-05T13:00:00Z') RETURNING id",
      [adminId],
    );
    await assert.rejects(
      db.query(
        "UPDATE public.agendamentos SET data_inicio='2026-10-05T10:00:00Z',data_fim='2026-10-05T11:00:00Z' WHERE id=$1",
        [response.rows[0].id],
      ),
    );
  });
  await t.test("documentos comerciais validam valores e exigem proposta fechada", async () => {
    await actor(designerId);
    const id = "00000000-0000-0000-0000-000000000088";
    const doc = {
      type: "proposal",
      stage: "draft",
      environments: [{ id: "kitchen", saleValue: 100, extraCosts: [] }],
      discount: 0,
      entry: 0,
      installments: 3,
    };
    const save = (document, revision = null) =>
      db.query("SELECT public.save_commercial_document($1,$2,$3::jsonb,$4) AS v", [
        id,
        clientId,
        JSON.stringify(document),
        revision,
      ]);
    await assert.rejects(save({ ...doc, entry: 101 }));
    await assert.rejects(save({ ...doc, type: undefined }));
    assert.equal((await save(doc)).rows[0].v, 1);
    await assert.rejects(save(doc, 0));
    await assert.rejects(
      db.query("SELECT public.save_commercial_document(gen_random_uuid(),$1,$2::jsonb,NULL)", [
        clientId,
        JSON.stringify({ ...doc, type: "contract", originProposalId: id }),
      ]),
    );
    await save({ ...doc, stage: "closed" }, 1);
    await db.query("SELECT public.save_commercial_document(gen_random_uuid(),$1,$2::jsonb,NULL)", [
      clientId,
      JSON.stringify({ ...doc, type: "contract", originProposalId: id }),
    ]);
    await actor(otherId);
    assert.equal((await db.query("SELECT id FROM public.commercial_documents")).rows.length, 0);
  });
  await t.test("arquivos privados exigem acesso ao projeto e avatar pertence à conta", async () => {
    await actor(designerId);
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('projetos_arquivos',$1)", [
      projectId + "/arquivo.pdf",
    ]);
    await assert.rejects(
      db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('avatars',$1)", [
        otherId + "/avatar.png",
      ]),
    );
    await actor(otherId);
    assert.equal(
      (await db.query("SELECT name FROM storage.objects WHERE bucket_id='projetos_arquivos'")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query("SELECT public.import_client_spreadsheet($1::jsonb,$2)", [
        JSON.stringify([{ nome: "Outro" }]),
        designerId,
      ]),
    );
  });
  await t.test("conta bloqueada perde acesso sem depender do menu", async () => {
    await actor(adminId);
    await db.query("UPDATE public.users SET status='BLOQUEADO' WHERE id=$1", [designerId]);
    await actor(designerId);
    assert.equal((await db.query("SELECT id FROM public.projetos")).rows.length, 0);
    await assert.rejects(db.query("SELECT public.save_budget_workspace('[]','{}',NULL,1)"));
  });
  await root();
});
