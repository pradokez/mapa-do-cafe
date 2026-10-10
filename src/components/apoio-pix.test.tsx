// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { brCodePix, type ConfigDoPix } from "@/lib/pix";

import { ApoioPix } from "./apoio-pix";

// A lib do QR não é verificada: o dublê devolve o código que recebeu.
vi.mock("@/lib/qr-svg", () => ({
  qrSvg: async (texto: string) => `<svg data-codigo="${texto}"></svg>`,
}));

const CONFIG: ConfigDoPix = { chave: "123e4567-e89b-12d3-a456-426614174000", nome: "Fulana de Tal", cidade: "Recife" };
const codigo = (valor: number | null) => brCodePix({ ...CONFIG, valor });

let user: ReturnType<typeof userEvent.setup>;
let writeText: ReturnType<typeof vi.fn>;

function dublarClipboard(clipboard: { writeText: (texto: string) => Promise<void> } | undefined) {
  Object.defineProperty(window.navigator, "clipboard", { value: clipboard, configurable: true });
}

beforeEach(() => {
  user = userEvent.setup();
  // Depois do `setup`, que instala o clipboard dele.
  writeText = vi.fn().mockResolvedValue(undefined);
  dublarClipboard({ writeText });
});
afterEach(cleanup);

async function abrir(variante: "desktop" | "mobile" = "desktop") {
  render(<ApoioPix config={CONFIG} variante={variante} />);
  await user.click(await screen.findByRole("button", { name: "Me paga um café?" }));
  return screen.getByRole("dialog", { name: "Me paga um café?" });
}

describe("ApoioPix", () => {
  it("abre com R$ 5 marcado, e o QR é o de R$ 5", async () => {
    const dialog = await abrir();

    const valores = within(dialog).getByRole("radiogroup", { name: "Valor do apoio" });
    expect(within(valores).getAllByRole("radio").map((r) => r.textContent)).toEqual(["R$ 5", "R$ 10", "R$ 20", "Livre"]);
    expect(within(valores).getByRole("radio", { name: "R$ 5" }).getAttribute("aria-checked")).toBe("true");
    const qr = await within(dialog).findByRole("img", { name: "QR Code Pix de R$ 5" });
    expect(await within(qr).findByText((_, el) => el?.getAttribute("data-codigo") === codigo(5))).toBeDefined();
  });

  it("trocar o valor muda o código copiado e o alt do QR", async () => {
    const dialog = await abrir();
    await user.click(within(dialog).getByRole("radio", { name: "Livre" }));

    expect(within(dialog).getByRole("radio", { name: "Livre" }).getAttribute("aria-checked")).toBe("true");
    expect(await within(dialog).findByRole("img", { name: "QR Code Pix, valor livre" })).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith(codigo(null));
  });

  it("as setas andam pelos valores como um grupo de escolha única", async () => {
    const dialog = await abrir();
    within(dialog).getByRole("radio", { name: "R$ 5" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");

    const r20 = within(dialog).getByRole("radio", { name: "R$ 20" });
    expect(r20.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(r20);
    // Só o marcado entra no Tab.
    expect(within(dialog).getAllByRole("radio").map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(within(dialog).getByRole("radio", { name: "Livre" }).getAttribute("aria-checked")).toBe("true");
  });

  it("copiar mostra e anuncia \"Copiado!\"; trocar o valor zera", async () => {
    const dialog = await abrir();
    await user.click(within(dialog).getByRole("button", { name: "Copiar" }));

    expect(writeText).toHaveBeenCalledWith(codigo(5));
    expect(within(dialog).getByRole("button", { name: "Copiado!" })).toBeDefined();
    expect(within(dialog).getByRole("status").textContent).toBe("Copiado!");

    await user.click(within(dialog).getByRole("radio", { name: "R$ 10" }));
    expect(within(dialog).getByRole("button", { name: "Copiar" })).toBeDefined();
    expect(within(dialog).getByRole("status").textContent).toBe("");
  });

  it("no mobile, o botão é só o ícone e a cópia diz \"Código copiado!\"", async () => {
    const dialog = await abrir("mobile");
    expect(within(dialog).getByText(/Qualquer valor ajuda o projeto a continuar existindo e crescer/)).toBeDefined();

    await user.click(within(dialog).getByRole("button", { name: "Copiar código Pix" }));

    expect(writeText).toHaveBeenCalledWith(codigo(5));
    expect(within(dialog).getByRole("button", { name: "Código copiado!" })).toBeDefined();
    expect(within(dialog).getByRole("status").textContent).toBe("Código copiado!");
  });

  it.each([
    ["rejeita", () => dublarClipboard({ writeText: () => Promise.reject(new Error("negado")) })],
    ["não existe", () => dublarClipboard(undefined)],
  ])("se o clipboard %s, o código aparece inteiro e selecionado, com a instrução", async (_, preparar) => {
    preparar();
    const dialog = await abrir();
    await user.click(within(dialog).getByRole("button", { name: "Copiar" }));

    const campo = await within(dialog).findByRole<HTMLTextAreaElement>("textbox", { name: "Selecione o código e copie" });
    expect(campo.readOnly).toBe(true);
    expect(campo.value).toBe(codigo(5));
    expect(document.activeElement).toBe(campo);
    expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, codigo(5).length]);
  });

  it("Esc fecha e o foco volta ao botão; o X também fecha", async () => {
    await abrir();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Me paga um café?" }));

    await user.click(screen.getByRole("button", { name: "Me paga um café?" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abrir e trocar o valor não mexem na URL", async () => {
    window.history.replaceState(null, "", "/?pets=true");
    const pushState = vi.spyOn(window.history, "pushState");
    const dialog = await abrir();
    await user.click(within(dialog).getByRole("radio", { name: "R$ 20" }));
    await user.keyboard("{Escape}");

    expect(pushState).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?pets=true");
  });
});
