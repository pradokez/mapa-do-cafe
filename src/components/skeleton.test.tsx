// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CafeDetailSkeleton } from "./cafe-detail-skeleton";
import { HomeSkeleton } from "./home-skeleton";

afterEach(cleanup);

describe("HomeSkeleton", () => {
  it("anuncia o carregamento para leitor de tela", () => {
    render(<HomeSkeleton />);
    expect(screen.getByRole("status").textContent).toBe("Carregando cafés…");
  });

  it("não oferece nada para clicar além do logo: busca e filtros só chegam com os dados", () => {
    render(<HomeSkeleton />);
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/"]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("os blocos ficam fora da árvore de acessibilidade", () => {
    const { container } = render(<HomeSkeleton />);
    const blocos = Array.from(container.querySelectorAll("[data-skeleton]"));
    expect(blocos.length).toBeGreaterThan(0);
    for (const bloco of blocos) expect(bloco.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("CafeDetailSkeleton", () => {
  it("anuncia o carregamento para leitor de tela", () => {
    render(<CafeDetailSkeleton />);
    expect(screen.getByRole("status").textContent).toBe("Carregando café…");
  });

  it("'Voltar ao mapa' funciona antes de o café chegar", () => {
    render(<CafeDetailSkeleton />);
    const voltar = screen.getByRole("link", { name: "Voltar ao mapa" });
    expect(voltar.getAttribute("href")).toBe("/");
    expect(voltar.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("os blocos ficam fora da árvore de acessibilidade", () => {
    const { container } = render(<CafeDetailSkeleton />);
    const blocos = Array.from(container.querySelectorAll("[data-skeleton]"));
    expect(blocos.length).toBeGreaterThan(0);
    for (const bloco of blocos) expect(bloco.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
