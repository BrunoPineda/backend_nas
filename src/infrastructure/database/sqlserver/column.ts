/** Lectura tolerante a mayúsc./minús. del driver `mssql` frente a identificadores SQL. */
export function r<T = unknown>(row: Record<string, unknown>, ...candidates: string[]): T | undefined {
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, c)) return row[c] as T;
  }
  for (const c of candidates) {
    const want = c.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === want) return row[key] as T;
    }
  }
  return undefined;
}
