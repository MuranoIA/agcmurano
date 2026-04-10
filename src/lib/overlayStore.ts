import { OverlayStore, Visita } from "./types";

const STORAGE_KEY = "grandes_contas_overlay";

function emptyStore(): OverlayStore {
  return { vendedores: {}, valores_mes: {}, visitas: [] };
}

let store: OverlayStore = emptyStore();
let listeners: Array<() => void> = [];
let storageAvailable = true;

function notify() {
  listeners.forEach(fn => fn());
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    storageAvailable = false;
  }
}

export function isStorageAvailable() { return storageAvailable; }

export function loadOverlay(): OverlayStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      store = { ...emptyStore(), ...JSON.parse(raw) };
    }
  } catch {
    storageAvailable = false;
  }
  return store;
}

export function getOverlay(): OverlayStore { return store; }

export function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function setVendedor(codigo: string, vendedor: string) {
  store.vendedores[codigo] = vendedor;
  persist(); notify();
}

export function setValorMes(codigo: string, mes: string, valor: number) {
  if (!store.valores_mes[codigo]) store.valores_mes[codigo] = {};
  store.valores_mes[codigo][mes] = valor;
  persist(); notify();
}

export function addVisita(v: Visita) {
  store.visitas.push(v);
  persist(); notify();
}

export function removeVisita(index: number) {
  store.visitas.splice(index, 1);
  persist(); notify();
}

export function importOverlay(overlay: OverlayStore) {
  store = { ...emptyStore(), ...overlay };
  persist(); notify();
}

export function exportOverlayJSON(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return JSON.stringify({ exportado_em: dt, overlay: store }, null, 2);
}

export function resetOverlay() {
  store = emptyStore();
  persist(); notify();
}
