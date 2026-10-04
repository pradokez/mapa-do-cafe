// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

import { DadosCafeForm } from "./dados-cafe-form";

afterEach(cleanup);

const borsoi = cafe("borsoi", {
  nome: "Borsoi Café",
  horario_funcionamento: {
    segunda: "08:00 – 18:00",
    terca: "Fechado",
    quarta: "Fechado",
    quinta: "Fechado",
    sexta: "Fechado",
    sabado: "Fechado",
    domingo: "Fechado",
  },
});

function renderizar(salvar = vi.fn(), buscarCoordenadas = vi.fn()) {
  render(<DadosCafeForm cafe={borsoi} ativo salvar={salvar} buscarCoordenadas={buscarCoordenadas} />);
  return salvar;
}

const valor = (rotulo: string) => (screen.getByLabelText(rotulo) as HTMLInputElement).value;

const salvarBotao = () => screen.getByRole("button", { name: "Salvar alterações" });

describe("DadosCafeForm", () => {
  it("erro de validação aparece no campo, ligado por ARIA, sem perder o que foi digitado nem chamar o servidor", async () => {
    const salvar = renderizar();
    const telefone = screen.getByLabelText(/Telefone/);
    await userEvent.type(telefone, "123");
    await userEvent.clear(screen.getByLabelText("Nome"));
    await userEvent.click(salvarBotao());

    expect(salvar).not.toHaveBeenCalled();
    expect(screen.getByText("Corrija os 2 campos marcados.")).toBeTruthy();

    const nome = screen.getByLabelText("Nome");
    expect(nome.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(nome.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Informe o nome do café.",
    );
    expect(document.activeElement).toBe(nome);

    expect((telefone as HTMLInputElement).value).toBe("123");
    expect(document.getElementById(telefone.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Use DDD e número, ex.: (81) 99999-9999.",
    );
  });

  it("recusa do servidor (payload que passou no cliente) também aparece por campo", async () => {
    const salvar = renderizar(
      vi.fn().mockResolvedValue({ ok: false, erro: null, erros: { endereco: "Endereço recusado." } }),
    );
    await userEvent.click(salvarBotao());

    expect(salvar).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Endereço").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Endereço recusado.")).toBeTruthy();
  });

  it("salva os 7 dias de horário e mostra o que o banco guardou", async () => {
    const salvar = vi.fn().mockResolvedValue({ ok: true, cafe: { ...borsoi, telefone: "(81) 99908-4986" } });
    renderizar(salvar);
    await userEvent.type(screen.getByLabelText(/Telefone/), "81999084986");
    await userEvent.click(salvarBotao());

    const payload = salvar.mock.calls[0][0];
    expect(payload.horario_funcionamento).toEqual(borsoi.horario_funcionamento);
    expect(payload).not.toHaveProperty("slug");
    expect(screen.getByText("Salvo. Já está no site.")).toBeTruthy();
    expect((screen.getByLabelText(/Telefone/) as HTMLInputElement).value).toBe("(81) 99908-4986");
  });

  it("'Fechado' esconde os turnos do dia; desmarcar mostra de novo", async () => {
    renderizar();
    const segunda = screen.getByRole("group", { name: "Segunda" });
    expect(within(segunda).getByLabelText("Segunda: abre")).toBeTruthy();

    await userEvent.click(within(segunda).getByLabelText("Fechado"));
    expect(within(segunda).queryByLabelText("Segunda: abre")).toBeNull();

    const terca = screen.getByRole("group", { name: "Terça" });
    await userEvent.click(within(terca).getByLabelText("Fechado"));
    expect(within(terca).getByLabelText("Terça: abre")).toBeTruthy();
  });

  it("'Repetir nos dias seguintes' copia o horário da Segunda para a semana", async () => {
    const salvar = renderizar(vi.fn().mockResolvedValue({ ok: true, cafe: borsoi }));
    await userEvent.click(screen.getByRole("button", { name: "Repetir nos dias seguintes" }));

    expect((screen.getByLabelText("Domingo: abre") as HTMLInputElement).value).toBe("08:00");
    await userEvent.click(salvarBotao());
    expect(Object.values(salvar.mock.calls[0][0].horario_funcionamento)).toEqual(Array(7).fill("08:00 – 18:00"));
  });

  it("turno a mais ganha rótulo próprio e pode ser removido", async () => {
    renderizar();
    await userEvent.click(screen.getByRole("button", { name: "Adicionar turno na segunda" }));
    expect(screen.getByLabelText("Segunda, turno 2: abre")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Remover segunda, turno 2" }));
    expect(screen.queryByLabelText("Segunda, turno 2: abre")).toBeNull();
  });

  it("'Buscar coordenadas' preenche lat e lng com o que o servidor tirou do link", async () => {
    const buscar = vi.fn().mockResolvedValue({ ok: true, coordenadas: { lat: -8.1046346, lng: -34.8875473 } });
    renderizar(vi.fn(), buscar);
    await userEvent.type(screen.getByLabelText(/Link do Google Maps/), "https://maps.app.goo.gl/E7D9JZewVfG9fCVL7");
    await userEvent.click(screen.getByRole("button", { name: "Buscar coordenadas" }));

    expect(buscar).toHaveBeenCalledWith("https://maps.app.goo.gl/E7D9JZewVfG9fCVL7");
    expect([valor("Latitude"), valor("Longitude")]).toEqual(["-8.1046346", "-34.8875473"]);
  });

  it("link que não dá coordenadas mostra o erro no campo do link e não mexe em lat/lng", async () => {
    const erro = "Não deu para tirar as coordenadas desse link. Preencha lat e lng à mão.";
    renderizar(vi.fn(), vi.fn().mockResolvedValue({ ok: false, erro }));
    await userEvent.type(screen.getByLabelText(/Link do Google Maps/), "https://maps.app.goo.gl/x");
    await userEvent.click(screen.getByRole("button", { name: "Buscar coordenadas" }));

    const link = screen.getByLabelText(/Link do Google Maps/);
    expect(document.getElementById(link.getAttribute("aria-describedby")!)?.textContent).toBe(erro);
    expect([valor("Latitude"), valor("Longitude")]).toEqual(["-8.05", "-34.9"]);
  });

  it("colar o par do Google Maps na latitude preenche os dois campos", async () => {
    renderizar();
    await userEvent.clear(screen.getByLabelText("Latitude"));
    await userEvent.paste("-8.0631, -34.8711");

    expect([valor("Latitude"), valor("Longitude")]).toEqual(["-8.0631", "-34.8711"]);
  });
});
