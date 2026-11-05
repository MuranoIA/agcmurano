import { describe, expect, it } from "vitest";
import { exportCSV, fmtCEP, fmtCpfCnpj, fmtNum, fmtTelefone, iniciais } from "@/lib/format";
import { parseMesCol } from "@/lib/parseMesCol";

describe("formatadores cadastrais", () => {
  it("CEP com 8 dígitos ganha hífen; vazio vira travessão; outro formato fica como veio", () => {
    expect(fmtCEP("66000000")).toBe("66000-000");
    expect(fmtCEP("66000-000")).toBe("66000-000");
    expect(fmtCEP(null)).toBe("—");
    expect(fmtCEP("123")).toBe("123");
  });

  it("CPF e CNPJ", () => {
    expect(fmtCpfCnpj("12345678901")).toBe("123.456.789-01");
    expect(fmtCpfCnpj("12345678000199")).toBe("12.345.678/0001-99");
    expect(fmtCpfCnpj("")).toBe("—");
    expect(fmtCpfCnpj("123")).toBe("123");
  });

  it("telefone fixo (10) e celular (11)", () => {
    expect(fmtTelefone("9132221111")).toBe("(91) 3222-1111");
    expect(fmtTelefone("91988887777")).toBe("(91) 98888-7777");
    expect(fmtTelefone(undefined)).toBe("—");
    expect(fmtTelefone("12345")).toBe("12345");
  });

  it("iniciais ignoram palavras de até 2 letras (de, da)", () => {
    expect(iniciais("Rita de Cássia Silva")).toBe("RS");
    expect(iniciais("Maria")).toBe("MA");
    expect(iniciais("")).toBe("?");
    expect(iniciais(null)).toBe("?");
    expect(iniciais("Jo")).toBe("JO");
  });

  it("fmtNum arredonda sem casas decimais", () => {
    expect(fmtNum(1234.6).replace(/\s/g, "")).toBe("1.235");
  });

  it("exportCSV separa por ponto e vírgula", () => {
    expect(exportCSV(["a", "b"], [["1", "2"], ["3", "4"]])).toBe("a;b\n1;2\n3;4");
  });
});

describe("parseMesCol", () => {
  it("lê 'Abr/26' como 01/04/2026", () => {
    const d = parseMesCol("Abr/26")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 3, 1]);
  });
  it("texto fora do padrão devolve null", () => {
    expect(parseMesCol("Abril")).toBeNull();
    expect(parseMesCol("Xxx/26")).toBeNull();
    expect(parseMesCol("Abr/xx")).toBeNull();
  });
});
