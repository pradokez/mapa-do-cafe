// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));

// O `use-geolocation` é real: o dublê é o `navigator.geolocation`, e cada
// pedido fica na fila para o teste responder quando quiser.
type Pedido = { ok: PositionCallback; erro: PositionErrorCallback };
let pedidos: Pedido[];
const getCurrentPosition = vi.fn((ok: PositionCallback, erro?: PositionErrorCallback | null) => {
  pedidos.push({ ok, erro: erro! });
});

const MARCO_ZERO = { latitude: -8.0631, longitude: -34.8711 };
const NEGADA = 1;
const responder = (pedido: Pedido, resposta: "posicao" | "negada") =>
  act(() => {
    if (resposta === "posicao") pedido.ok({ coords: MARCO_ZERO } as GeolocationPosition);
    else pedido.erro({ code: NEGADA, PERMISSION_DENIED: NEGADA } as GeolocationPositionError);
  });

// Ao norte do Marco Zero: ~5,5 km e ~0,6 km. Em ordem alfabética, "Longe" vem antes.
const CAFES = [
  cafe("longe", { nome: "Longe", slug: "longe", lat: -8.0131, lng: -34.8711 }),
  cafe("perto", { nome: "Perto", slug: "perto", lat: -8.0581, lng: -34.8711 }),
];

