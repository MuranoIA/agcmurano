import { externalSupabase } from "@/integrations/supabase/externalClient";

/** Raio de validação do check-in, em metros. */
export const RAIO_METROS = 50;

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface LocalizacaoCliente extends Coordenadas {
  registrada_em: string | null;
  registrada_por: string | null;
}

export interface AprovacaoLocalizacao {
  id: number;
  cod_cliente: number;
  lat_proposta: number;
  lng_proposta: number;
  lat_anterior: number | null;
  lng_anterior: number | null;
  solicitado_por: string;
  solicitado_em: string;
  status: string;
  resolvido_por: string | null;
  resolvido_em: string | null;
  motivo: string | null;
}

const num = (v: unknown): number => Number(v);

// ---- GEOMETRIA ----

/** Haversine: distância entre 2 pontos GPS, em metros. */
export function calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function dentroDoRaio(distancia: number): boolean {
  return distancia <= RAIO_METROS;
}

// ---- GPS DO NAVEGADOR ----

/** Pede a posição ao navegador. Resolve null se indisponível ou negada — nunca rejeita. */
export async function obterLocalizacao(): Promise<Coordenadas | null> {
  if (!navigator.geolocation) return null;
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

// ---- PARSE DE LINK / COORDENADAS ----

const coordValida = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(lat === 0 && lng === 0);

/**
 * Extrai lat/lng de coordenadas soltas ou de uma URL do Google Maps.
 * Aceita:
 *   -1.234, -48.567
 *   https://maps.google.com/?q=-1.234,-48.567
 *   https://www.google.com/maps/@-1.234,-48.567,17z
 *   https://www.google.com/maps/place/.../@-1.234,-48.567,17z
 *   .../!3d-1.234!4d-48.567
 * Links encurtados (goo.gl/maps, maps.app.goo.gl) não são resolvíveis no navegador.
 */
export function extrairCoordenadas(input: string): Coordenadas | null {
  const texto = (input || "").trim();
  if (!texto) return null;

  // Coordenadas soltas: "-1.234, -48.567" (a string inteira, sem URL em volta)
  if (!/https?:\/\//i.test(texto)) {
    const direta = texto.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (direta) {
      const lat = parseFloat(direta[1]);
      const lng = parseFloat(direta[2]);
      if (coordValida(lat, lng)) return { lat, lng };
    }
  }

  // /@lat,lng — o marcador do mapa
  const arroba = texto.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (arroba) {
    const lat = parseFloat(arroba[1]);
    const lng = parseFloat(arroba[2]);
    if (coordValida(lat, lng)) return { lat, lng };
  }

  // ?q=lat,lng | &query=lat,lng | &ll=lat,lng | &destination=lat,lng
  const query = texto.match(/[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (query) {
    const lat = parseFloat(query[1]);
    const lng = parseFloat(query[2]);
    if (coordValida(lat, lng)) return { lat, lng };
  }

  // !3dLAT!4dLNG — formato interno dos links de "place"
  const bang = texto.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bang) {
    const lat = parseFloat(bang[1]);
    const lng = parseFloat(bang[2]);
    if (coordValida(lat, lng)) return { lat, lng };
  }

  return null;
}

/** URL do Google Maps para um ponto. */
export const linkMaps = (lat: number, lng: number): string =>
  `https://maps.google.com/?q=${lat},${lng}`;

// ---- LEITURA ----

/** Localização cadastrada de um cliente (null se ainda não tem). */
export async function getLocalizacaoCliente(codCliente: number): Promise<LocalizacaoCliente | null> {
  const { data, error } = await externalSupabase
    .from("clientes")
    .select("lat_cliente, lng_cliente, localizacao_registrada_em, localizacao_registrada_por")
    .eq("codcli", codCliente)
    .maybeSingle();
  if (error) throw error;
  if (data?.lat_cliente == null || data?.lng_cliente == null) return null;
  return {
    lat: num(data.lat_cliente),
    lng: num(data.lng_cliente),
    registrada_em: data.localizacao_registrada_em,
    registrada_por: data.localizacao_registrada_por,
  };
}

/** Mapa cod_cliente -> tem localização cadastrada. Usado pela lista de clientes. */
export async function fetchClientesComLocalizacao(): Promise<Set<number>> {
  const comLoc = new Set<number>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await externalSupabase
      .from("clientes")
      .select("codcli")
      .not("lat_cliente", "is", null)
      .not("lng_cliente", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    data.forEach(c => comLoc.add(c.codcli));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return comLoc;
}

// ---- ESCRITA ----

/**
 * Grava a localização do cliente.
 *
 * Vai por RPC (`set_localizacao_cliente`, SECURITY DEFINER) porque o role `anon`
 * — que é como o app fala com este Supabase — só tem SELECT em `clientes`.
 * A função escreve apenas as 4 colunas de localização.
 */
export async function registrarLocalizacao(
  codCliente: number, lat: number, lng: number, usuario: string,
): Promise<void> {
  const { error } = await externalSupabase.rpc("set_localizacao_cliente", {
    p_codcli: codCliente,
    p_lat: lat,
    p_lng: lng,
    p_usuario: usuario,
  });
  if (error) throw error;
}

/** Solicita mudança de uma localização já cadastrada — precisa de aprovação do gestor. */
export async function solicitarMudancaLocalizacao(
  codCliente: number, lat: number, lng: number,
  latAnterior: number, lngAnterior: number, usuario: string,
): Promise<void> {
  const { error } = await externalSupabase.from("localizacao_aprovacoes").insert({
    cod_cliente: codCliente,
    lat_proposta: lat,
    lng_proposta: lng,
    lat_anterior: latAnterior,
    lng_anterior: lngAnterior,
    solicitado_por: usuario,
    status: "pendente",
  });
  if (error) throw error;
}

// ---- APROVAÇÕES (GESTOR) ----

export async function fetchAprovacoesPendentes(): Promise<AprovacaoLocalizacao[]> {
  const { data, error } = await externalSupabase
    .from("localizacao_aprovacoes")
    .select("*")
    .eq("status", "pendente")
    .order("solicitado_em");
  if (error) throw error;
  return (data || []).map(a => ({
    ...a,
    lat_proposta: num(a.lat_proposta),
    lng_proposta: num(a.lng_proposta),
    lat_anterior: a.lat_anterior == null ? null : num(a.lat_anterior),
    lng_anterior: a.lng_anterior == null ? null : num(a.lng_anterior),
  })) as AprovacaoLocalizacao[];
}

export async function countAprovacoesPendentes(): Promise<number> {
  const { count, error } = await externalSupabase
    .from("localizacao_aprovacoes")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  if (error) return 0;
  return count || 0;
}

export async function aprovarMudanca(
  id: number, codCliente: number, lat: number, lng: number, gestor: string,
): Promise<void> {
  await registrarLocalizacao(codCliente, lat, lng, gestor);
  const { error } = await externalSupabase
    .from("localizacao_aprovacoes")
    .update({ status: "aprovada", resolvido_por: gestor, resolvido_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejeitarMudanca(id: number, gestor: string, motivo: string): Promise<void> {
  const { error } = await externalSupabase
    .from("localizacao_aprovacoes")
    .update({
      status: "rejeitada",
      resolvido_por: gestor,
      resolvido_em: new Date().toISOString(),
      motivo: motivo || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export const errMsgLoc = (e: unknown): string => (e instanceof Error ? e.message : String(e));
