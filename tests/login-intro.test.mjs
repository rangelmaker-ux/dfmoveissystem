import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const jsx = (type, props) => ({ type, props });
const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
function find(node, type) {
  if (!node || typeof node !== "object") return;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, type);
    if (result) return result;
  }
}
function loginHarness(access, authError = null) {
  const values = ["pessoa@loja.com", "senha", false, false, null, null];
  let cursor = 0;
  const navigations = [],
    welcomes = [];
  const module = { exports: {} };
  const navigate = async (options) => navigations.push(options);
  const react = {
    useState: () => {
      const index = cursor++;
      return [
        values[index],
        (value) => {
          values[index] = value;
        },
      ];
    },
    useCallback: (fn) => fn,
  };
  const deps = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@tanstack/react-router": {
      createFileRoute: () => (config) => config,
      useNavigate: () => navigate,
      Link: "link",
    },
    "@/hooks/use-auth": {
      ensureAuthStoreHydrated: async () => ({}),
      validateStoredAccess: async () => access,
    },
    "@/integrations/supabase/client": {
      supabase: { auth: { signInWithPassword: async () => ({ error: authError }) } },
    },
    "@/components/BrandIntro": { BrandIntro: "intro" },
    sonner: { toast: { success: (text) => welcomes.push(text), error() {} } },
    "@/assets/logo-df.png": { default: "logo.png" },
  };
  vm.runInNewContext(transpile("src/routes/index.tsx"), {
    exports: module.exports,
    module,
    require: (name) => deps[name] || new Proxy({}, { get: (_, key) => String(key) }),
  });
  const render = () => {
    cursor = 0;
    return module.exports.LoginPage();
  };
  return { render, navigations, welcomes, values };
}
for (const role of ["ADMIN", "PROJETISTA"]) {
  test(`login ${role}: animação só após autorização, painel só depois da animação`, async () => {
    const h = loginHarness({
      authorized: true,
      reason: "AUTHORIZED",
      account: { nome: "Pessoa", role },
    });
    assert.equal(find(h.render(), "intro"), undefined);
    await find(h.render(), "form").props.onSubmit({ preventDefault() {} });
    const intro = find(h.render(), "intro");
    assert.ok(intro);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.welcomes.length, 0);
    intro.props.onComplete();
    assert.equal(
      h.navigations[0].to,
      role === "ADMIN" ? "/admin/dashboard" : "/projetista/dashboard",
    );
    assert.equal(h.welcomes.length, 1);
  });
}
for (const reason of ["PENDING", "BLOCKED"]) {
  test(`conta ${reason} não recebe animação nem painel`, async () => {
    const h = loginHarness({ authorized: false, reason, account: { email: "pessoa@loja.com" } });
    await find(h.render(), "form").props.onSubmit({ preventDefault() {} });
    assert.equal(find(h.render(), "intro"), undefined);
    assert.equal(h.navigations[0].to, "/aguardando-aprovacao");
  });
}
test("senha inválida não inicia animação nem navegação", async () => {
  const h = loginHarness({ authorized: false, account: null }, { message: "Invalid credentials" });
  await find(h.render(), "form").props.onSubmit({ preventDefault() {} });
  assert.equal(find(h.render(), "intro"), undefined);
  assert.equal(h.navigations.length, 0);
});
test("animação termina em 2 segundos mesmo sem o vídeo carregar e cancela timer ao desmontar", () => {
  let timer,
    cleanup,
    completed = false,
    cleared;
  const module = { exports: {} };
  vm.runInNewContext(transpile("src/components/BrandIntro.tsx"), {
    exports: module.exports,
    module,
    require: (name) =>
      name === "react"
        ? {
            useEffect: (effect) => {
              cleanup = effect();
            },
          }
        : { jsx, jsxs: jsx },
    window: {
      setTimeout: (callback, delay) => {
        timer = { callback, delay };
        return 42;
      },
      clearTimeout: (id) => {
        cleared = id;
      },
    },
  });
  const tree = module.exports.BrandIntro({
    onComplete: () => {
      completed = true;
    },
  });
  assert.equal(find(tree, "video").props.src, "/brand-intro.mp4");
  assert.equal(find(tree, "video").props.muted, true);
  assert.equal(timer.delay, 2000);
  assert.equal(completed, false);
  timer.callback();
  assert.equal(completed, true);
  cleanup();
  assert.equal(cleared, 42);
});
