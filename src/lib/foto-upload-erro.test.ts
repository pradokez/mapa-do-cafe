import { describe, expect, it } from "vitest";

import { ARTE, falhaDeRede, falhaDoPostgres, falhaDoPut, falhaDoStorage, mensagemDaFalha, sanear, type Falha } from "./foto-upload-erro";

const GENERICA = "Não deu para enviar a foto agora. Tente de novo em instantes.";

describe("mensagemDaFalha", () => {
  it("tabela inexistente no registro: diz que falta a migration e que não adianta tentar de novo", () => {
    const { mensagem, detalhes } = mensagemDaFalha({
      etapa: "registrar",
      codigo: "42P01",
      original: 'relation "public.cafe_fotos" does not exist',
    });
    expect(mensagem).toMatch(/migration/);
    expect(mensagem).toMatch(/Não adianta tentar de novo/);
    expect(detalhes).toEqual([
      "Etapa: registrar",
      "Código: 42P01",
      'Mensagem: relation "public.cafe_fotos" does not exist',
    ]);
  });
});

describe("mensagemDaFalha — cada causa tem frase própria", () => {
  const CAUSAS: Falha[] = [
    { etapa: "preparar", codigo: "offline" },
    { etapa: "preparar", codigo: "sessao" },
    { etapa: "preparar", codigo: "cafe" },
    { etapa: "preparar", codigo: "bucket" },
    { etapa: "preparar", codigo: "permissao" },
    { etapa: "preparar", codigo: "indisponivel" },
    { etapa: "enviar", codigo: "token-expirado" },
    { etapa: "enviar", codigo: "duplicado" },
    { etapa: "enviar", codigo: "storage-5xx" },
    { etapa: "enviar", codigo: "rede" },
    { etapa: "enviar", codigo: "timeout" },
    { etapa: "enviar", codigo: "413" },
    { etapa: "enviar", codigo: "415" },
    { etapa: "registrar", codigo: "sem-arquivo" },
    { etapa: "registrar", codigo: "exists" },
    { etapa: "registrar", codigo: "42P01" },
    { etapa: "registrar", codigo: "42501" },
    { etapa: "registrar", codigo: "23505" },
    { etapa: "registrar", codigo: "23503" },
    { etapa: "registrar", codigo: "23514" },
    { etapa: "registrar", codigo: "P0001" },
    { etapa: "registrar", codigo: "sem-resposta" },
  ];

  it.each(CAUSAS)("$etapa › $codigo não cai na frase genérica", (falha) => {
    expect(mensagemDaFalha(falha).mensagem).not.toBe(GENERICA);
  });

  it("nenhuma frase se repete entre causas diferentes", () => {
    const frases = CAUSAS.map((f) => mensagemDaFalha(f).mensagem);
    expect(new Set(frases).size).toBe(frases.length);
  });

  it("tabela fora do cache do PostgREST (PGRST205) é a mesma migration faltando que o 42P01", () => {
    expect(mensagemDaFalha({ etapa: "registrar", codigo: "PGRST205" }).mensagem).toBe(
      mensagemDaFalha({ etapa: "registrar", codigo: "42P01" }).mensagem,
    );
  });

  it("sessão expirada: diz que a foto não foi enviada e que o preenchido continua", () => {
    const { mensagem } = mensagemDaFalha({ etapa: "preparar", codigo: "sessao" });
    expect(mensagem).toMatch(/sessão expirou/);
    expect(mensagem).toMatch(/não foi enviada/);
  });

  it("registro sem resposta: a foto pode ou não ter entrado — recarregar e conferir", () => {
    expect(mensagemDaFalha({ etapa: "registrar", codigo: "sem-resposta" }).mensagem).toMatch(
      /pode ou não ter entrado.*recarregue/,
    );
  });

  it("causa desconhecida cai na frase genérica, com o código nos detalhes", () => {
    const { mensagem, detalhes } = mensagemDaFalha({ etapa: "enviar", codigo: "XX999", status: 418 });
    expect(mensagem).toBe(GENERICA);
    expect(detalhes).toEqual(["Etapa: enviar", "Código: XX999", "HTTP: 418"]);
  });

  it("registro que falha e deixa o arquivo no bucket: avisa do órfão, com o caminho nos detalhes", () => {
    const { mensagem, detalhes } = mensagemDaFalha({
      etapa: "registrar",
      codigo: "42501",
      orfao: true,
      caminho: "cafe/foto.webp",
    });
    expect(mensagem).toContain(mensagemDaFalha({ etapa: "registrar", codigo: "42501" }).mensagem);
    expect(mensagem).toMatch(/órfão/);
    expect(detalhes).toContain("Caminho: cafe/foto.webp");
  });
});

