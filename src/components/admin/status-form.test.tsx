// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ definirStatus: vi.fn() }));
vi.mock("@/lib/admin/status-actions", () => actions);

import { StatusForm } from "./status-form";

const CAFE = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StatusForm", () => {
  it("tirar do ar pede confirmação explicando que nada é apagado, antes de gravar", async () => {
    render(<StatusForm cafeId={CAFE} nome="Castigliani" ativo />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar do ar" }));

    const modal = screen.getByRole("dialog", { name: "Tirar Castigliani do ar?" });
    expect(modal.textContent).toMatch(/sai do mapa/);
    expect(modal.textContent).toMatch(/nada é apagado/i);
    expect(actions.definirStatus).not.toHaveBeenCalled();
  });

  it("cancelar fecha a confirmação sem gravar nada", async () => {
    render(<StatusForm cafeId={CAFE} nome="Castigliani" ativo />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar do ar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actions.definirStatus).not.toHaveBeenCalled();
  });

  it("confirmar tira o café do ar e avisa", async () => {
    actions.definirStatus.mockResolvedValue({ ok: true });
    render(<StatusForm cafeId={CAFE} nome="Castigliani" ativo />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar do ar" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tirar do ar" }));

    expect(actions.definirStatus).toHaveBeenCalledWith(CAFE, false);
    expect((await screen.findByRole("status")).textContent).toBe("Pronto: o café saiu do mapa.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("café fora do ar volta ao ar, também com confirmação", async () => {
    actions.definirStatus.mockResolvedValue({ ok: true });
    render(<StatusForm cafeId={CAFE} nome="Castigliani" ativo={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Colocar no ar" }));
    const modal = screen.getByRole("dialog", { name: "Colocar Castigliani no ar?" });
    expect(modal.textContent).toMatch(/dados e as fotos de antes/);
    expect(actions.definirStatus).not.toHaveBeenCalled();

    await userEvent.click(within(modal).getByRole("button", { name: "Colocar no ar" }));

    expect(actions.definirStatus).toHaveBeenCalledWith(CAFE, true);
    expect((await screen.findByRole("status")).textContent).toBe("Pronto: o café voltou ao mapa.");
  });

  it("se não deu para gravar, o erro aparece na confirmação, que continua aberta", async () => {
    actions.definirStatus.mockResolvedValue({ ok: false, erro: "Não deu para mudar o status agora." });
    render(<StatusForm cafeId={CAFE} nome="Castigliani" ativo />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar do ar" }));
    const modal = screen.getByRole("dialog");
    await userEvent.click(within(modal).getByRole("button", { name: "Tirar do ar" }));

    expect((await within(modal).findByRole("alert")).textContent).toBe("Não deu para mudar o status agora.");
    expect(screen.getByRole("dialog")).toBe(modal);
  });

  it("enquanto grava, não dá para confirmar de novo nem cancelar", async () => {
    let terminar: (r: { ok: true }) => void = () => {};
    actions.definirStatus.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    render(<StatusForm cafeId={CAFE} nome="Castigliani" ativo />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar do ar" }));
    const modal = screen.getByRole("dialog");
    await userEvent.click(within(modal).getByRole("button", { name: "Tirar do ar" }));

    const salvando = within(modal).getByRole("button", { name: "Salvando…" });
    expect(salvando.hasAttribute("disabled")).toBe(true);
    expect(within(modal).getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")).toBe(true);
    await userEvent.click(salvando);
    expect(actions.definirStatus).toHaveBeenCalledTimes(1);

    terminar({ ok: true });
    expect((await screen.findByRole("status")).textContent).toBe("Pronto: o café saiu do mapa.");
  });

  it("se o servidor nem responde, avisa na confirmação e deixa tentar de novo", async () => {
    actions.definirStatus.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<StatusForm cafeId={CAFE} nome="Castigliani" ativo />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar do ar" }));
    const modal = screen.getByRole("dialog");
    await userEvent.click(within(modal).getByRole("button", { name: "Tirar do ar" }));

    expect((await within(modal).findByRole("alert")).textContent).toMatch(/conexão/);
    expect(within(modal).getByRole("button", { name: "Tirar do ar" }).hasAttribute("disabled")).toBe(false);
  });
});
