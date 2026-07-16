// ID único y corto para registros creados en runtime (reclamos, bitácora, etc.).
// El timestamp da orden y el sufijo aleatorio evita colisiones si se crean varios
// en el mismo milisegundo.
export function genId(prefix: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