describe("falhaDoPostgres (erro do insert em cafe_fotos)", () => {
  it.each(["42P01", "PGRST205", "42501", "23505", "23503", "23514", "P0001"])("leva o código %s adiante", (code) => {
    expect(falhaDoPostgres({ code, message: "msg do banco" })).toEqual({
      etapa: "registrar",
      codigo: code,
      original: "msg do banco",
    });
  });

  it("sem código vira desconhecido", () => {
    expect(falhaDoPostgres({ message: "?" }).codigo).toBe("desconhecido");
    expect(falhaDoPostgres(null).codigo).toBe("desconhecido");
  });
});

describe("sanear (mensagem original nos detalhes e no log)", () => {
  it("tira URL (inclusive a assinada) e token", () => {
    const texto = sanear(
      "falhou https://x.supabase.co/storage/v1/object/upload/sign/cafe-fotos/a.webp?token=eyJabc.def e token=eyJxyz",
    );
    expect(texto).not.toMatch(/https?:|eyJ/);
    expect(texto).toContain("falhou");
  });

  it("corta mensagem longa demais e ignora o que não é texto", () => {
    expect(sanear("a".repeat(1000))!.length).toBeLessThanOrEqual(300);
    expect(sanear(undefined)).toBeUndefined();
    expect(sanear(42)).toBeUndefined();
  });
});

/** O `StorageApiError` do storage-js: HTTP 400 com o status "de verdade" em `statusCode`. */
const apiError = (message: string, status: number, statusCode: string) => ({
  name: "StorageApiError",
  message,
  status,
  statusCode,
});

describe("falhaDoStorage (createSignedUploadUrl e exists)", () => {
  it("bucket inexistente: migration não aplicada", () => {
    expect(falhaDoStorage("preparar", apiError("Bucket not found", 400, "404"))).toEqual({
      etapa: "preparar",
      codigo: "bucket",
      status: 400,
      original: "Bucket not found (statusCode 404)",
    });
  });

  it("política do Storage negou: permissão", () => {
    const rls = apiError("new row violates row-level security policy", 400, "403");
    expect(falhaDoStorage("preparar", rls).codigo).toBe("permissao");
    expect(falhaDoStorage("preparar", apiError("Unauthorized", 403, "403")).codigo).toBe("permissao");
  });

  it("Supabase fora do ar, hibernando ou em timeout: indisponível", () => {
    expect(falhaDoStorage("preparar", apiError("Internal Server Error", 500, "500")).codigo).toBe("indisponivel");
    expect(falhaDoStorage("preparar", apiError("Service Unavailable", 503, "503")).codigo).toBe("indisponivel");
    expect(falhaDoStorage("registrar", apiError("timeout", 544, "544")).codigo).toBe("indisponivel");
    // Sem resposta HTTP (rede, DNS, projeto pausado): StorageUnknownError, sem status.
    const semResposta = { name: "StorageUnknownError", message: "fetch failed" };
    expect(falhaDoStorage("preparar", semResposta)).toEqual({
      etapa: "preparar",
      codigo: "indisponivel",
      original: "fetch failed",
    });
  });

  it("outro erro do Storage não é adivinhado: desconhecido, com o que veio", () => {
    const f = falhaDoStorage("preparar", apiError("Invalid key", 400, "400"));
    expect(f.codigo).toBe("desconhecido");
    expect(f.status).toBe(400);
  });
});

