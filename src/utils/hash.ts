/**
 * Hash determinista de un string a entero sin signo (variante djb2/31).
 * Se usa para generar datos de demo estables (mismo input → mismo número),
 * evitando Math.random. No es criptográfico.
 */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
