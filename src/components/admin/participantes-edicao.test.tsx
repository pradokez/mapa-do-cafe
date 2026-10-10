// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { Participacao } from "@/lib/festival";

const actions = vi.hoisted(() => ({
  adicionarParticipante: vi.fn(),
  salvarParticipante: vi.fn(),
  removerParticipante: vi.fn(),
}));
vi.mock("@/lib/admin/festivais-actions", () => actions);

const artes = vi.hoisted(() => ({
  prepararArte: vi.fn(),
  registrarArte: vi.fn(),
  descartarArte: vi.fn(),
  removerArte: vi.fn(),
}));
vi.mock("@/lib/admin/artes-actions", () => artes);

import { ParticipantesEdicao } from "./participantes-edicao";

const EDICAO = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
const HOJE = "2026-10-10";

const CAFES = [
  cafe("borsoi", { nome: "Borsoi Café", bairro: "Pina" }),
  cafe("castigliani", { nome: "Castigliani", bairro: "Graças" }),
  cafe("cantinho", { nome: "Melhor Cantinho", bairro: "Várzea" }),
  cafe("fora", { nome: "Café Fechado", bairro: "Várzea", ativo: false }),
];

const participacao = (cafeId: string, campos: Partial<Participacao> = {}): Participacao => ({
  id: `p-${cafeId}`,
  cafe_id: cafeId,
  numero: null,
  nome_combo: null,
  alt: null,
  instagram_url: null,
  arte: null,
  ...campos,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const itens = () => screen.getAllByRole("listitem").filter((li) => li.querySelector("details"));

describe("ParticipantesEdicao", () => {
  it("mostra quem está sem número e sem arte, numerados primeiro", () => {
    render(
      <ParticipantesEdicao
        artes={{}}
        hoje={HOJE}
        edicaoId={EDICAO}
        cafes={CAFES}
        participacoes={[
          participacao("borsoi"),
          participacao("castigliani", { numero: 2, arte: "https://x/a.webp", alt: "Combo 2" }),
        ]}
      />,
    );

    expect(screen.getByText("2 cafés · 1 sem número · 1 sem arte")).toBeTruthy();
    const [primeiro, segundo] = itens();
    expect(primeiro.textContent).toMatch(/Nº 2.*Castigliani/);
    expect(within(primeiro).queryByText("Sem número")).toBeNull();
    expect(within(primeiro).queryByText("Sem arte")).toBeNull();
    expect(within(segundo).getByText("Sem número")).toBeTruthy();
    expect(within(segundo).getByText("Sem arte")).toBeTruthy();
  });

  it("a busca mostra só cafés no ar que ainda não participam", async () => {
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.type(screen.getByLabelText("Adicionar café"), "café");
    // "Borsoi Café" já participa e "Café Fechado" está fora do ar.
    expect(screen.queryByRole("list", { name: "Cafés para adicionar" })).toBeNull();
    expect(screen.getByText("Nenhum café no ar fora da edição com essa busca.")).toBeTruthy();
  });

  it("adicionar chama a action com o café e devolve o foco à busca", async () => {
    actions.adicionarParticipante.mockResolvedValue({ ok: true });
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[]} />);

    const busca = screen.getByLabelText("Adicionar café");
    await userEvent.type(busca, "varzea");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar Melhor Cantinho" }));

    expect(actions.adicionarParticipante).toHaveBeenCalledWith(EDICAO, "cantinho");
    expect(document.activeElement).toBe(busca);
    expect(screen.getByRole("status").textContent).toBe("Melhor Cantinho entrou na edição.");
  });

  it("número repetido vindo do servidor aparece no campo", async () => {
    actions.salvarParticipante.mockResolvedValue({
      ok: false,
      erro: null,
      erros: { numero: "O número 2 já é de Castigliani." },
    });
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.type(screen.getByLabelText("Número"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(actions.salvarParticipante).toHaveBeenCalledWith(EDICAO, "p-borsoi", expect.objectContaining({ numero: "2" }));
    expect(screen.getByText("O número 2 já é de Castigliani.")).toBeTruthy();
    expect(screen.getByLabelText("Número").getAttribute("aria-invalid")).toBe("true");
  });

  it("link de perfil é recusado antes de chegar ao servidor", async () => {
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.type(screen.getByLabelText("Link do post no Instagram"), "instagram.com/borsoicafe");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("Cole o link do post ou do reel no Instagram.")).toBeTruthy();
    expect(actions.salvarParticipante).not.toHaveBeenCalled();
  });

  it("tirar da edição pede confirmação, com o foco em Cancelar", async () => {
    actions.removerParticipante.mockResolvedValue({ ok: true });
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar da edição" }));
    const dialogo = screen.getByRole("alertdialog", { name: "Tirar Borsoi Café da edição?" });
    expect(document.activeElement?.textContent).toBe("Cancelar");
    expect(actions.removerParticipante).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Tirar da edição" }));
    expect(actions.removerParticipante).toHaveBeenCalledWith(EDICAO, "p-borsoi");
    expect(screen.getByRole("status").textContent).toBe("Borsoi Café saiu da edição.");
  });
});

const CAMINHO = `${EDICAO}/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.webp`;

/** O jsdom não decodifica nem desenha imagem: as fronteiras do navegador viram stubs (como no upload de foto). */
function navegador({ tipoGerado = "image/webp" } = {}) {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1080, height: 1350, close() {} })));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage() {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
    callback(new Blob(["webp"], { type: tipoGerado }));
  });
  URL.createObjectURL = vi.fn(() => "blob:previa");
  URL.revokeObjectURL = vi.fn();
  const fetch = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  return { fetch };
}

