// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BarraDeProgresso } from "./barra-de-progresso";

// A rota que o Next diria: o teste a troca para simular a página nova chegando.
const rota = { pathname: "/", search: "" };
vi.mock("next/navigation", () => ({
  usePathname: () => rota.pathname,
  useSearchParams: () => new URLSearchParams(rota.search),
}));

function montar() {
  const tela = render(
    <>
      <BarraDeProgresso />
      <a href="/cafes/borsoi-cafe-riomar">Borsoi</a>
      <a href="/festivais/eu-amo-cafe/2026">
        <span>Combos</span>
      </a>
      <a href="https://instagram.com/cafe">Instagram</a>
      <a href="#mapa">Mapa</a>
    </>,
  );
  const barra = () => document.querySelector('[data-barra="navegacao"]');
  const clicar = (nome: string, opcoes: MouseEventInit = {}) => fireEvent.click(tela.getByText(nome), opcoes);
  const chegar = (pathname: string, search = "") => {
    rota.pathname = pathname;
    rota.search = search;
    tela.rerender(
      <>
        <BarraDeProgresso />
        <a href="/cafes/borsoi-cafe-riomar">Borsoi</a>
      </>,
    );
  };
  return { barra, clicar, chegar };
}

// O jsdom não navega (e avisa que não sabe): este dublê cancela o clique depois
// da captura, em bolha, como o `<Link>` do Next.
const cancelar = (e: Event) => e.preventDefault();

beforeEach(() => {
  vi.useFakeTimers();
  rota.pathname = "/";
  rota.search = "";
  document.addEventListener("click", cancelar);
});
afterEach(() => {
  cleanup();
  document.removeEventListener("click", cancelar);
  vi.useRealTimers();
});

const esperar = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("BarraDeProgresso", () => {
  it("navegação instantânea não pisca: a barra só aparece depois de 100 ms", () => {
    const { barra, clicar } = montar();
    clicar("Borsoi");
    esperar(99);
    expect(barra()).toBeNull();
    esperar(1);
    expect(barra()).not.toBeNull();
  });

  it("clique num elemento dentro do link também conta", () => {
    const { barra, clicar } = montar();
    clicar("Combos");
    esperar(100);
    expect(barra()).not.toBeNull();
  });

  it("some quando a página nova chega", () => {
    const { barra, clicar, chegar } = montar();
    clicar("Borsoi");
    esperar(300);
    act(() => chegar("/cafes/borsoi-cafe-riomar"));
    expect(barra()).toBeNull();
  });

  it("nova busca na mesma rota também conta como chegada", () => {
    const { barra, clicar, chegar } = montar();
    clicar("Borsoi");
    esperar(300);
    act(() => chegar("/", "?bairro=pina"));
    expect(barra()).toBeNull();
  });

  it("página que chega antes dos 100 ms nunca mostra a barra", () => {
    const { barra, clicar, chegar } = montar();
    clicar("Borsoi");
    esperar(50);
    act(() => chegar("/cafes/borsoi-cafe-riomar"));
    esperar(500);
    expect(barra()).toBeNull();
  });

  it("Ctrl/Cmd-clique, link externo e âncora não a acendem", () => {
    const { barra, clicar } = montar();
    clicar("Borsoi", { ctrlKey: true });
    clicar("Borsoi", { metaKey: true });
    clicar("Instagram");
    clicar("Mapa");
    esperar(1000);
    expect(barra()).toBeNull();
  });

  it("navegação que nunca chega (cancelada) apaga sozinha aos 20 s", () => {
    const { barra, clicar } = montar();
    clicar("Borsoi");
    esperar(19_999);
    expect(barra()).not.toBeNull();
    esperar(1);
    expect(barra()).toBeNull();
  });

  it("fica fora da árvore de acessibilidade: quem anuncia é o status do skeleton", () => {
    const { barra, clicar } = montar();
    clicar("Borsoi");
    esperar(100);
    expect(barra()?.getAttribute("aria-hidden")).toBe("true");
  });
});
