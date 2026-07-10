// ============================================================================
//  Utilidades de archivos 100% en el navegador (sin backend).
//  Permiten adjuntar una ficha técnica / manual de proveedor, guardarla en la
//  sesión (como data URL) y volver a verla o descargarla. Nada sale del cliente.
// ============================================================================

/** Lee un archivo del disco y lo devuelve como data URL (base64). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/** Formatea bytes a un tamaño legible ("245 KB" o "1,3 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

/** Convierte un data URL a un blob URL temporal (para abrir en pestaña nueva). */
function dataUrlToBlobUrl(dataUrl: string): string {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** Abre el archivo (data URL) en una pestaña nueva para previsualizarlo. */
export function openDataUrl(dataUrl: string): void {
  const url = dataUrlToBlobUrl(dataUrl);
  window.open(url, "_blank", "noopener,noreferrer");
  // Se revoca luego de un momento para no cortar la carga inicial de la pestaña.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Fuerza la descarga del archivo (data URL) con su nombre original. */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const url = dataUrlToBlobUrl(dataUrl);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
