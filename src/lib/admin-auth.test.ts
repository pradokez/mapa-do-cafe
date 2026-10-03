import { describe, expect, it } from "vitest";

import { destinoSeguro, etapaDoLogin, isUuid, urlDoLogin } from "./admin-auth";

const admin = { app_metadata: { role: "admin" } };

describe("etapaDoLogin", () => {
  it("sem sessão, pede a senha", () => {
    expect(etapaDoLogin(null)).toBe("senha");
  });

  it("admin que já passou pelo segundo fator (aal2) está pronto", () => {
    expect(etapaDoLogin({ ...admin, aal: "aal2" })).toBe("pronto");
  });

  it("admin só com a senha (aal1) e autenticador cadastrado digita o código", () => {
    expect(etapaDoLogin({ ...admin, aal: "aal1" }, { temFatorVerificado: true })).toBe("codigo");
  });

  it("admin só com a senha e sem autenticador precisa cadastrar um", () => {
    expect(etapaDoLogin({ ...admin, aal: "aal1" }, { temFatorVerificado: false })).toBe(
      "cadastro-mfa",
    );
  });

  it("role em user_metadata não conta: o próprio usuário consegue editá-lo", () => {
    expect(etapaDoLogin({ user_metadata: { role: "admin" }, aal: "aal2" } as never)).toBe("senha");
  });

  it("conta sem role de admin nunca passa da senha, nem com segundo fator", () => {
    expect(etapaDoLogin({ app_metadata: {}, aal: "aal2" }, { temFatorVerificado: true })).toBe(
      "senha",
    );
    expect(etapaDoLogin({ app_metadata: { role: "editor" }, aal: "aal2" })).toBe("senha");
  });
});

describe("destinoSeguro", () => {
  it("volta para a página do admin pedida antes do login", () => {
    expect(destinoSeguro("/admin/cafes/6934bcef-f5ec-49f8-b8e2-da0e8b31c280")).toBe(
      "/admin/cafes/6934bcef-f5ec-49f8-b8e2-da0e8b31c280",
    );
  });

  it.each([
    ["sem next", undefined],
    ["vazio", ""],
    ["não é texto", ["/admin"]],
    ["URL absoluta", "https://evil.example/admin"],
    ["protocolo relativo", "//evil.example/admin"],
    ["barra invertida", "/\\evil.example"],
    ["fora do admin", "/cafes/borsoi-cafe-riomar"],
    ["prefixo parecido", "/admin-evil"],
    ["subindo de pasta", "/admin/../cafes"],
    ["javascript:", "javascript:alert(1)"],
    ["a própria tela de login", "/admin/login"],
  ])("%s cai em /admin", (_, next) => {
    expect(destinoSeguro(next)).toBe("/admin");
  });

  it("mantém a query de uma página do admin", () => {
    expect(destinoSeguro("/admin?x=1")).toBe("/admin?x=1");
  });
});

describe("isUuid", () => {
  it("aceita o id de um café, em qualquer caixa", () => {
    expect(isUuid("6934bcef-f5ec-49f8-b8e2-da0e8b31c280")).toBe(true);
    expect(isUuid("6934BCEF-F5EC-49F8-B8E2-DA0E8B31C280")).toBe(true);
  });

  it.each(["", "borsoi-cafe-riomar", "6934bcef-f5ec-49f8-b8e2-da0e8b31c28", "6934bcef-f5ec-49f8-b8e2-da0e8b31c280x"])(
    "recusa %j (vira 404 sem ir ao banco)",
    (id) => {
      expect(isUuid(id)).toBe(false);
    },
  );
});

describe("urlDoLogin", () => {
  it("sem destino específico, é só a tela de login", () => {
    expect(urlDoLogin("/admin")).toBe("/admin/login");
    expect(urlDoLogin(null)).toBe("/admin/login");
  });

  it("guarda a página do admin pedida em ?next=, codificada", () => {
    expect(urlDoLogin("/admin/cafes/abc?x=1")).toBe("/admin/login?next=%2Fadmin%2Fcafes%2Fabc%3Fx%3D1");
  });

  it("não carrega destino de fora do admin", () => {
    expect(urlDoLogin("https://evil.example")).toBe("/admin/login");
  });
});
