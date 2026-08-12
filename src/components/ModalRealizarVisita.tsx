import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAppData } from "@/contexts/AppDataContext";
import { AgendaVisita, updateVisita, errMsg } from "@/lib/agendaService";
import {
  Coordenadas,
  LocalizacaoCliente,
  RAIO_METROS,
  calcularDistancia,
  dentroDoRaio,
  errMsgLoc,
  extrairCoordenadas,
  getLocalizacaoCliente,
  linkMaps,
  obterLocalizacao,
  registrarLocalizacao,
  solicitarMudancaLocalizacao,
} from "@/lib/localizacaoService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visita: AgendaVisita | null;
  nome: string;
  onSaved: () => void;
}

/** Etapas do modal: escolha do check-in → cadastro da localização → resultado da visita. */
type Etapa = "inicio" | "cadastro" | "resultado";

const OPCOES = [
  { value: "venda", label: "✅ Venda realizada", ativo: "border-green-500 bg-green-50 text-green-700" },
  { value: "sem_interesse", label: "😐 Sem interesse", ativo: "border-gray-500 bg-gray-50 text-gray-700" },
  { value: "ausente", label: "🚫 Cliente ausente", ativo: "border-amber-500 bg-amber-50 text-amber-700" },
  { value: "reagendar", label: "📅 Reagendar", ativo: "border-blue-500 bg-blue-50 text-blue-700" },
] as const;

const fmtMetros = (m: number) => `${m.toFixed(0)}m`;

