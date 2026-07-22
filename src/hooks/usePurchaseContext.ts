import { useEffect, useState } from "react";
import {
  getContext,
  isPurchaseBffConfigured,
  type PurchaseContextData,
} from "../services/purchaseBff";

// ============================================================================
//  GET /context con caché a nivel de módulo: la sesión/permisos no cambian
//  durante la vida de la SPA, así que se pide una sola vez y se comparte entre
//  todos los consumidores (gate de acciones de aprobación, etc.).
// ============================================================================

let cachedContext: PurchaseContextData | null = null;
let inflight: Promise<PurchaseContextData> | null = null;

export interface UsePurchaseContextResult {
  context: PurchaseContextData | null;
  loading: boolean;
  /** ¿La sesión tiene el permiso indicado (ej. purchase:proposal:approve)? */
  hasPermission: (permission: string) => boolean;
}

export function usePurchaseContext(): UsePurchaseContextResult {
  const configured = isPurchaseBffConfigured();
  const [context, setContext] = useState<PurchaseContextData | null>(cachedContext);
  const [loading, setLoading] = useState(configured && !cachedContext);

  useEffect(() => {
    if (!configured || cachedContext) return;
    let active = true;
    inflight ??= getContext();
    inflight
      .then((data) => {
        cachedContext = data;
        if (active) setContext(data);
      })
      .catch(() => {
        // Degradación silenciosa: sin contexto ⇒ sin permisos elevados.
        inflight = null;
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configured]);

  return {
    context,
    loading,
    hasPermission: (permission: string) => context?.permissions.includes(permission) ?? false,
  };
}
