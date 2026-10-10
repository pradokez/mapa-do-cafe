// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  prepararUpload: vi.fn(),
  registrarFoto: vi.fn(),
  descartarUpload: vi.fn(),
}));
vi.mock("@/lib/admin/fotos-actions", () => actions);

import { FotoUploadForm } from "./foto-upload-form";

const CAFE = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const CAMINHO = `${CAFE}/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.webp`;
const URL_ASSINADA = "https://xyz.supabase.co/storage/v1/object/upload/sign/cafe-fotos/x?token=t";

/**
 * O jsdom não decodifica nem desenha imagem: as fronteiras do navegador viram
 * stubs. `tipoGerado` simula o que o canvas devolve (o Safari devolve PNG).
 */
function navegador({ tipoGerado = "image/webp", put = new Response(null, { status: 200 }) } = {}) {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4000, height: 3000, close() {} })));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage() {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
    callback(new Blob(["webp"], { type: tipoGerado }));
  });
  URL.createObjectURL = vi.fn(() => "blob:previa");
  URL.revokeObjectURL = vi.fn();
  const fetch = vi.fn(async () => put);
  vi.stubGlobal("fetch", fetch);
  return { fetch };
}

async function preencherEEnviar() {
  await userEvent.upload(screen.getByLabelText("Foto"), new File(["jpg"], "foto.jpg", { type: "image/jpeg" }));
  await screen.findByAltText("Prévia da foto que vai ser enviada");
  await userEvent.click(screen.getByRole("radio", { name: "Cedida pelo café" }));
  await userEvent.type(screen.getByLabelText("Quem autorizou"), "Ana, dona do café");
  await userEvent.click(screen.getByRole("button", { name: "Enviar foto" }));
}

describe("FotoUploadForm", () => {
  it("origem começa sem escolha e a data da autorização começa em hoje (sem futuro)", () => {
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    expect(screen.getByRole("radio", { name: "Própria" })).toHaveProperty("checked", false);
    expect(screen.getByRole("radio", { name: "Cedida pelo café" })).toHaveProperty("checked", false);
    const data = screen.getByLabelText("Data da autorização");
    expect(data).toHaveProperty("value", "2026-10-04");
    expect(data.getAttribute("max")).toBe("2026-10-04");
  });

  it("sem foto, origem e quem autorizou, nada é enviado — e cada erro fica ligado ao campo", async () => {
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.click(screen.getByRole("button", { name: "Enviar foto" }));

    expect(actions.prepararUpload).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Foto").getAttribute("aria-describedby")).toContain("erro-foto");
    expect(screen.getByText("Escolha uma foto.").id).toBe("erro-foto");
    expect(screen.getByRole("group", { name: "Origem" }).getAttribute("aria-describedby")).toBe("erro-origem");
    expect(screen.getByText("Escolha a origem da foto.").id).toBe("erro-origem");
    const autorizadoPor = screen.getByLabelText("Quem autorizou");
    expect(autorizadoPor.getAttribute("aria-invalid")).toBe("true");
    expect(autorizadoPor.getAttribute("aria-describedby")).toBe("erro-autorizado_por");
    expect(screen.getByText("Diga quem autorizou.")).toBeTruthy();
  });

  it("arquivo fora de JPEG/PNG/WebP é recusado na hora, antes de qualquer envio", async () => {
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.upload(
      screen.getByLabelText("Foto"),
      new File(["x"], "foto.gif", { type: "image/gif" }),
      { applyAccept: false },
    );

    expect(screen.getByText("Use uma foto JPEG, PNG ou WebP.").id).toBe("erro-foto");
    expect(actions.prepararUpload).not.toHaveBeenCalled();
  });

  it("foto HEIC do iPhone: diz que é HEIC e como exportar em JPEG — mesmo com o tipo vazio", async () => {
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.upload(screen.getByLabelText("Foto"), new File(["x"], "IMG_0042.HEIC", { type: "" }), {
      applyAccept: false,
    });

    const erro = document.getElementById("erro-foto")!;
    expect(erro.textContent).toMatch(/HEIC.*JPEG/);
    expect(actions.prepararUpload).not.toHaveBeenCalled();
  });
});

