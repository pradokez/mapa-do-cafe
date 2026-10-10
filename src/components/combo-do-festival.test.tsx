// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { Edicao, Participacao } from "@/lib/festival";

import { ComboDoFestival } from "./combo-do-festival";

afterEach(cleanup);

const ARTE = "https://x.supabase.co/storage/v1/object/public/festival-artes/e1/a.webp";
const ALT = "Combo 13, Profiteroles Passion: choux crocante recheado com sorvete de creme.";

const edicao: Edicao = {
  id: "e1",
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: true,
  participacoes: [],
};

const participacao = (mais: Partial<Participacao> = {}): Participacao => ({
  id: "p1",
  cafe_id: "kaffe",
  numero: 13,
  nome_combo: "Profiteroles Passion + cappuccino",
  alt: ALT,
  instagram_url: "https://instagram.com/p/abc",
  arte: ARTE,
  ...mais,
});

/** Meio-dia em Recife; padrão: durante a edição. */
const DURANTE = new Date("2026-10-20T15:00:00Z");

function renderCombo(mais: Partial<Participacao> = {}, agora = DURANTE) {
  return render(
    <ComboDoFestival cafe={cafe("kaffe")} edicao={edicao} participacao={participacao(mais)} agora={agora} />,
  );
}

describe("ComboDoFestival", () => {
  it("mostra número, nome, preço único, a nota e o festival até o último dia", () => {
    renderCombo();
    const bloco = screen.getByRole("region", { name: "Combo 13" });
    expect(within(bloco).getByText("Profiteroles Passion + cappuccino")).toBeTruthy();
    expect(within(bloco).getByText("R$ 34,90")).toBeTruthy();
    expect(within(bloco).getByText("preço único dos combos no festival")).toBeTruthy();
    expect(within(bloco).getByText("Disponível enquanto durar o festival, no horário normal da casa.")).toBeTruthy();
    expect(bloco.textContent).toContain("Eu Amo Café");
    expect(bloco.textContent).toContain("até 15 nov");
  });

  it("antes do início, a pílula conta os dias e a nota diz de quando a quando", () => {
    renderCombo({}, new Date("2026-10-13T15:00:00Z"));
    const bloco = screen.getByRole("region", { name: "Combo 13" });
    expect(bloco.textContent).toContain("Eu Amo Café · começa em 5 dias");
    expect(bloco.textContent).not.toContain("Eu Amo Café · até");
    expect(
      within(bloco).getByText("Disponível a partir de 18 out (em 5 dias), até 15 nov, no horário normal da casa."),
    ).toBeTruthy();
    expect(within(bloco).queryByText("Disponível enquanto durar o festival, no horário normal da casa.")).toBeNull();
  });

  it("sem número, o título é o do festival", () => {
    renderCombo({ numero: null });
    expect(screen.getByRole("heading", { name: "Combo do Eu Amo Café" })).toBeTruthy();
  });

  it("a arte aparece inteira, sem corte, com o alt cadastrado e o crédito do festival", () => {
    renderCombo();
    const arte = screen.getByAltText(ALT);
    expect(arte.getAttribute("src")).toBe(ARTE);
    expect(arte.className).toContain("object-contain");
    expect(screen.getByText("Arte: Eu Amo Café")).toBeTruthy();
  });

  it("sem arte, mostra o placeholder listrado e nada para ampliar", () => {
    renderCombo({ arte: null, alt: null });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ampliar arte do combo" })).toBeNull();
    expect(screen.getByTestId("arte-placeholder").getAttribute("style")).toContain("repeating-linear-gradient");
    expect(screen.queryByText("Arte: Eu Amo Café")).toBeNull();
  });

  it("\"Ver no Instagram\" só aparece com o link do post", () => {
    renderCombo();
    const link = screen.getByRole("link", { name: /Ver no Instagram/ });
    expect(link.getAttribute("href")).toBe("https://instagram.com/p/abc");
    expect(link.getAttribute("target")).toBe("_blank");

    cleanup();
    renderCombo({ instagram_url: null });
    expect(screen.queryByRole("link", { name: /Ver no Instagram/ })).toBeNull();

    cleanup();
    renderCombo({ instagram_url: "javascript:alert(1)" });
    expect(screen.queryByRole("link", { name: /Ver no Instagram/ })).toBeNull();
  });

  it("\"Outros combos do festival\" leva à página da edição", () => {
    renderCombo();
    const link = screen.getByRole("link", { name: "Outros combos do festival" });
    expect(link.getAttribute("href")).toBe("/festivais/eu-amo-cafe/2026");
  });

  it("a arte ampliada abre e fecha pelo teclado, e o foco volta ao botão", async () => {
    const user = userEvent.setup();
    renderCombo();
    const ampliar = screen.getByRole("button", { name: "Ampliar arte do combo" });

    ampliar.focus();
    await user.keyboard("{Enter}");
    const dialogo = screen.getByRole("dialog", { name: "Combo 13 · Eu Amo Café" });
    expect(within(dialogo).getByAltText(ALT).className).toContain("object-contain");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(ampliar);
  });
});
