// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { DadosCafeForm } from "./dados-cafe-form";

afterEach(() => {
  cleanup();
  push.mockClear();
});

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

describe("DadosCafeForm — café novo", () => {
  function renderizarNovo(cadastrar = vi.fn()) {
    render(<DadosCafeForm cadastrar={cadastrar} buscarCoordenadas={vi.fn()} />);
    return cadastrar;
  }

  const cadastrarBotao = () => screen.getByRole("button", { name: "Cadastrar café" });

  /** O mínimo para passar na validação: todo dia fechado. */
  async function preencher() {
    await userEvent.type(screen.getByLabelText("Nome"), "Café da Praça");
    await userEvent.type(screen.getByLabelText("Bairro"), "Poço da Panela");
    await userEvent.type(screen.getByLabelText("Endereço"), "R. da Praça, 10");
    await userEvent.type(screen.getByLabelText("Latitude"), "-8,03");
    await userEvent.type(screen.getByLabelText("Longitude"), "-34,92");
    await userEvent.click(screen.getByLabelText(/Moderado/));
    await userEvent.click(within(screen.getByRole("group", { name: "Segunda" })).getByLabelText("Fechado"));
    await userEvent.click(screen.getByRole("button", { name: "Repetir nos dias seguintes" }));
  }

  it("o slug segue o nome até ser editado; apagado, volta a seguir", async () => {
    renderizarNovo();
    await userEvent.type(screen.getByLabelText("Nome"), "Café São Brás");
    expect(valor("Endereço no site")).toBe("cafe-sao-bras");

    await userEvent.clear(screen.getByLabelText("Endereço no site"));
    await userEvent.type(screen.getByLabelText("Endereço no site"), "sao-bras");
    await userEvent.type(screen.getByLabelText("Nome"), " Torrefação");
    expect(valor("Endereço no site")).toBe("sao-bras");

    await userEvent.clear(screen.getByLabelText("Endereço no site"));
    await userEvent.type(screen.getByLabelText("Nome"), "!");
    expect(valor("Endereço no site")).toBe("cafe-sao-bras-torrefacao");
  });

  it("o slug digitado vira kebab-case ao sair do campo", async () => {
    renderizarNovo();
    await userEvent.type(screen.getByLabelText("Endereço no site"), "Café  do Açude");
    await userEvent.tab();
    expect(valor("Endereço no site")).toBe("cafe-do-acude");
  });

  it("formulário em branco não chama o servidor: cada campo obrigatório é marcado", async () => {
    const cadastrar = renderizarNovo();
    await userEvent.click(cadastrarBotao());

    expect(cadastrar).not.toHaveBeenCalled();
    for (const rotulo of ["Nome", "Endereço no site", "Bairro", "Endereço", "Latitude"]) {
      expect(screen.getByLabelText(rotulo).getAttribute("aria-invalid"), rotulo).toBe("true");
    }
    expect(screen.getByText("Escolha a faixa de preço.")).toBeTruthy();
  });

  it("slug repetido, recusado pelo servidor, aparece no campo do slug", async () => {
    const erro = "Já existe um café em /cafes/cafe-da-praca. Escolha outro endereço.";
    renderizarNovo(vi.fn().mockResolvedValue({ ok: false, erro: null, erros: { slug: erro } }));
    await preencher();
    await userEvent.click(cadastrarBotao());

    const slug = screen.getByLabelText("Endereço no site");
    expect(slug.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(`erro-${slug.id}`)?.textContent).toBe(erro);
    expect(push).not.toHaveBeenCalled();
  });

  it("cadastrado, leva à página do café para subir as fotos", async () => {
    const cadastrar = renderizarNovo(vi.fn().mockResolvedValue({ ok: true, id: "c0ffee" }));
    await preencher();
    await userEvent.click(cadastrarBotao());

    expect(cadastrar.mock.calls[0][0]).toMatchObject({ slug: "cafe-da-praca", bairro: "Poço da Panela", faixa_preco: "$$" });
    expect(push).toHaveBeenCalledWith("/admin/cafes/c0ffee?novo=1");
  });
});
