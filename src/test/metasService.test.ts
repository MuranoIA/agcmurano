import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarClienteFake } from "./helpers/supabaseFake";

const fake = vi.hoisted(() => ({ atual: null as any }));
vi.mock("@/integrations/supabase/externalClient", () => ({
  externalSupabase: {
    from: (...a: unknown[]) => fake.atual.from(...a),
    rpc: (...a: unknown[]) => fake.atual.rpc(...a),
  },
}));

import { calcularTendencia, gerarDiasMes, parseDiaLocal, toDiaISO, toMesRef } from "@/lib/metasService";

/** Metas e dias úteis. Ver REGRAS.md, seção "Metas e tendência". */

describe("datas de metas", () => {
  it("parseDiaLocal lê o dia sem trocar de dia por fuso", () => {
    const d = parseDiaLocal("2026-08-11");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 11]);
  });
  it("toDiaISO e toMesRef usam o calendário local", () => {
    expect(toDiaISO(new Date(2026, 7, 1))).toBe("2026-08-01");
    expect(toMesRef(new Date(2026, 7, 31))).toBe("2026-08");
  });
});

describe("calcularTendencia", () => {
  it("projeta o ritmo atual para o mês inteiro", () => {
    // R$ 10.000 em 5 dias úteis, mês com 25 → R$ 50.000
    expect(calcularTendencia(10000, 5, 25)).toBe(50000);
  });
  it("sem dia útil corrido a tendência é zero (evita divisão por zero)", () => {
    expect(calcularTendencia(10000, 0, 25)).toBe(0);
  });
});

describe("gerarDiasMes", () => {
  beforeEach(() => {
    fake.atual = criarClienteFake();
  });

  const linhas = async (mesRef: string) => {
    await gerarDiasMes(mesRef);
    const chamada = fake.atual.daTabela("dias_uteis_agc")[0];
    return { chamada, rows: fake.atual.arg(chamada, "upsert")![0] as any[], opts: fake.atual.arg(chamada, "upsert")![1] };
  };

  it("cria uma linha por dia do mês, com upsert pela coluna dia", async () => {
    const { rows, opts } = await linhas("2026-11");
    expect(rows).toHaveLength(30);
    expect(opts).toEqual({ onConflict: "dia" });
  });

  it("segunda a sábado são úteis; domingo não", async () => {
    const { rows } = await linhas("2026-11");
    const dom = rows.find(r => r.dia === "2026-11-01");
    expect(dom).toMatchObject({ dia_util: false, motivo: "Domingo" });
    const seg = rows.find(r => r.dia === "2026-11-02");
    expect(seg).toMatchObject({ dia_util: true, motivo: null });
    const sab = rows.find(r => r.dia === "2026-11-07");
    expect(sab.dia_util).toBe(true);
    expect(rows.filter(r => !r.dia_util)).toHaveLength(5); // 1, 8, 15, 22 e 29
  });

  it("respeita o tamanho do mês (fevereiro de ano bissexto)", async () => {
    const { rows } = await linhas("2028-02");
    expect(rows).toHaveLength(29);
  });

  it("propaga erro do banco", async () => {
    fake.atual = criarClienteFake({ from: () => ({ error: new Error("sem permissão") }) });
    await expect(gerarDiasMes("2026-11")).rejects.toThrow("sem permissão");
  });
});
