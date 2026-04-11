const MESES: Record<string, number> = {
  "Jan": 0, "Fev": 1, "Mar": 2, "Abr": 3, "Mai": 4, "Jun": 5,
  "Jul": 6, "Ago": 7, "Set": 8, "Out": 9, "Nov": 10, "Dez": 11,
};

/** Parse "Abr/26" → Date(2026, 3, 1) */
export function parseMesCol(col: string): Date | null {
  const parts = col.split("/");
  if (parts.length !== 2) return null;
  const monthIdx = MESES[parts[0]];
  if (monthIdx === undefined) return null;
  const year = 2000 + parseInt(parts[1], 10);
  if (isNaN(year)) return null;
  return new Date(year, monthIdx, 1);
}