describe("falhaDoPut (resposta do Storage ao upload pela URL assinada)", () => {
  const put = (status: number, corpo: unknown) => falhaDoPut(status, corpo);

  it("URL assinada expirada ou inválida: o envio demorou demais", () => {
    expect(put(400, { statusCode: "400", error: "InvalidJWT", message: '"exp" claim timestamp check failed' })).toEqual({
      etapa: "enviar",
      codigo: "token-expirado",
      status: 400,
      original: 'InvalidJWT: "exp" claim timestamp check failed',
    });
    expect(put(400, { statusCode: "403", error: "Unauthorized", message: "jwt expired" }).codigo).toBe("token-expirado");
    expect(put(401, { error: "InvalidSignature", message: "invalid signature" }).codigo).toBe("token-expirado");
  });

  it("política do bucket negou (403 sem relação com o token): permissão", () => {
    expect(
      put(400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }).codigo,
    ).toBe("permissao");
    expect(put(403, null).codigo).toBe("permissao");
  });

  it("caminho já existente: duplicado", () => {
    expect(put(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" }).codigo).toBe(
      "duplicado",
    );
  });

  it("tamanho e tipo recusados pelo bucket: 413 e 415, pelo statusCode do corpo", () => {
    expect(put(400, { statusCode: "413", error: "Payload too large" }).codigo).toBe("413");
    expect(put(415, null).codigo).toBe("415");
  });

  it("5xx: o Storage falhou ao receber", () => {
    expect(put(502, null)).toEqual({ etapa: "enviar", codigo: "storage-5xx", status: 502 });
  });

  it("outro status vira desconhecido, com o HTTP nos detalhes", () => {
    expect(put(418, null)).toEqual({ etapa: "enviar", codigo: "desconhecido", status: 418 });
  });
});

describe("falhaDeRede (fetch ou Server Action que rejeitou)", () => {
  it("timeout do AbortSignal vira timeout; o resto, rede — com a mensagem saneada", () => {
    const timeout = new DOMException("signal timed out", "TimeoutError");
    expect(falhaDeRede("enviar", timeout)).toEqual({ etapa: "enviar", codigo: "timeout", original: "signal timed out" });
    expect(falhaDeRede("enviar", new TypeError("Failed to fetch https://x.co/a?token=t"))).toEqual({
      etapa: "enviar",
      codigo: "rede",
      original: "Failed to fetch [url]",
    });
  });
});

describe("mensagemDaFalha — arte do combo (#105)", () => {
  // As frases do navegador (Safari sem WebP, limite de 2 MB) são as mesmas das fotos, de propósito.
  const DA_ARTE: Falha[] = [
    { etapa: "preparar", codigo: "offline" },
    { etapa: "preparar", codigo: "sessao" },
    { etapa: "preparar", codigo: "participante" },
    { etapa: "preparar", codigo: "bucket" },
    { etapa: "preparar", codigo: "permissao" },
    { etapa: "enviar", codigo: "token-expirado" },
    { etapa: "enviar", codigo: "duplicado" },
    { etapa: "enviar", codigo: "storage-5xx" },
    { etapa: "registrar", codigo: "sem-arquivo" },
    { etapa: "registrar", codigo: "exists" },
    { etapa: "registrar", codigo: "42P01" },
    { etapa: "registrar", codigo: "23505" },
    { etapa: "registrar", codigo: "23503" },
    { etapa: "registrar", codigo: "23514" },
    { etapa: "registrar", codigo: "P0001" },
    { etapa: "registrar", codigo: "sem-resposta" },
    { etapa: "registrar", codigo: "XX999" },
  ];

  it.each(DA_ARTE)("$etapa › $codigo fala da arte, não de foto nem de café sumido", (falha) => {
    const { mensagem } = mensagemDaFalha(falha, ARTE);
    expect(mensagem).not.toMatch(/foto|Enviar foto/i);
    expect(mensagem).not.toMatch(/O café não existe/);
  });

  it("sessão expirada: a arte não foi enviada, e o botão é Salvar", () => {
    const { mensagem } = mensagemDaFalha({ etapa: "preparar", codigo: "sessao" }, ARTE);
    expect(mensagem).toMatch(/a arte não foi enviada/);
    expect(mensagem).toMatch(/clique em Salvar/);
  });

  it("participação que sumiu: recarregar a página", () => {
    expect(mensagemDaFalha({ etapa: "preparar", codigo: "participante" }, ARTE).mensagem).toBe(
      "Este café não está mais nesta edição. Recarregue a página.",
    );
  });

  it("sem objeto, as frases continuam as das fotos", () => {
    expect(mensagemDaFalha({ etapa: "enviar", codigo: "XX999" }).mensagem).toBe(GENERICA);
    expect(mensagemDaFalha({ etapa: "enviar", codigo: "XX999" }, ARTE).mensagem).toBe(
      "Não deu para enviar a arte agora. Tente de novo em instantes.",
    );
  });
});