const ModalRealizarVisita: React.FC<Props> = ({ open, onOpenChange, visita, nome, onSaved }) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { refreshLocalizacoes } = useAppData();
  const usuario = user?.email ?? permissions?.nome ?? "vendedor";

  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [modoSemCheckin, setModoSemCheckin] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [vendeuMesmoAusente, setVendeuMesmoAusente] = useState(false);
  const [obs, setObs] = useState("");
  const [novaData, setNovaData] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Localização ---
  const [carregandoGeo, setCarregandoGeo] = useState(false);
  const [gpsVendedor, setGpsVendedor] = useState<Coordenadas | null>(null);
  const [locCliente, setLocCliente] = useState<LocalizacaoCliente | null>(null);
  const [modoCadastro, setModoCadastro] = useState<"link" | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [coordsExtraidas, setCoordsExtraidas] = useState<Coordenadas | null>(null);
  const [salvandoLoc, setSalvandoLoc] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [solicitado, setSolicitado] = useState(false);

  const codCliente = visita?.cod_cliente ?? 0;
  // Prospecção não tem cadastro no AGC — não há localização de cliente pra validar
  const ehProspeccao = visita?.prospeccao === true || codCliente === 0;

  useEffect(() => {
    if (!open || !visita) return;
    setEtapa("inicio");
    setModoSemCheckin(false);
    setResultado(null);
    setVendeuMesmoAusente(false);
    setObs(visita.observacao ?? "");
    setNovaData(visita.data_visita);
    setCarregandoGeo(false);
    setGpsVendedor(null);
    setLocCliente(null);
    setModoCadastro(null);
    setLinkInput("");
    setCoordsExtraidas(null);
    setSolicitado(false);
  }, [open, visita]);

  if (!visita) return null;

  const distancia =
    gpsVendedor && locCliente
      ? calcularDistancia(gpsVendedor.lat, gpsVendedor.lng, locCliente.lat, locCliente.lng)
      : null;
  const validada = distancia != null && dentroDoRaio(distancia);
  const foraDoRaio = distancia != null && !dentroDoRaio(distancia);

  const isReagendar = modoSemCheckin || resultado === "reagendar";

  /** Captura o GPS do vendedor e a localização cadastrada do cliente. */
  const fazerCheckin = async () => {
    setCarregandoGeo(true);
    try {
      const [gps, loc] = await Promise.all([
        obterLocalizacao(),
        ehProspeccao ? Promise.resolve(null) : getLocalizacaoCliente(codCliente).catch(() => null),
      ]);
      setGpsVendedor(gps);
      setLocCliente(loc);
      // Cliente sem localização: oferece cadastrar antes de seguir pro resultado
      setEtapa(!ehProspeccao && !loc ? "cadastro" : "resultado");
    } finally {
      setCarregandoGeo(false);
    }
  };

  const semCheckin = () => {
    setModoSemCheckin(true);
    setResultado("reagendar");
    setEtapa("resultado");
  };

  const gravarLocalizacao = async (coords: Coordenadas) => {
    setSalvandoLoc(true);
    try {
      await registrarLocalizacao(codCliente, coords.lat, coords.lng, usuario);
      setLocCliente({ ...coords, registrada_em: new Date().toISOString(), registrada_por: usuario });
      setModoCadastro(null);
      setLinkInput("");
      setCoordsExtraidas(null);
      toast.success("Localização do cliente cadastrada.");
      refreshLocalizacoes();
      setEtapa("resultado");
    } catch (err) {
      toast.error("Erro ao cadastrar localização: " + errMsgLoc(err));
    } finally {
      setSalvandoLoc(false);
    }
  };

  const solicitarAtualizacao = async () => {
    if (!gpsVendedor || !locCliente) return;
    setSolicitando(true);
    try {
      await solicitarMudancaLocalizacao(
        codCliente, gpsVendedor.lat, gpsVendedor.lng, locCliente.lat, locCliente.lng, usuario,
      );
      setSolicitado(true);
      toast.success("Solicitação enviada ao gestor");
    } catch (err) {
      toast.error("Erro ao solicitar atualização: " + errMsgLoc(err));
    } finally {
      setSolicitando(false);
    }
  };

  const salvar = async () => {
    if (!isReagendar && !resultado) {
      toast.error("Escolha o que aconteceu na visita");
      return;
    }
    if (isReagendar && !novaData) {
      toast.error("Escolha a nova data para reagendar");
      return;
    }
    // A venda é consequência do resultado — o valor vem do faturamento (edge function).
    const vendeu = resultado === "venda" || (resultado === "ausente" && vendeuMesmoAusente);

    setSaving(true);
    try {
      if (isReagendar) {
        await updateVisita(visita.id, {
          status: "reagendada",
          resultado: modoSemCheckin ? "reagendar_remoto" : "reagendar",
          observacao: obs || null,
          data_visita: novaData,
          mes_referencia: novaData.slice(0, 7),
          vendeu: false,
          valor_venda: 0,
          // Sem check-in não há GPS pra registrar
          latitude: modoSemCheckin ? null : gpsVendedor?.lat ?? null,
          longitude: modoSemCheckin ? null : gpsVendedor?.lng ?? null,
          distancia_metros: null,
          dentro_do_raio: null,
        });
        toast.success("Visita reagendada");
      } else {
        // O registro NUNCA é bloqueado: sem GPS ou fora do raio, salva mesmo assim e flageia.
        await updateVisita(visita.id, {
          status: "realizada",
          resultado: resultado!,
          vendeu,
          valor_venda: 0, // preenchido pela edge function a partir do faturamento
          venda_confirmada: false,
          venda_confirmada_em: null,
          observacao: obs || null,
          latitude: gpsVendedor?.lat ?? null,
          longitude: gpsVendedor?.lng ?? null,
          distancia_metros: distancia == null ? null : Math.round(distancia),
          dentro_do_raio: distancia == null ? null : dentroDoRaio(distancia),
        });
        toast.success(
          validada ? `Check-in validado — ${fmtMetros(distancia!)}` : "Visita registrada",
        );
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar: " + errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            Cliente: <span className="font-medium">{nome}</span>{" "}
            {!ehProspeccao && <span className="text-muted-foreground">({visita.cod_cliente})</span>}
          </div>

          {/* ================= ESTADO 1: ANTES DO CHECK-IN ================= */}
          {etapa === "inicio" && (
            <div className="space-y-4">
              <Button
                onClick={fazerCheckin}
                disabled={carregandoGeo}
                className="w-full h-16 text-lg font-bold bg-[#621244] hover:bg-[#4a0d33] text-white rounded-xl"
              >
                {carregandoGeo ? (
                  <><Loader2 className="animate-spin mr-2" /> Obtendo localização...</>
                ) : (
                  <>📍 Fazer Check-in</>
                )}
              </Button>

              <button
                type="button"
                onClick={semCheckin}
                disabled={carregandoGeo}
                className="w-full text-sm text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
              >
                Não estou no local — apenas reagendar
              </button>
            </div>
          )}

          {/* ============ CADASTRO DA LOCALIZAÇÃO (dentro do check-in) ============ */}
          {etapa === "cadastro" && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-amber-800">
                📍 Este cliente ainda não tem localização cadastrada
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  disabled={!gpsVendedor || salvandoLoc}
                  onClick={() => gpsVendedor && gravarLocalizacao(gpsVendedor)}
                  title={gpsVendedor ? "" : "GPS indisponível"}
                >
                  {salvandoLoc ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                  📍 Usar minha localização atual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => setModoCadastro(modoCadastro === "link" ? null : "link")}
                >
                  🔗 Colar link do Google Maps
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8"
                  onClick={() => setEtapa("resultado")}
                >
                  Pular
                </Button>
              </div>

              {modoCadastro === "link" && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">
                    Cole o link do Google Maps ou coordenadas:
                  </label>
                  <input
                    type="text"
                    value={linkInput}
                    onChange={e => {
                      setLinkInput(e.target.value);
                      setCoordsExtraidas(extrairCoordenadas(e.target.value));
                    }}
                    placeholder="https://maps.google.com/?q=-1.234,-48.567 ou -1.234, -48.567"
                    className="w-full border rounded px-3 py-2 text-sm bg-card"
                  />
                  {coordsExtraidas && (
                    <p className="text-xs text-green-600">
                      ✅ Lat: {coordsExtraidas.lat.toFixed(6)}, Lng: {coordsExtraidas.lng.toFixed(6)}
                    </p>
                  )}
                  {linkInput && !coordsExtraidas && (
                    <p className="text-xs text-red-500">
                      ❌ Não foi possível extrair coordenadas — links encurtados (goo.gl) não funcionam, abra o
                      link e copie a URL completa.
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!coordsExtraidas || salvandoLoc}
                    onClick={() => coordsExtraidas && gravarLocalizacao(coordsExtraidas)}
                  >
                    {salvandoLoc ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                    Confirmar localização
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ================= ESTADO 2: DEPOIS DO CHECK-IN ================= */}
          {etapa === "resultado" && (
            <>
              {/* Resultado do check-in */}
              {!modoSemCheckin && distancia != null && (
                <div className={`rounded-xl p-3 text-center ${
                  validada ? "bg-green-50 border border-green-300" : "bg-amber-50 border border-amber-300"
                }`}>
                  <p className={`text-sm font-bold ${validada ? "text-green-700" : "text-amber-700"}`}>
                    {validada
                      ? `✅ Check-in validado — ${fmtMetros(distancia)} do cliente`
                      : `⚠️ Check-in a ${fmtMetros(distancia)} do cliente (limite: ${RAIO_METROS}m)`}
                  </p>
                  {foraDoRaio && (
                    solicitado ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        📍 Solicitação de atualização enviada ao gestor.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={solicitarAtualizacao}
                        disabled={solicitando}
                        className="text-xs text-amber-700 underline hover:text-amber-900 disabled:opacity-50 mt-1"
                      >
                        {solicitando ? "Enviando…" : "📍 Solicitar atualização de localização"}
                      </button>
                    )
                  )}
                </div>
              )}

              {!modoSemCheckin && distancia == null && (
                <div className="rounded-xl p-3 text-center bg-muted border">
                  <p className="text-xs text-muted-foreground">
                    {!gpsVendedor
                      ? "GPS indisponível ou negado — a visita será registrada sem validação de local."
                      : ehProspeccao
                        ? "Prospecção — sem localização cadastrada para validar."
                        : "Cliente sem localização cadastrada — a visita será registrada sem validação."}
                  </p>
                  {locCliente && !gpsVendedor && (
                    <a
                      href={linkMaps(locCliente.lat, locCliente.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline"
                    >
                      📍 Ver localização cadastrada do cliente
                    </a>
                  )}
                </div>
              )}

              {modoSemCheckin && (
                <div className="rounded-xl p-3 text-center bg-blue-50 border border-blue-200">
                  <p className="text-sm font-medium text-blue-700">
                    📅 Sem check-in — apenas reagendamento
                  </p>
                </div>
              )}

              {/* Opções de resultado (só com check-in) */}
              {!modoSemCheckin && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">O que aconteceu na visita?</p>

                  <div className="grid grid-cols-2 gap-2">
                    {OPCOES.map(o => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setResultado(o.value)}
                        className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-colors ${
                          resultado === o.value ? o.ativo : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {resultado === "venda" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-700">
                    ✅ O valor da venda será confirmado automaticamente pelo faturamento em até 2 dias.
                  </p>
                </div>
              )}

              {resultado === "ausente" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Mesmo ausente, conseguiu fechar um pedido?</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={vendeuMesmoAusente ? "default" : "outline"}
                      onClick={() => setVendeuMesmoAusente(!vendeuMesmoAusente)}
                      className={vendeuMesmoAusente ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {vendeuMesmoAusente ? "✅ Sim, vendeu" : "Sim, vendeu"}
                    </Button>
                    <span className="text-xs text-gray-400 self-center">
                      Valor confirmado pelo faturamento
                    </span>
                  </div>
                </div>
              )}

              {isReagendar && (
                <div>
                  <Label htmlFor="novaData">Nova data</Label>
                  <Input id="novaData" type="date" value={novaData} onChange={e => setNovaData(e.target.value)} />
                </div>
              )}

              <div>
                <Label htmlFor="obs">Observação (opcional)</Label>
                <Textarea
                  id="obs"
                  rows={2}
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  placeholder="Anotações..."
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            {etapa === "resultado" && (
              <Button onClick={salvar} disabled={saving}>
                {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
                {foraDoRaio && !isReagendar ? "Registrar mesmo assim" : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalRealizarVisita;