beforeEach(async () => {
  pedidos = [];
  getCurrentPosition.mockClear();
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
  window.history.replaceState(null, "", "/");
  // O store da posição é do módulo: cada teste começa de um carregamento novo.
  vi.resetModules();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Abre a home e responde ao pedido da abertura com a recusa. */
async function homeSemPosicao() {
  const { CafeDirectory } = await import("./cafe-directory");
  render(<CafeDirectory cafes={CAFES} festivais={{}} vitrines={[]} agora={new Date()} />);
  await responder(pedidos[0], "negada");
}

const AVISO = "Permita a localização para filtrar por distância.";
const aviso = () => screen.getAllByRole("status").find((el) => el.textContent?.includes(AVISO));
const nomes = () =>
  screen.getAllByRole("article").map((card) => within(card).getAllByRole("link")[0].textContent);

/** Os dois chips de distância: o do mobile abre o sheet; o do desktop, o menu. */
const chip = (abre: "dialog" | "menu") =>
  screen.getAllByRole("button", { name: /^Distância/ }).find((el) => el.getAttribute("aria-haspopup") === abre)!;

describe("Distância sem posição", () => {
  it("os dois chips ficam aria-disabled, mas continuam focáveis", async () => {
    await homeSemPosicao();

    for (const el of [chip("menu"), chip("dialog")]) {
      expect(el.getAttribute("aria-disabled")).toBe("true");
      expect(el.hasAttribute("disabled")).toBe(false);
      el.focus();
      expect(document.activeElement).toBe(el);
    }
  });

  it.each(["menu", "dialog"] as const)("tocar no chip (%s) pede a posição de novo, sem abrir nada", async (abre) => {
    await homeSemPosicao();

    await userEvent.click(chip(abre));

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole(abre)).toBeNull();
  });

  it("deu certo: o chip habilita no mesmo lugar (com o foco), sem toast, e a lista reordena por distância", async () => {
    await homeSemPosicao();
    expect(nomes()).toEqual(["Longe", "Perto"]);

    chip("menu").focus();
    await userEvent.keyboard("{Enter}");
    await responder(pedidos[1], "posicao");

    expect(chip("menu").hasAttribute("aria-disabled")).toBe(false);
    expect(chip("dialog").hasAttribute("aria-disabled")).toBe(false);
    expect(document.activeElement).toBe(chip("menu"));
    expect(nomes()).toEqual(["Perto", "Longe"]);
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("falhou: o toast aparece em role=\"status\" e o foco fica no chip", async () => {
    await homeSemPosicao();

    chip("dialog").focus();
    await userEvent.keyboard("{Enter}");
    await responder(pedidos[1], "negada");

    expect(aviso()?.textContent).toBe(AVISO);
    expect(document.activeElement).toBe(chip("dialog"));
  });

  it("tocar de novo durante a tentativa não dispara outra", async () => {
    await homeSemPosicao();

    await userEvent.click(chip("dialog"));
    await userEvent.click(chip("menu"));
    await userEvent.click(chip("dialog"));

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(chip("menu").getAttribute("aria-busy")).toBe("true");
    expect(chip("dialog").getAttribute("aria-busy")).toBe("true");

    await responder(pedidos[1], "negada");
    expect(chip("dialog").hasAttribute("aria-busy")).toBe(false);
    await userEvent.click(chip("dialog"));
    expect(getCurrentPosition).toHaveBeenCalledTimes(3);
  });

  it("sem resposta em 15 s, a tentativa conta como falha; a posição que chega depois ainda vale", async () => {
    await homeSemPosicao();
    vi.useFakeTimers();

    fireEvent.click(chip("dialog"));
    await act(() => vi.advanceTimersByTimeAsync(14_999));
    expect(aviso()).toBeUndefined();
    expect(chip("dialog").getAttribute("aria-busy")).toBe("true");

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(aviso()?.textContent).toBe(AVISO);
    expect(chip("dialog").hasAttribute("aria-busy")).toBe(false);

    await responder(pedidos[1], "posicao");
    expect(chip("dialog").hasAttribute("aria-disabled")).toBe(false);
    expect(nomes()).toEqual(["Perto", "Longe"]);
  });

  it("o toast some sozinho, sem mexer no foco, e tocar nele tenta de novo", async () => {
    await homeSemPosicao();
    vi.useFakeTimers();
    chip("menu").focus();

    fireEvent.click(chip("dialog"));
    await responder(pedidos[1], "negada");
    expect(aviso()?.textContent).toBe(AVISO);

    fireEvent.click(screen.getByText(AVISO));
    expect(getCurrentPosition).toHaveBeenCalledTimes(3);
    await responder(pedidos[2], "negada");
    expect(document.activeElement).toBe(chip("menu"));

    await act(() => vi.advanceTimersByTimeAsync(4_500));
    expect(aviso()).toBeUndefined();
    expect(document.activeElement).toBe(chip("menu"));
  });

  it("no sheet de filtros, as linhas de raio ficam apagadas, tentam de novo e o toast aparece dentro do sheet", async () => {
    await homeSemPosicao();
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const sheet = screen.getByRole("dialog");
    const secao = within(sheet).getByRole("group", { name: "Distância" });
    const radios = within(secao).getAllByRole("radio");
    expect(radios.map((el) => el.getAttribute("aria-disabled"))).toEqual(["true", "true", "true", "true"]);

    await userEvent.click(within(secao).getByRole("radio", { name: "Até 1 km" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    await responder(pedidos[1], "negada");

    expect(within(sheet).getByRole("status").textContent).toBe(AVISO);
    expect(within(secao).getByRole("radio", { name: "Até 1 km" }).getAttribute("aria-checked")).toBe("false");
  });

  it("no sheet de filtros, a posição que chega habilita as linhas sem marcar nenhum raio", async () => {
    await homeSemPosicao();
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const secao = within(screen.getByRole("dialog")).getByRole("group", { name: "Distância" });

    await userEvent.click(within(secao).getByRole("radio", { name: "Até 1 km" }));
    await responder(pedidos[1], "posicao");

    const radio = (nome: string) => within(secao).getByRole("radio", { name: nome });
    expect(radio("Até 1 km").hasAttribute("aria-disabled")).toBe(false);
    expect(radio("Até 1 km").getAttribute("aria-checked")).toBe("false");
    expect(radio("Qualquer distância").getAttribute("aria-checked")).toBe("true");
  });
});
