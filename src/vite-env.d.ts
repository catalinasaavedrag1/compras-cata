/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend demo local (server/). Vacío = modo demo con mocks. */
  readonly VITE_API_URL?: string;
  /** URL base del purchase-bff-service (ej. http://localhost:3131). */
  readonly VITE_PURCHASE_BFF_URL?: string;
  /** Token JWT de desarrollo para el purchase-bff-service. */
  readonly VITE_PURCHASE_BFF_TOKEN?: string;
}