async function escolherArte() {
  await userEvent.upload(screen.getByLabelText("Enviar a arte"), new File(["jpg"], "arte.jpg", { type: "image/jpeg" }));
  await screen.findByAltText("Prévia da arte que vai ser enviada");
}

describe("ParticipantesEdicao — arte do combo (#105)", () => {
  it("com arte no ar: miniatura, quem autorizou e quando, e Trocar a arte", () => {
    render(
      <ParticipantesEdicao
        edicaoId={EDICAO}
        cafes={CAFES}
        hoje={HOJE}
        participacoes={[participacao("borsoi", { arte: "https://x/a.webp", alt: "Combo 13" })]}
        artes={{ "p-borsoi": { caminho: CAMINHO, autorizado_por: "ASCAPE", autorizado_em: "2026-10-01" } }}
      />,
    );

    expect(screen.getByAltText("Arte do combo de Borsoi Café")).toBeTruthy();
    expect(screen.getByText("Autorizada por ASCAPE, em 01/10/2026")).toBeTruthy();
    expect(screen.getByLabelText("Trocar a arte")).toBeTruthy();
  });

  it("arquivo escolhido pede a autorização; sem alt e sem quem autorizou, nada sobe", async () => {
    navegador();
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    expect(screen.queryByLabelText("Quem autorizou")).toBeNull();
    await escolherArte();
    expect(screen.getByLabelText("Data da autorização")).toHaveProperty("value", HOJE);
    // Escolhida não é salva: o café continua marcado sem arte até o Salvar dar certo.
    expect(within(itens()[0]).getByText("Sem arte")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("Descreva a arte: o texto do combo está dentro da imagem.")).toBeTruthy();
    expect(screen.getByText("Diga quem autorizou.")).toBeTruthy();
    expect(artes.prepararArte).not.toHaveBeenCalled();
    expect(actions.salvarParticipante).not.toHaveBeenCalled();
  });

  it("Safari (sem WebP no canvas) é recusado com a mesma frase das fotos", async () => {
    navegador({ tipoGerado: "image/png" });
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.upload(screen.getByLabelText("Enviar a arte"), new File(["jpg"], "arte.jpg", { type: "image/jpeg" }));
    expect(
      await screen.findByText("Este navegador não consegue converter a foto para WebP. Use o Chrome, o Edge ou o Firefox."),
    ).toBeTruthy();
  });

  it("com alt e autorização: prepara, sobe direto ao Storage e registra tudo junto", async () => {
    const { fetch } = navegador();
    artes.prepararArte.mockResolvedValue({ ok: true, caminho: CAMINHO, url: "https://x/sign?token=t" });
    artes.registrarArte.mockResolvedValue({
      ok: true,
      valores: { numero: null, nome_combo: null, alt: "Combo 13: espresso.", instagram_url: null },
    });
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await escolherArte();
    await userEvent.type(screen.getByLabelText(/Texto alternativo da arte/), "Combo 13: espresso.");
    await userEvent.type(screen.getByLabelText("Quem autorizou"), "ASCAPE");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(artes.registrarArte).toHaveBeenCalled());
    expect(artes.prepararArte).toHaveBeenCalledWith(
      EDICAO,
      "p-borsoi",
      { autorizado_por: "ASCAPE", autorizado_em: HOJE },
      { type: "image/webp", size: 4 },
    );
    expect(fetch).toHaveBeenCalledWith("https://x/sign?token=t", expect.objectContaining({ method: "PUT" }));
    expect(artes.registrarArte).toHaveBeenCalledWith(
      EDICAO,
      "p-borsoi",
      CAMINHO,
      expect.objectContaining({ alt: "Combo 13: espresso.", autorizado_por: "ASCAPE", autorizado_em: HOJE }),
    );
    expect(actions.salvarParticipante).not.toHaveBeenCalled();
    expect(await screen.findByText("Salvo.")).toBeTruthy();
  });

  it("registro que não responde chama o descarte e explica, falando da arte", async () => {
    navegador();
    artes.prepararArte.mockResolvedValue({ ok: true, caminho: CAMINHO, url: "https://x/sign?token=t" });
    artes.registrarArte.mockRejectedValue(new TypeError("Failed to fetch"));
    artes.descartarArte.mockResolvedValue(undefined);
    render(<ParticipantesEdicao artes={{}} hoje={HOJE} edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await escolherArte();
    await userEvent.type(screen.getByLabelText(/Texto alternativo da arte/), "Combo 13: espresso.");
    await userEvent.type(screen.getByLabelText("Quem autorizou"), "ASCAPE");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/A arte pode ou não ter entrado/)).toBeTruthy();
    expect(artes.descartarArte).toHaveBeenCalledWith(EDICAO, CAMINHO);
  });

  it("remover a arte pede confirmação, com o foco em Cancelar", async () => {
    artes.removerArte.mockResolvedValue({ ok: true });
    render(
      <ParticipantesEdicao
        edicaoId={EDICAO}
        cafes={CAFES}
        hoje={HOJE}
        participacoes={[participacao("borsoi", { arte: "https://x/a.webp", alt: "Combo 13" })]}
        artes={{}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remover arte" }));
    const dialogo = screen.getByRole("alertdialog", { name: "Remover a arte de Borsoi Café?" });
    expect(document.activeElement?.textContent).toBe("Cancelar");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Remover arte" }));

    expect(artes.removerArte).toHaveBeenCalledWith(EDICAO, "p-borsoi");
    expect(screen.getByRole("status").textContent).toBe("Borsoi Café: arte removida.");
  });
});
