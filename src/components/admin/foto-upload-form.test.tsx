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
      new File(["x"], "foto.heic", { type: "image/heic" }),
      { applyAccept: false },
    );

    expect(screen.getByText("Use uma foto JPEG, PNG ou WebP.").id).toBe("erro-foto");
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
    expect(actions.registrarFoto).toHaveBeenCalledWith(CAFE, CAMINHO, autorizacao);
    expect(screen.queryByAltText("Prévia da foto que vai ser enviada")).toBeNull();
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

  it("registro que não responde depois do upload: o arquivo é descartado (sem órfão)", async () => {
    navegador();
    actions.prepararUpload.mockResolvedValue({ ok: true, caminho: CAMINHO, url: URL_ASSINADA });
    actions.registrarFoto.mockRejectedValue(new TypeError("Failed to fetch"));
    actions.descartarUpload.mockResolvedValue(undefined);
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await preencherEEnviar();

    await waitFor(() => expect(actions.descartarUpload).toHaveBeenCalledWith(CAFE, CAMINHO));
    expect(
      await screen.findByText("Não deu para enviar a foto agora. Tente de novo em instantes."),
    ).toBeTruthy();
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
