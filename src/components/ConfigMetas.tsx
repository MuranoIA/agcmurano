import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { fmtBRL } from "@/lib/format";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  DiaUtil,
  errMsgMeta,
  fetchDiasUteis,
  fetchEditoresJanela,
  fetchJanelas,
  fetchMetas,
  gerarDiasMes,
  JANELA_DIA_MAX,
  JANELA_DIA_MIN,
  JANELA_PADRAO,
  JanelaTransferencia,
  limiteDoMes,
  removerExcecaoJanela,
  salvarJanela,
  parseDiaLocal,
  toggleDiaUtil,
  toMesRef,
  upsertMeta,
} from "@/lib/metasService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: string;
  /** chamado depois de salvar, pra a Visão Geral recarregar metas/dias */
  onSaved?: () => void;
}

const DOW_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

const mesLabel = (mesRef: string): string => {
  const [ano, mes] = mesRef.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

const addMeses = (mesRef: string, delta: number): string => {
  const [ano, mes] = mesRef.split("-").map(Number);
  return toMesRef(new Date(ano, mes - 1 + delta, 1));
};

const ConfigMetas: React.FC<Props> = ({ open, onOpenChange, usuario, onSaved }) => {
  const { vendedores } = useEmpresa();
  const [mesRef, setMesRef] = useState(() => toMesRef(new Date()));
  const [dias, setDias] = useState<DiaUtil[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [janelas, setJanelas] = useState<JanelaTransferencia[]>([]);
  const [diaPadrao, setDiaPadrao] = useState("");
  const [diaExcecao, setDiaExcecao] = useState("");
  const [salvandoJanela, setSalvandoJanela] = useState(false);
  const [editoresJanela, setEditoresJanela] = useState<string[]>([]);
  // Só quem está em agc_janela_editores vê e altera a janela (o banco também confere).
  const podeEditarJanela = editoresJanela.includes(usuario.trim().toLowerCase());

  const carregar = useCallback(async (mes: string) => {
    setLoading(true);
    try {
      const [d, m, j, ed] = await Promise.all([
        fetchDiasUteis(mes),
        fetchMetas(mes),
        fetchJanelas(),
        fetchEditoresJanela(),
      ]);
      setDias(d);
      setJanelas(j);
      setEditoresJanela(ed);
      setDiaPadrao(String(j.find(x => x.mes_referencia === JANELA_PADRAO)?.dia_limite ?? JANELA_DIA_MIN));
      const exc = j.find(x => x.mes_referencia === mes);
      setDiaExcecao(exc ? String(exc.dia_limite) : "");
      const mapa: Record<string, number> = {};
      m.forEach(x => { mapa[x.vendedor] = x.meta_valor; });
      setMetas(mapa);
      setDiaSelecionado(null);
      setMotivo("");
    } catch (err) {
      toast.error("Erro ao carregar configuração: " + errMsgMeta(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) carregar(mesRef);
  }, [open, mesRef, carregar]);

  const totalUteis = useMemo(() => dias.filter(d => d.dia_util).length, [dias]);
  const totalNaoUteis = dias.length - totalUteis;

  // Espaços vazios antes do dia 1 para alinhar o calendário na coluna certa
  const offsetInicial = useMemo(() => {
    if (dias.length === 0) return 0;
    return parseDiaLocal(dias[0].dia).getDay();
  }, [dias]);

  const handleGerar = async () => {
    setGerando(true);
    try {
      await gerarDiasMes(mesRef);
      toast.success("Calendário gerado (seg–sáb úteis, domingo não útil).");
      await carregar(mesRef);
      onSaved?.();
    } catch (err) {
      toast.error("Erro ao gerar calendário: " + errMsgMeta(err));
    } finally {
      setGerando(false);
    }
  };

  const handleToggleDia = async (dia: DiaUtil) => {
    const novoUtil = !dia.dia_util;
    // Ao marcar como não útil, mantém o motivo digitado (se o dia estiver selecionado)
    const novoMotivo = novoUtil ? null : (diaSelecionado === dia.dia && motivo ? motivo : dia.motivo);
    setDias(prev => prev.map(d => (d.dia === dia.dia ? { ...d, dia_util: novoUtil, motivo: novoMotivo } : d)));
    try {
      await toggleDiaUtil(dia.dia, novoUtil, novoMotivo, usuario);
      onSaved?.();
    } catch (err) {
      toast.error("Erro ao salvar o dia: " + errMsgMeta(err));
      await carregar(mesRef);
    }
  };

  const handleSalvarMotivo = async () => {
    const dia = dias.find(d => d.dia === diaSelecionado);
    if (!dia) return;
    setDias(prev => prev.map(d => (d.dia === dia.dia ? { ...d, motivo } : d)));
    try {
      await toggleDiaUtil(dia.dia, dia.dia_util, motivo || null, usuario);
      toast.success("Motivo salvo.");
      onSaved?.();
    } catch (err) {
      toast.error("Erro ao salvar motivo: " + errMsgMeta(err));
    }
  };

  const salvarMetas = async () => {
    setSalvando(true);
    try {
      await Promise.all(
        vendedores.map(v => upsertMeta(v, mesRef, Number(metas[v]) || 0, usuario)),
      );
      toast.success("Metas salvas.");
      onSaved?.();
    } catch (err) {
      toast.error("Erro ao salvar metas: " + errMsgMeta(err));
    } finally {
      setSalvando(false);
    }
  };

  const janelaPadrao = janelas.find(j => j.mes_referencia === JANELA_PADRAO);
  const janelaExcecao = janelas.find(j => j.mes_referencia === mesRef);
  const limiteMes = limiteDoMes(janelas, mesRef);

  const diaValido = (v: string): number | null => {
    const n = Number(v);
    return Number.isInteger(n) && n >= JANELA_DIA_MIN && n <= JANELA_DIA_MAX ? n : null;
  };

  const handleSalvarJanela = async (mes: string, valor: string) => {
    const dia = diaValido(valor);
    if (dia === null) {
      toast.error(`Informe um dia entre ${JANELA_DIA_MIN} e ${JANELA_DIA_MAX}.`);
      return;
    }
    setSalvandoJanela(true);
    try {
      await salvarJanela(mes, dia, usuario);
      toast.success(mes === JANELA_PADRAO ? "Prazo padrão salvo." : `Prazo de ${mesLabel(mes)} salvo.`);
      await carregar(mesRef);
    } catch (err) {
      toast.error("Erro ao salvar a janela: " + errMsgMeta(err));
    } finally {
      setSalvandoJanela(false);
    }
  };

  const handleRemoverExcecao = async () => {
    setSalvandoJanela(true);
    try {
      await removerExcecaoJanela(mesRef, usuario);
      toast.success(`${mesLabel(mesRef)} volta a seguir o prazo padrão.`);
      await carregar(mesRef);
    } catch (err) {
      toast.error("Erro ao remover a exceção: " + errMsgMeta(err));
    } finally {
      setSalvandoJanela(false);
    }
  };

  const fmtAtualizacao = (j?: JanelaTransferencia) =>
    j ? `alterado por ${j.atualizado_por || "—"} em ${new Date(j.atualizado_em).toLocaleString("pt-BR")}` : "";

  const totalMetas = vendedores.reduce((s, v) => s + (Number(metas[v]) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚙️ Metas e dias úteis</DialogTitle>
        </DialogHeader>

        {/* Seletor de mês */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMesRef(m => addMeses(m, -1))}>←</Button>
          <span className="text-sm font-medium capitalize min-w-[150px] text-center">{mesLabel(mesRef)}</span>
          <Button variant="outline" size="sm" onClick={() => setMesRef(m => addMeses(m, 1))}>→</Button>
          <Button variant="ghost" size="sm" onClick={() => carregar(mesRef)} title="Recarregar">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={28} /></div>
        ) : (
          <div className="space-y-6">
            {/* ---------- PARTE A: CALENDÁRIO ---------- */}
            <section>
              <h4 className="text-sm font-semibold mb-2">Calendário de dias úteis</h4>

              {dias.length === 0 ? (
                <div className="border rounded-lg p-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Nenhum dia cadastrado para {mesLabel(mesRef)}.
                  </p>
                  <Button size="sm" onClick={handleGerar} disabled={gerando}>
                    {gerando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Gerar calendário
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {DOW_LABELS.map((d, i) => (
                      <div key={i} className="text-[10px] text-center text-muted-foreground font-medium">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: offsetInicial }, (_, i) => <div key={`gap-${i}`} />)}
                    {dias.map(dia => (
                      <button
                        key={dia.dia}
                        onClick={() => handleToggleDia(dia)}
                        onContextMenu={e => {
                          e.preventDefault();
                          setDiaSelecionado(dia.dia);
                          setMotivo(dia.motivo || "");
                        }}
                        className={`p-2 text-xs rounded border transition-colors ${
                          dia.dia_util
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-400 border-gray-200"
                        } ${diaSelecionado === dia.dia ? "ring-2 ring-primary" : ""}`}
                        title={dia.motivo || (dia.dia_util ? "Dia útil" : "Não útil")}
                      >
                        {parseDiaLocal(dia.dia).getDate()}
                        {dia.motivo && <span className="block text-[8px] leading-none truncate">•</span>}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    {totalUteis} dias úteis · {totalNaoUteis} não úteis ·{" "}
                    <span className="italic">clique alterna útil/não útil; botão direito edita o motivo</span>
                  </p>

                  {diaSelecionado && (
                    <div className="flex items-end gap-2 mt-3 border-t pt-3">
                      <div className="flex-1">
                        <label className="text-[11px] text-muted-foreground">
                          Motivo — {parseDiaLocal(diaSelecionado).toLocaleDateString("pt-BR")}
                        </label>
                        <Input
                          value={motivo}
                          onChange={e => setMotivo(e.target.value)}
                          placeholder="Ex.: Feriado 15 de Agosto"
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button size="sm" className="h-8" onClick={handleSalvarMotivo}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => { setDiaSelecionado(null); setMotivo(""); }}>
                        Fechar
                      </Button>
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="mt-3" onClick={handleGerar} disabled={gerando}>
                    {gerando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Regerar mês (seg–sáb)
                  </Button>
                </>
              )}
            </section>

            {/* ---------- PARTE C: JANELA DE TRANSFERÊNCIA ---------- */}
            {podeEditarJanela && (
            <section className="border-t pt-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold">Janela de transferência da carteira</h4>
                <p className="text-xs text-muted-foreground">
                  Do dia 1 até o dia limite é possível incluir, remover ou trocar clientes de vendedor no AGC.
                  Os dias 1 a {JANELA_DIA_MIN} ficam sempre abertos.
                </p>
              </div>

              <p className="text-sm">
                Em <span className="capitalize">{mesLabel(mesRef)}</span>: aberta do dia 1 ao dia{" "}
                <strong>{limiteMes}</strong>
                {janelaExcecao ? " (exceção deste mês)" : " (prazo padrão)"}.
              </p>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block">Prazo padrão (todo mês)</label>
                  <Input
                    type="number"
                    min={JANELA_DIA_MIN}
                    max={JANELA_DIA_MAX}
                    value={diaPadrao}
                    onChange={e => setDiaPadrao(e.target.value)}
                    className="w-24 h-8 text-sm"
                  />
                </div>
                <Button size="sm" className="h-8" disabled={salvandoJanela} onClick={() => handleSalvarJanela(JANELA_PADRAO, diaPadrao)}>
                  Salvar padrão
                </Button>
                <span className="text-[11px] text-muted-foreground">{fmtAtualizacao(janelaPadrao)}</span>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block capitalize">
                    Só em {mesLabel(mesRef)}
                  </label>
                  <Input
                    type="number"
                    min={JANELA_DIA_MIN}
                    max={JANELA_DIA_MAX}
                    value={diaExcecao}
                    onChange={e => setDiaExcecao(e.target.value)}
                    placeholder={String(janelaPadrao?.dia_limite ?? JANELA_DIA_MIN)}
                    className="w-24 h-8 text-sm"
                  />
                </div>
                <Button size="sm" variant="outline" className="h-8" disabled={salvandoJanela} onClick={() => handleSalvarJanela(mesRef, diaExcecao)}>
                  Salvar exceção do mês
                </Button>
                {janelaExcecao && (
                  <Button size="sm" variant="ghost" className="h-8" disabled={salvandoJanela} onClick={handleRemoverExcecao}>
                    Voltar ao padrão
                  </Button>
                )}
                <span className="text-[11px] text-muted-foreground">{fmtAtualizacao(janelaExcecao)}</span>
              </div>
            </section>
            )}

            {/* ---------- PARTE B: METAS ---------- */}
            <section className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Metas por vendedor — {mesLabel(mesRef)}</h4>
              {vendedores.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum vendedor AGC encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {vendedores.map(v => (
                    <div key={v} className="flex items-center gap-3">
                      <span className="w-32 text-sm font-medium capitalize">{v}</span>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={metas[v] ?? ""}
                        onChange={e => setMetas(prev => ({ ...prev, [v]: Number(e.target.value) }))}
                        className="w-40 h-8 text-sm"
                        placeholder="R$ Meta"
                      />
                      <span className="text-xs text-muted-foreground">
                        {metas[v] ? fmtBRL(Number(metas[v])) : "sem meta"}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      Total: <strong>{fmtBRL(totalMetas)}</strong>
                    </span>
                    <Button size="sm" onClick={salvarMetas} disabled={salvando}>
                      {salvando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                      Salvar metas
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConfigMetas;
