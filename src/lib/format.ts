export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function fmtBRLShort(v: number): string {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

export function fmtNum(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

// ---- FORMATADORES DE DADOS CADASTRAIS ----

const digitos = (v: string) => v.replace(/\D/g, "");

export function fmtCEP(v?: string | null): string {
  if (!v) return "—";
  const d = digitos(v);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v;
}

export function fmtCpfCnpj(v?: string | null): string {
  if (!v) return "—";
  const d = digitos(v);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return v;
}

export function fmtTelefone(v?: string | null): string {
  if (!v) return "—";
  const d = digitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

/** "RITA DE CSSIA SILVA" -> "RS" */
export function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/).filter(p => p.length > 2);
  if (partes.length === 0) return nome.trim().slice(0, 2).toUpperCase();
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function downloadFile(content: string, filename: string, mime = "text/csv;charset=utf-8") {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function downloadJSON(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(headers: string[], rows: string[][]): string {
  return [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
}
