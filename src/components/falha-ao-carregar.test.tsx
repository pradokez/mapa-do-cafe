// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomeError from "@/app/(home)/error";

import { FalhaAoCarregar } from "./falha-ao-carregar";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => refresh.mockClear());
afterEach(cleanup);

const CORPO_HOME = "Não conseguimos carregar os cafés agora. Confira sua conexão e tente de novo.";

describe("FalhaAoCarregar", () => {
  it("anuncia a falha e leva o foco ao título", () => {
    render(<FalhaAoCarregar corpo="Corpo" reset={() => {}} />);
    const alerta = screen.getByRole("alert");
    const titulo = screen.getByRole("heading", { name: "O café não passou" });
    expect(alerta.contains(titulo)).toBe(true);
    expect(document.activeElement).toBe(titulo);
  });

  it("\"Tentar de novo\" busca a página de novo no servidor e limpa o erro", async () => {
    const reset = vi.fn();
    render(<FalhaAoCarregar corpo="Corpo" reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("com \"Voltar ao mapa\", o link leva à home", () => {
    render(<FalhaAoCarregar corpo="Corpo" reset={() => {}} voltarAoMapa />);
    expect(screen.getByRole("link", { name: "Voltar ao mapa" }).getAttribute("href")).toBe("/");
  });
});

describe("falha da home", () => {
  it("diz que os cafés não carregaram e não oferece \"Voltar ao mapa\": já é o mapa", () => {
    render(<HomeError error={new Error("x")} reset={() => {}} />);
    expect(screen.getByRole("alert").textContent).toContain(CORPO_HOME);
    expect(screen.queryByRole("link", { name: "Voltar ao mapa" })).toBeNull();
    // Só o logo: busca e filtros não funcionariam sem os cafés.
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/"]);
  });

  it("o mapa diz que está indisponível, sem repetir o alerta", () => {
    render(<HomeError error={new Error("x")} reset={() => {}} />);
    expect(screen.getByText("Mapa indisponível").closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