describe("FotoUploadForm — envio", () => {
  it("converte, sobe direto para a URL assinada e registra com a autorização", async () => {
    const { fetch } = navegador();
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    actions.registrarFoto.mockResolvedValue({ ok: true });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    expect(await screen.findByText("Foto enviada. Já está no site.")).toBeTruthy();
    const autorizacao = {
      origem: "cedida",
      autorizado_por: "Ana, dona do café",
      autorizado_em: "2026-10-04",
      observacao: null,
    };
    expect(actions.prepararUpload).toHaveBeenCalledWith(CAFE, autorizacao, { type: "image/webp", size: 4 });
    expect(fetch).toHaveBeenCalledWith(URL_ASSINADA, expect.objectContaining({ method: "PUT" }));
    // Sem marcar "Foto temporária", a foto é definitiva (#92).
    expect(actions.registrarFoto).toHaveBeenCalledWith(CAFE, CAMINHO, autorizacao, false);
    expect(screen.queryByAltText("Prévia da foto que vai ser enviada")).toBeNull();
  });

  it("foto temporária (#92): começa desmarcada; marcada, vai ao registro e desmarca depois do envio", async () => {
    navegador();
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    actions.registrarFoto.mockResolvedValue({ ok: true });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    const temporaria = screen.getByRole("checkbox", { name: "Foto temporária" });
    expect(temporaria).toHaveProperty("checked", false);
    await userEvent.click(temporaria);
    await preencherEEnviar();

    await screen.findByText("Foto enviada. Já está no site.");
    expect(actions.registrarFoto).toHaveBeenCalledWith(CAFE, CAMINHO, expect.anything(), true);
    expect(temporaria).toHaveProperty("checked", false);
  });

  it("navegador que não gera WebP: recusa ao escolher, pedindo outro navegador", async () => {
    navegador({ tipoGerado: "image/png" });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.upload(screen.getByLabelText("Foto"), new File(["jpg"], "foto.jpg", { type: "image/jpeg" }));

    expect(
      await screen.findByText(
        "Este navegador não consegue converter a foto para WebP. Use o Chrome, o Edge ou o Firefox.",
      ),
    ).toBeTruthy();
    expect(screen.queryByAltText("Prévia da foto que vai ser enviada")).toBeNull();
  });

  it("canvas sem memória (toBlob devolve null): pede foto menor, sem confundir com arquivo corrompido", async () => {
    navegador();
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(null));
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.upload(screen.getByLabelText("Foto"), new File(["jpg"], "foto.jpg", { type: "image/jpeg" }));

    expect(await screen.findByText(/grande demais para a memória dele/)).toBeTruthy();
  });

  it("arquivo que o navegador não decodifica: pode estar corrompido, tente outra", async () => {
    navegador();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new DOMException("bad", "InvalidStateError"))));
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.upload(screen.getByLabelText("Foto"), new File(["jpg"], "foto.jpg", { type: "image/jpeg" }));

    expect(await screen.findByText(/O arquivo pode estar corrompido/)).toBeTruthy();
  });

  it("registro que não responde depois do upload: o arquivo é descartado (sem órfão)", async () => {
    navegador();
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    actions.registrarFoto.mockRejectedValue(new TypeError("Failed to fetch"));
    actions.descartarUpload.mockResolvedValue(undefined);
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    await waitFor(() => expect(actions.descartarUpload).toHaveBeenCalledWith(CAFE, CAMINHO));
    expect(await screen.findByText(/A foto pode ou não ter entrado: recarregue a página/)).toBeTruthy();
    expect(detalhes()).toContain("Etapa: registrar");
  });

  it("bucket recusa o arquivo (tamanho): mensagem clara e nada é registrado", async () => {
    navegador({ put: Response.json({ statusCode: "413", error: "Payload too large" }, { status: 400 }) });
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    expect(
      await screen.findByText("A foto convertida passou de 2 MB. Tente uma foto com menos detalhes."),
    ).toBeTruthy();
    expect(actions.registrarFoto).not.toHaveBeenCalled();
  });
});

