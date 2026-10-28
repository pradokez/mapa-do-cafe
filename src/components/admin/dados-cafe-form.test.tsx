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
const cadastrarBotao = () => screen.getByRole("button", { name: "Cadastrar café" });

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
    expect(payload.slug).toBe("borsoi");
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

  it("sem revisão, o cadastro não manda id de revisão", async () => {
    const cadastrar = renderizarNovo(vi.fn().mockResolvedValue({ ok: true, id: "c0ffee" }));
    await preencher();
    await userEvent.click(cadastrarBotao());

    expect(cadastrar.mock.calls[0][1]).toBeUndefined();
  });
});

describe("DadosCafeForm — café novo de uma revisão (#187)", () => {
  const REVISAO = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
  const campos = {
    nome: "Café da Ladeira",
    bairro: "Carmo",
    endereco: "R. do Amparo, 20",
    cidade: "Olinda" as const,
    instagram: "https://instagram.com/ladeira",
    telefone: "(81) 99908-4986",
    aceita_pets: true,
    horario_funcionamento: { segunda: "08:00 – 12:00, 14:00 – 18:00", domingo: "Fechado" },
  };

  function renderizarDaRevisao(cadastrar = vi.fn().mockResolvedValue({ ok: true, id: "c0ffee" })) {
    render(<DadosCafeForm cadastrar={cadastrar} revisao={{ id: REVISAO, campos }} buscarCoordenadas={vi.fn()} />);
    return cadastrar;
  }

  it("abre preenchido com a proposta; slug sai do nome, coordenadas e faixa ficam em branco", () => {
    renderizarDaRevisao();

    expect(valor("Nome")).toBe("Café da Ladeira");
    expect(valor("Bairro")).toBe("Carmo");
    expect(valor("Endereço")).toBe("R. do Amparo, 20");
    expect(valor("Instagram (opcional)")).toBe("https://instagram.com/ladeira");
    expect(valor("Telefone (opcional)")).toBe("(81) 99908-4986");
    expect(valor("Cidade")).toBe("Olinda");
    expect((screen.getByLabelText(/Aceita pets/) as HTMLInputElement).checked).toBe(true);
    expect(valor("Endereço no site")).toBe("cafe-da-ladeira");
    expect([valor("Latitude"), valor("Longitude")]).toEqual(["", ""]);

    const segunda = within(screen.getByRole("group", { name: "Segunda" }));
    expect(segunda.getAllByDisplayValue(/^\d{2}:\d{2}$/).map((e) => (e as HTMLInputElement).value)).toEqual([
      "08:00",
      "12:00",
      "14:00",
      "18:00",
    ]);
    expect((within(screen.getByRole("group", { name: "Domingo" })).getByLabelText("Fechado") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("cadastrar manda o id da revisão junto", async () => {
    const cadastrar = renderizarDaRevisao();
    await userEvent.type(screen.getByLabelText("Latitude"), "-8,01");
    await userEvent.type(screen.getByLabelText("Longitude"), "-34,85");
    await userEvent.click(screen.getByLabelText(/Moderado/));
    for (const dia of ["Terça", "Quarta", "Quinta", "Sexta", "Sábado"]) {
      await userEvent.click(within(screen.getByRole("group", { name: dia })).getByLabelText("Fechado"));
    }
    await userEvent.click(cadastrarBotao());

    expect(cadastrar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Café da Ladeira", cidade: "Olinda" }), REVISAO);
    expect(push).toHaveBeenCalledWith("/admin/cafes/c0ffee?novo=1");
  });
});

const CAFE = cafe("0b4a1f6e-2f61-4d7c-9a31-0c8f3f1f0a11", { slug: "cafe-antigo", nome: "Café Antigo" });

function editar({ ativo = true } = {}) {
  const salvar = vi.fn(async (campos: unknown) => ({
    ok: true as const,
    cafe: { ...CAFE, ...(campos as object) },
  }));
  render(<DadosCafeForm cafe={CAFE} ativo={ativo} salvar={salvar} buscarCoordenadas={vi.fn()} />);
  return { salvar, endereco: () => screen.getByLabelText<HTMLInputElement>("Endereço no site") };
}

describe("DadosCafeForm — endereço na edição (#155)", () => {
  it("mudar o nome sugere o endereço novo sem trocar sozinho; “Usar” troca", async () => {
    const { endereco } = editar();
    expect(endereco().value).toBe("cafe-antigo");
    expect(screen.queryByRole("button", { name: /^Usar/ })).toBeNull();

    const nome = screen.getByLabelText("Nome");
    await userEvent.clear(nome);
    await userEvent.type(nome, "Café Novo");

    expect(endereco().value).toBe("cafe-antigo");
    expect(screen.getByText("/cafes/cafe-novo")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Usar/ }));
    expect(endereco().value).toBe("cafe-novo");
    expect(screen.queryByRole("button", { name: /^Usar/ })).toBeNull();
  });

  async function trocarEndereco(endereco: () => HTMLInputElement, novo: string) {
    await userEvent.clear(endereco());
    await userEvent.type(endereco(), novo);
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
  }

  it("no ar, pede confirmação com o antigo e o novo; Cancelar não grava", async () => {
    const { salvar, endereco } = editar();
    await trocarEndereco(endereco, "cafe-novo");

    const dialogo = screen.getByRole("dialog", { name: "Mudar o endereço de Café Antigo?" });
    expect(dialogo.textContent).toContain("/cafes/cafe-antigo");
    expect(dialogo.textContent).toContain("/cafes/cafe-novo");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(salvar).not.toHaveBeenCalled();
  });

  it("no ar, confirmar grava com o endereço novo", async () => {
    const { salvar, endereco } = editar();
    await trocarEndereco(endereco, "cafe-novo");

    await userEvent.click(screen.getByRole("button", { name: "Mudar e salvar" }));

    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ slug: "cafe-novo" }));
    expect(await screen.findByText("Salvo. Já está no site.")).toBeTruthy();
    expect(endereco().value).toBe("cafe-novo");
  });

  it("fora do ar, salva sem confirmação (não há link funcionando para quebrar)", async () => {
    const { salvar, endereco } = editar({ ativo: false });
    await trocarEndereco(endereco, "cafe-novo");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ slug: "cafe-novo" }));
  });

  it("sem trocar o endereço, salva sem confirmação", async () => {
    const { salvar } = editar();
    await userEvent.type(screen.getByLabelText("Endereço"), " 2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ slug: "cafe-antigo" }));
  });
});
