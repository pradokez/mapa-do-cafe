// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusCafe, VerNoSite } from "./status-cafe";

afterEach(cleanup);

describe("StatusCafe", () => {
  it("sinaliza café ativo e inativo", () => {
    render(
      <>
        <StatusCafe ativo />
        <StatusCafe ativo={false} />
      </>,
    );

    expect(screen.getByText("No ar")).toBeTruthy();
    expect(screen.getByText("Fora do ar")).toBeTruthy();
  });
});

describe("VerNoSite", () => {
  it("café ativo leva à página pública numa nova aba, sem opener nem referrer", () => {
    render(<VerNoSite slug="81-coffee-co" ativo />);

    const link = screen.getByRole("link", { name: /ver no site.*nova aba/i });
    expect(link.getAttribute("href")).toBe("/cafes/81-coffee-co");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("café inativo não tem link (a página pública dele dá 404)", () => {
    render(<VerNoSite slug="castigliani" ativo={false} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("não aparece no site")).toBeTruthy();
  });
});
