import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAppData } from "@/contexts/AppDataContext";
import {
  Coordenadas,
  LocalizacaoCliente,
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
  codCliente: number;
  nomeCliente: string;
}

const ModalCadastrarLocalizacao: React.FC<Props> = ({ open, onOpenChange, codCliente, nomeCliente }) => {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { refreshLocalizacoes } = useAppData();
  const usuario = user?.email ?? permissions?.nome ?? "vendedor";

  const [linkInput, setLinkInput] = useState("");
  const [coordsPreview, setCoordsPreview] = useState<Coordenadas | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [atual, setAtual] = useState<LocalizacaoCliente | null>(null);
  const [carregandoAtual, setCarregandoAtual] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLinkInput("");
    setCoordsPreview(null);
    setAtual(null);
    setCarregandoAtual(true);
    getLocalizacaoCliente(codCliente)
      .then(setAtual)
      .catch(() => setAtual(null))
      .finally(() => setCarregandoAtual(false));
  }, [open, codCliente]);

  const usarGps = async () => {
    setBuscandoGps(true);
    try {
      const loc = await obterLocalizacao();
      if (loc) {
        setCoordsPreview(loc);
        setLinkInput("");
      } else {
        toast.error("Não foi possível obter o GPS — permita o acesso à localização ou cole um link.");
      }
    } finally {
      setBuscandoGps(false);
    }
  };

  const salvar = async () => {
    if (!coordsPreview) return;
    setSalvando(true);
    try {
      if (atual) {
        // Já tem localização: mudança precisa da aprovação do gestor
        await solicitarMudancaLocalizacao(
          codCliente, coordsPreview.lat, coordsPreview.lng, atual.lat, atual.lng, usuario,
        );
        toast.success("Solicitação enviada ao gestor para aprovação");
      } else {
        await registrarLocalizacao(codCliente, coordsPreview.lat, coordsPreview.lng, usuario);
        toast.success("Localização cadastrada.");
        refreshLocalizacoes();
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar localização: " + errMsgLoc(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">📍 Cadastrar Localização — {nomeCliente}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {carregandoAtual ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Verificando localização atual…
            </p>
          ) : atual ? (
            <div className="bg-amber-50 border border-amber-300 rounded p-2 text-xs text-amber-800">
              Este cliente já tem localização cadastrada
              {atual.registrada_por ? ` por ${atual.registrada_por}` : ""}. A mudança precisa de{" "}
              <strong>aprovação do gestor</strong>.{" "}
              <a
                href={linkMaps(atual.lat, atual.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Ver atual
              </a>
            </div>
          ) : null}

          {/* Opção 1: GPS automático */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={usarGps}
            disabled={buscandoGps}
          >
            {buscandoGps ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            📍 Usar minha localização atual
          </Button>

          {/* Opção 2: link do Google Maps */}
          <div>
            <label className="text-xs text-muted-foreground">Ou cole um link do Google Maps:</label>
            <input
              type="text"
              value={linkInput}
              onChange={e => {
                setLinkInput(e.target.value);
                setCoordsPreview(extrairCoordenadas(e.target.value));
              }}
              placeholder="https://maps.google.com/?q=-1.234,-48.567"
              className="w-full border rounded px-3 py-2 text-sm mt-1 bg-card"
            />
            {linkInput && !coordsPreview && (
              <p className="text-xs text-red-500 mt-1">
                ❌ Não foi possível extrair coordenadas — links encurtados (goo.gl) não funcionam, abra o link e
                copie a URL completa.
              </p>
            )}
          </div>

          {/* Preview */}
          {coordsPreview && (
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <p className="text-xs text-green-700">
                ✅ Lat: {coordsPreview.lat.toFixed(6)}, Lng: {coordsPreview.lng.toFixed(6)}
              </p>
              <a
                href={linkMaps(coordsPreview.lat, coordsPreview.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline"
              >
                Ver no mapa
              </a>
            </div>
          )}

          <Button disabled={!coordsPreview || salvando || carregandoAtual} onClick={salvar} className="w-full">
            {salvando ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            {atual ? "Solicitar mudança" : "Salvar localização"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalCadastrarLocalizacao;
