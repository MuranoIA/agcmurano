import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

const RESULTADOS = [
  { value: "venda", label: "Venda realizada" },
  { value: "reagendar", label: "Reagendar" },
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "ausente", label: "Cliente ausente" },
  { value: "outro", label: "Outro" },
] as const;

const fmtMetros = (m: number) => `${m.toFixed(0)}m`;

const ModalRealizarVisita: React.FC<Props> = ({ open, onOpenChange, visita, nome, onSaved }) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { refreshLocalizacoes } = useAppData();
  const usuario = user?.email ?? permissions?.nome ?? "vendedor";

  const [vendeu, setVendeu] = useState(false);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [resultado, setResultado] = useState<string>("venda");
  const [novaData, setNovaData] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Localização ---
  const [carregandoGeo, setCarregandoGeo] = useState(false);
  const [gpsVendedor, setGpsVendedor] = useState<Coordenadas | null>(null);
  const [locCliente, setLocCliente] = useState<LocalizacaoCliente | null>(null);
  const [pulou, setPulou] = useState(false);
  const [modoCadastro, setModoCadastro] = useState<"link" | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [coordsExtraidas, setCoordsExtraidas] = useState<Coordenadas | null>(null);
  const [salvandoLoc, setSalvandoLoc] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [solicitado, setSolicitado] = useState(false);

  const codCliente = visita?.cod_cliente ?? 0;
  // Prospecção não tem cadastro no AGC — não há localização de cliente pra validar
  const ehProspeccao = visita?.prospeccao === true || codCliente === 0;

  const carregarGeo = useCallback(async () => {
    setCarregandoGeo(true);
    try {
      const [gps, loc] = await Promise.all([
        obterLocalizacao(),
        ehProspeccao ? Promise.resolve(null) : getLocalizacaoCliente(codCliente).catch(() => null),
      ]);
      setGpsVendedor(gps);
      setLocCliente(loc);
    } finally {
      setCarregandoGeo(false);
    }
  }, [codCliente, ehProspeccao]);

  useEffect(() => {
    if (open && visita) {
      setVendeu(visita.vendeu ?? false);
      setValor(visita.valor_venda ? String(visita.valor_venda) : "");
      setObs(visita.observacao ?? "");
      setResultado(visita.resultado || "venda");
      setNovaData(visita.data_visita);
      setGpsVendedor(null);
      setLocCliente(null);
      setPulou(false);
      setModoCadastro(null);
      setLinkInput("");
      setCoordsExtraidas(null);
      setSolicitado(false);
      carregarGeo();
    }
  }, [open, visita, carregarGeo]);

  if (!visita) return null;

  const isReagendar = resultado === "reagendar";

  const distancia =
    gpsVendedor && locCliente
      ? calcularDistancia(gpsVendedor.lat, gpsVendedor.lng, locCliente.lat, locCliente.lng)
      : null;
  const validada = distancia != null && dentroDoRaio(distancia);
  const foraDoRaio = distancia != null && !dentroDoRaio(distancia);

  const precisaCadastrar = !isReagendar && !ehProspeccao && !locCliente && !pulou && !carregandoGeo;

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
    if (isReagendar && !novaData) {
      toast.error("Escolha a nova data para reagendar");
      return;
    }
    setSaving(true);
    try {
      const valorNum = vendeu ? parseFloat(valor.replace(",", ".")) || 0 : 0;
      if (isReagendar) {
        await updateVisita(visita.id, {
          status: "reagendada",
          resultado,
          observacao: obs || null,
          data_visita: novaData,
          mes_referencia: novaData.slice(0, 7),
          vendeu: false,
          valor_venda: 0,
        });
        toast.success("Visita reagendada");
      } else {
        // O registro NUNCA é bloqueado: sem GPS ou fora do raio, salva mesmo assim e flageia.
        await updateVisita(visita.id, {
          status: "realizada",
          vendeu,
          valor_venda: valorNum,
          observacao: obs || null,
          resultado,
          latitude: gpsVendedor?.lat ?? null,
          longitude: gpsVendedor?.lng ?? null,
          distancia_metros: distancia == null ? null : Math.round(distancia),
          dentro_do_raio: distancia == null ? null : dentroDoRaio(distancia),
        });
        toast.success(
          validada ? `Visita validada — ${fmtMetros(distancia!)} do cliente` : "Visita registrada!",
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
            <span className="text-muted-foreground">({visita.cod_cliente})</span>
          </div>

          {!isReagendar && (
            <>
              <div>
                <Label className="mb-1.5 block">Vendeu?</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={vendeu ? "default" : "outline"} onClick={() => setVendeu(true)}>
                    Sim
                  </Button>
                  <Button type="button" size="sm" variant={!vendeu ? "default" : "outline"} onClick={() => setVendeu(false)}>
                    Não
                  </Button>
                </div>
              </div>

              {vendeu && (
                <div>
                  <Label htmlFor="valor">Valor da venda (R$)</Label>
                  <Input
                    id="valor"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <div>
            <Label className="mb-1.5 block">Resultado</Label>
            <RadioGroup value={resultado} onValueChange={setResultado}>
              {RESULTADOS.map(r => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`res-${r.value}`} />
                  <Label htmlFor={`res-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {isReagendar && (
            <div>
              <Label htmlFor="novaData">Nova data</Label>
              <Input id="novaData" type="date" value={novaData} onChange={e => setNovaData(e.target.value)} />
            </div>
          )}

          <div>
            <Label htmlFor="obs">Observação</Label>
            <Textarea id="obs" rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Anotações da visita..." />
          </div>

          {/* ================= LOCALIZAÇÃO ================= */}
          {!isReagendar && (
            <div className="border-t pt-3 space-y-2">
              {carregandoGeo && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Obtendo localização…
                </p>
              )}

              {!carregandoGeo && !gpsVendedor && (
                <p className="text-xs text-muted-foreground">
                  GPS indisponível ou negado — a visita será registrada sem validação de local.
                </p>
              )}

              {/* Cliente ainda sem localização: cadastrar (livre, sem aprovação) */}
              {precisaCadastrar && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
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
                      onClick={() => setPulou(true)}
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

              {pulou && !locCliente && (
                <p className="text-xs text-muted-foreground">
                  Localização não cadastrada — a visita será salva sem validação.
                </p>
              )}

              {/* Cliente com localização: validar distância */}
              {validada && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                  <p className="text-xs font-bold text-green-800">
                    ✅ Visita validada — {fmtMetros(distancia!)} do cliente
                  </p>
                </div>
              )}

              {foraDoRaio && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-800">
                    ⚠️ Você está a {fmtMetros(distancia!)} do cliente (limite: {RAIO_METROS}m)
                  </p>
                  <p className="text-xs text-amber-700">
                    A visita pode ser registrada mesmo assim — ficará marcada como fora do raio.
                  </p>
                  {solicitado ? (
                    <p className="text-xs text-muted-foreground">
                      📍 Solicitação de atualização enviada ao gestor.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={solicitarAtualizacao}
                      disabled={solicitando}
                      className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                    >
                      {solicitando ? "Enviando…" : "📍 Solicitar atualização de localização"}
                    </button>
                  )}
                </div>
              )}

              {locCliente && !gpsVendedor && !carregandoGeo && (
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
              {foraDoRaio ? "Registrar mesmo assim" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalRealizarVisita;