/** O texto de "Detalhes técnicos" (recolhido, mas no DOM). */
function detalhes(): string {
  const resumo = screen.getByText("Detalhes técnicos");
  return resumo.closest("details")!.textContent ?? "";
}

describe("FotoUploadForm — erro por etapa e causa (#74)", () => {
  it("sessão expirada: explica, oferece entrar de novo e mantém a foto e os campos", async () => {
    navegador();
    actions.prepararUpload.mockResolvedValue({ ok: false, falha: { etapa: "preparar", codigo: "sessao" } });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    const alerta = await screen.findByText(/Sua sessão expirou e a foto não foi enviada/);
    expect(alerta.closest("[role=alert]")).toBeTruthy();
    const entrar = screen.getByRole("link", { name: /Entrar de novo/ });
    expect(entrar.getAttribute("href")).toBe(`/admin/login?next=${encodeURIComponent(`/admin/cafes/${CAFE}`)}`);
    expect(entrar.getAttribute("target")).toBe("_blank");
    // Nada se perdeu: a prévia e o que foi digitado continuam para reenviar.
    expect(screen.getByAltText("Prévia da foto que vai ser enviada")).toBeTruthy();
    expect(screen.getByLabelText("Quem autorizou")).toHaveProperty("value", "Ana, dona do café");
    expect(screen.getByRole("radio", { name: "Cedida pelo café" })).toHaveProperty("checked", true);
  });

  it("URL assinada expirada no PUT: o envio demorou demais, sem registrar", async () => {
    navegador({
      put: Response.json(
        { statusCode: "400", error: "InvalidJWT", message: '"exp" claim timestamp check failed' },
        { status: 400 },
      ),
    });
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    expect(await screen.findByText(/O envio demorou demais e a autorização para subir a foto expirou/)).toBeTruthy();
    expect(detalhes()).toContain("Etapa: enviar");
    expect(detalhes()).toContain("HTTP: 400");
    expect(actions.registrarFoto).not.toHaveBeenCalled();
  });

  it("tabela inexistente no registro: aponta a migration, com o código do Postgres nos detalhes", async () => {
    navegador();
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    actions.registrarFoto.mockResolvedValue({
      ok: false,
      falha: { etapa: "registrar", codigo: "42P01", original: 'relation "public.cafe_fotos" does not exist' },
    });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    expect(await screen.findByText(/A tabela de fotos não existe no banco/)).toBeTruthy();
    expect(detalhes()).toContain("Código: 42P01");
    expect(detalhes()).toContain('relation "public.cafe_fotos" does not exist');
  });

  it("os detalhes nunca mostram a URL assinada nem o token", async () => {
    navegador();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(`Failed to fetch ${URL_ASSINADA}`);
      }),
    );
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    expect(await screen.findByText(/A conexão caiu durante o envio/)).toBeTruthy();
    expect(detalhes()).not.toMatch(/token|supabase\.co/);
  });

  it("sem internet ao clicar: avisa sem chamar o servidor", async () => {
    navegador();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    expect(await screen.findByText(/Você está sem internet/)).toBeTruthy();
    expect(actions.prepararUpload).not.toHaveBeenCalled();
  });

  it("o foco vai para o erro (o botão ficou desabilitado durante o envio)", async () => {
    navegador();
    actions.prepararUpload.mockResolvedValue({ ok: false, falha: { etapa: "preparar", codigo: "bucket" } });
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    const alerta = (await screen.findByText(/O bucket de fotos não existe/)).closest("[role=alert]")!;
    await waitFor(() => expect(alerta.contains(document.activeElement)).toBe(true));
  });
});
