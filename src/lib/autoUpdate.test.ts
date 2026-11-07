import { describe, expect, it } from "vitest";
import { extrairVersao, INTERVALO_VERIFICACAO_MS, momentoSeguro, precisaVerificar } from "./autoUpdate";

describe("extrairVersao", () => {
  it("pega o nome do bundle no HTML publicado", () => {
    const html = '<script type="module" crossorigin src="/assets/index-DVP9_8n1.js"></script>';
    expect(extrairVersao(html)).toBe("index-DVP9_8n1.js");
  });
  it("pega o nome a partir da URL absoluta do script", () => {
    expect(extrairVersao("https://agc.muranoprofessional.com.br/assets/index-AbC-12.js")).toBe("index-AbC-12.js");
  });
  it("devolve null sem bundle", () => {
    expect(extrairVersao("<html></html>")).toBeNull();
  });
});

describe("precisaVerificar", () => {
  const agora = 1_800_000_000_000;
  it("verifica na primeira vez", () => expect(precisaVerificar(null, agora)).toBe(true));
  it("não verifica antes de um dia", () => expect(precisaVerificar(agora - 1000, agora)).toBe(false));
  it("verifica depois de um dia", () => expect(precisaVerificar(agora - INTERVALO_VERIFICACAO_MS, agora)).toBe(true));
});

describe("momentoSeguro", () => {
  const agora = 1_800_000_000_000;
  const ocioso = agora - 10 * 60 * 1000;
  it("recarrega parado, sem digitar e sem modal", () =>
    expect(momentoSeguro({ agora, ultimaInteracao: ocioso, digitando: false, modalAberto: false })).toBe(true));
  it("não recarrega com modal aberto", () =>
    expect(momentoSeguro({ agora, ultimaInteracao: ocioso, digitando: false, modalAberto: true })).toBe(false));
  it("não recarrega digitando", () =>
    expect(momentoSeguro({ agora, ultimaInteracao: ocioso, digitando: true, modalAberto: false })).toBe(false));
  it("não recarrega com uso recente", () =>
    expect(momentoSeguro({ agora, ultimaInteracao: agora - 1000, digitando: false, modalAberto: false })).toBe(false));
});
