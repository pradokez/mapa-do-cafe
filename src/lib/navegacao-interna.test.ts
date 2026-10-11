import { describe, expect, it } from "vitest";

import { navegacaoInterna, type CliqueNoLink, type Link } from "./navegacao-interna";

const ATUAL = "https://mapadocafe-pe.com.br/?bairro=gracas#lista";

const clique = (mudar: Partial<CliqueNoLink> = {}): CliqueNoLink => ({
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  ...mudar,
});

const link = (href: string, mudar: Partial<Link> = {}): Link => ({ href, target: "", download: false, ...mudar });

const interno = link("https://mapadocafe-pe.com.br/cafes/borsoi-cafe-riomar");

describe("navegacaoInterna", () => {
  it("clique simples num link do site é navegação", () => {
    expect(navegacaoInterna(clique(), interno, ATUAL)).toBe(true);
  });

  it("mesma rota com outra busca também é: a página vai mudar", () => {
    expect(navegacaoInterna(clique(), link("https://mapadocafe-pe.com.br/?bairro=pina"), ATUAL)).toBe(true);
    expect(navegacaoInterna(clique(), link("https://mapadocafe-pe.com.br/"), ATUAL)).toBe(true);
  });

  it("target _self conta como a própria aba", () => {
    expect(navegacaoInterna(clique(), { ...interno, target: "_self" }, ATUAL)).toBe(true);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"] as const)(
    "com %s o navegador abre noutro lugar (ou baixa): a página atual fica",
    (tecla) => {
      expect(navegacaoInterna(clique({ [tecla]: true }), interno, ATUAL)).toBe(false);
    },
  );

  it("botão do meio não navega a aba atual", () => {
    expect(navegacaoInterna(clique({ button: 1 }), interno, ATUAL)).toBe(false);
  });

  it("clique já cancelado por outro código não navega", () => {
    expect(navegacaoInterna(clique({ defaultPrevented: true }), interno, ATUAL)).toBe(false);
  });

  it("target diferente de _self abre noutra aba", () => {
    expect(navegacaoInterna(clique(), { ...interno, target: "_blank" }, ATUAL)).toBe(false);
  });

  it("link de download não troca a página", () => {
    expect(navegacaoInterna(clique(), { ...interno, download: true }, ATUAL)).toBe(false);
  });

  it("outra origem sai do site", () => {
    expect(navegacaoInterna(clique(), link("https://instagram.com/cafe"), ATUAL)).toBe(false);
    expect(navegacaoInterna(clique(), link("http://mapadocafe-pe.com.br/cafes/x"), ATUAL)).toBe(false);
  });

  it("mailto: e tel: não são páginas", () => {
    expect(navegacaoInterna(clique(), link("mailto:contatomapadocafe@gmail.com"), ATUAL)).toBe(false);
    expect(navegacaoInterna(clique(), link("tel:+5581999084986"), ATUAL)).toBe(false);
  });

  it("link só de âncora não carrega nada", () => {
    expect(navegacaoInterna(clique(), link("https://mapadocafe-pe.com.br/?bairro=gracas#mapa"), ATUAL)).toBe(false);
  });

  it("a mesma URL, com ou sem hash, não carrega nada", () => {
    expect(navegacaoInterna(clique(), link(ATUAL), ATUAL)).toBe(false);
    expect(navegacaoInterna(clique(), link("https://mapadocafe-pe.com.br/?bairro=gracas"), ATUAL)).toBe(false);
  });

  it("href inválido é ignorado em silêncio", () => {
    expect(navegacaoInterna(clique(), link("http://[::1"), ATUAL)).toBe(false);
  });
});
