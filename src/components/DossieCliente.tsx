import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import BotaoMicrofone from "./BotaoMicrofone";
import { useDitadoVoz } from "@/hooks/useDitadoVoz";
import { useAuth } from "@/contexts/AuthContext";
import { ClienteDetalhe, errMsgCliente } from "@/lib/clienteDetalheService";
import {
  VisitaObservacao,
  dataBR,
  fetchContextoCliente,
  fetchVisitasComObservacao,
  gerarDossieIA,
  montarPromptDossie,
  resumirCliente,
  salvarContextoCliente,
} from "@/lib/dossieService";

interface Props {
  codCliente: number;
  nomeCliente: string;
  detalhe: ClienteDetalhe | null;
  carregandoDetalhe: boolean;
}

const DossieCliente: React.FC<Props> = ({ codCliente, nomeCliente, detalhe, carregandoDetalhe }) => {
  const { user, vendorName } = useAuth();
  const usuario = vendorName || user?.email || null;

  const [notas, setNotas] = useState("");
  const [igPessoal, setIgPessoal] = useState("");
  const [igProfissional, setIgProfissional] = useState("");
  const [atualizadoPor, setAtualizadoPor] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

  const [visitasComObs, setVisitasComObs] = useState<VisitaObservacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [dossieGerado, setDossieGerado] = useState("");
  const [gerandoDossie, setGerandoDossie] = useState(false);

  const ditado = useDitadoVoz({ valor: notas, onChange: setNotas, onErro: msg => toast.error(msg) });

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setDossieGerado("");

    Promise.all([
      fetchContextoCliente(codCliente).catch(() => null),
      fetchVisitasComObservacao(codCliente).catch(() => [] as VisitaObservacao[]),
    ])
      .then(([ctx, visitas]) => {
        if (cancelado) return;
        setNotas(ctx?.notas || "");
        setIgPessoal(ctx?.instagram_pessoal || "");
        setIgProfissional(ctx?.instagram_profissional || "");
        setAtualizadoPor(ctx?.atualizado_por || null);
        setAtualizadoEm(ctx?.atualizado_em || null);
        setVisitasComObs(visitas);
      })
      .finally(() => { if (!cancelado) setCarregando(false); });

    return () => { cancelado = true; };
  }, [codCliente]);

  const salvarContexto = async () => {
    setSalvando(true);
    try {
      await salvarContextoCliente({
        codCliente,
        notas,
        instagramPessoal: igPessoal,
        instagramProfissional: igProfissional,
        usuario,
      });
      setAtualizadoPor(usuario);
      setAtualizadoEm(new Date().toISOString());
      toast.success("Contexto salvo");
    } catch (e) {
      toast.error(`Erro ao salvar contexto: ${errMsgCliente(e)}`);
    } finally {
      setSalvando(false);
    }
  };

  const gerarDossie = async () => {
    if (!detalhe) {
      toast.error("Dados do cliente ainda não carregaram");
      return;
    }
    setGerandoDossie(true);
    try {
      const prompt = montarPromptDossie({
        detalhe,
        resumo: resumirCliente(detalhe),
        nomeCliente,
        notas,
        visitas: visitasComObs,
      });
      setDossieGerado(await gerarDossieIA(prompt));
    } catch (e) {
      console.error("Erro ao gerar dossiê:", e);
      toast.error(`Erro ao gerar dossiê: ${errMsgCliente(e)}`);
    } finally {
      setGerandoDossie(false);
    }
  };

  const copiarDossie = async () => {
    try {
      await navigator.clipboard.writeText(dossieGerado);
      toast.success("Dossiê copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin mr-2" size={16} />
        <span className="text-sm text-muted-foreground">Carregando dossiê...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ============ CONTEXTO (editável) ============ */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#621244]">📝 Contexto do Cliente</h3>

        <div>
          <label className="text-xs text-muted-foreground" htmlFor="dossie-notas">Notas sobre o cliente:</label>
          <div className="flex items-start gap-2 mt-1">
            <textarea
              id="dossie-notas"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Ex: Prefere atendimento à tarde, salão grande com 4 cadeiras, gosta de lançamentos..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-card"
            />
            {ditado.suportado && <BotaoMicrofone gravando={ditado.gravando} onClick={ditado.alternar} />}
          </div>
          {ditado.gravando && <p className="text-[11px] text-red-600 mt-1">🔴 Gravando... fale e clique de novo para parar.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="dossie-ig-pessoal">Instagram pessoal:</label>
            <input
              id="dossie-ig-pessoal"
              value={igPessoal}
              onChange={e => setIgPessoal(e.target.value)}
              placeholder="@maria_silva"
              className="w-full border rounded px-3 py-2 text-sm mt-1 bg-card"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="dossie-ig-profissional">Instagram profissional:</label>
            <input
              id="dossie-ig-profissional"
              value={igProfissional}
              onChange={e => setIgProfissional(e.target.value)}
              placeholder="@salao_maria"
              className="w-full border rounded px-3 py-2 text-sm mt-1 bg-card"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="outline" onClick={salvarContexto} disabled={salvando}>
            {salvando ? <><Loader2 className="animate-spin mr-2" size={14} /> Salvando...</> : "💾 Salvar contexto"}
          </Button>
          {atualizadoEm && (
            <span className="text-[11px] text-muted-foreground">
              Atualizado em {dataBR(atualizadoEm)}{atualizadoPor ? ` por ${atualizadoPor}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* ============ NOTAS DE VISITA (readonly) ============ */}
      {visitasComObs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold text-muted-foreground mb-2">📋 Notas de visitas recentes:</h4>
          {visitasComObs.map(v => (
            <div key={v.id} className="flex gap-2 mb-2 text-xs">
              <span className="text-muted-foreground shrink-0">{dataBR(v.data_visita)}</span>
              <span className="text-foreground/80">{v.observacao}</span>
            </div>
          ))}
        </div>
      )}

      {/* ============ GERAÇÃO ============ */}
      <div className="border-t pt-4 mt-4">
        <Button
          onClick={gerarDossie}
          disabled={gerandoDossie || carregandoDetalhe || !detalhe}
          className="w-full h-12 bg-[#621244] hover:bg-[#4a0d33] text-white font-bold rounded-xl"
        >
          {gerandoDossie ? (
            <><Loader2 className="animate-spin mr-2" size={16} /> Gerando dossiê...</>
          ) : (
            <>🧠 Gerar Dossiê de Vendas</>
          )}
        </Button>
        {carregandoDetalhe && (
          <p className="text-[11px] text-muted-foreground mt-2 text-center">Aguardando os dados do cliente carregarem…</p>
        )}
      </div>

      {/* ============ DOSSIÊ GERADO ============ */}
      {dossieGerado && (
        <div className="mt-4 bg-[#f7f2f6] rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[#621244]">🧠 Dossiê de Vendas</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copiarDossie}>📋 Copiar</Button>
              <Button size="sm" variant="outline" onClick={gerarDossie} disabled={gerandoDossie}>🔄 Regenerar</Button>
            </div>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{dossieGerado}</div>
        </div>
      )}
    </div>
  );
};

export default DossieCliente;
