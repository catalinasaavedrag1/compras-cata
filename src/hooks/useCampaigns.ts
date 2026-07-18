import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createCampaign,
  createCampaignOpportunity,
  isPurchaseBffConfigured,
  listCampaignOpportunities,
  listCampaigns,
  patchCampaign,
  patchCampaignOpportunity,
  toPurchaseBffError,
  type CampaignOpportunityStatus,
  type CampaignOpportunityView,
  type CampaignStatus,
  type CampaignType,
  type CampaignView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Campañas y oportunidades reales (F18): /campaign-opportunities y /campaigns.
//  - useCampaignOpportunities(filters): lista con filtros que resuelve el
//    backend (status/kind). Guardia de carrera + logout ante UNAUTHENTICATED.
//  - useCampaignsList(filters): campañas (status/type en el backend).
//  - useCampaignCommands: POST 🔑 (crear oportunidad/campaña) y PATCH con
//    If-Match (ciclos de vida). Todo 409 (duplicado, transición inválida o
//    versión obsoleta) dispara onConflict para recargar y el caller muestra
//    el mensaje del backend. Patrón useSignals/useImports.
// ============================================================================

export interface OpportunityFilters {
  status?: CampaignOpportunityStatus;
  kind?: string;
}

export interface UseCampaignOpportunitiesResult {
  opportunities: CampaignOpportunityView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useCampaignOpportunities(
  filters: OpportunityFilters = {},
  options: { enabled?: boolean } = {}
): UseCampaignOpportunitiesResult {
  const configured = isPurchaseBffConfigured();
  const enabled = options.enabled ?? true;
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { status, kind } = filters;

  const [opportunities, setOpportunities] = useState<CampaignOpportunityView[]>([]);
  const [loading, setLoading] = useState(configured && enabled);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !enabled) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listCampaignOpportunities({ status, kind });
      if (seq !== requestSeq.current) return;
      setOpportunities(page.items);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      setError(info);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [configured, enabled, status, kind, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ opportunities, loading, error, configured, refetch: () => void load() }),
    [opportunities, loading, error, configured, load]
  );
}

export interface CampaignFilters {
  status?: CampaignStatus;
  type?: CampaignType;
}

export interface UseCampaignsListResult {
  campaigns: CampaignView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useCampaignsList(
  filters: CampaignFilters = {},
  options: { enabled?: boolean } = {}
): UseCampaignsListResult {
  const configured = isPurchaseBffConfigured();
  const enabled = options.enabled ?? true;
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { status, type } = filters;

  const [campaigns, setCampaigns] = useState<CampaignView[]>([]);
  const [loading, setLoading] = useState(configured && enabled);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !enabled) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listCampaigns({ status, type });
      if (seq !== requestSeq.current) return;
      setCampaigns(page.items);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      setError(info);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [configured, enabled, status, type, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ campaigns, loading, error, configured, refetch: () => void load() }),
    [campaigns, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  Comandos (POST 🔑 / PATCH If-Match)
// ----------------------------------------------------------------------------

export type OpportunityCommandResult =
  | { ok: true; opportunity: CampaignOpportunityView }
  | { ok: false; error: PurchaseBffError };

export type CampaignCommandResult =
  | { ok: true; campaign: CampaignView }
  | { ok: false; error: PurchaseBffError };

export interface CreateOpportunityInput {
  kind: string;
  sku?: string;
  categoryId?: string;
  channelRef?: string;
  windowFrom: string;
  windowTo: string;
  evidence: Record<string, unknown>;
}

export interface CreateCampaignInput {
  type: CampaignType;
  title: string;
  opportunityId?: string;
  channelRef?: string;
  budgetClp?: number;
  startsAt: string;
  endsAt: string;
}

export interface CampaignCommands {
  /** POST /campaign-opportunities — registrar oportunidad (duplicada viva ⇒ 409). */
  createOpportunity: (input: CreateOpportunityInput) => Promise<OpportunityCommandResult>;
  /** PATCH /campaign-opportunities/:id — ciclo (dismissed exige reason ≥5). */
  transitionOpportunity: (
    id: string,
    version: number,
    status: Exclude<CampaignOpportunityStatus, "detected">,
    reason?: string
  ) => Promise<OpportunityCommandResult>;
  /** POST /campaigns — crear campaña ('opportunity' exige opportunityId; 'ad_space', channelRef). */
  createCampaign: (input: CreateCampaignInput) => Promise<CampaignCommandResult>;
  /** PATCH /campaigns/:id — transición de estado (planned→active→closed|cancelled). */
  transitionCampaign: (
    id: string,
    version: number,
    status: Exclude<CampaignStatus, "planned">
  ) => Promise<CampaignCommandResult>;
  /** PATCH /campaigns/:id — presupuesto y/o fecha de término. */
  updateCampaign: (
    id: string,
    version: number,
    body: { budgetClp?: number; endsAt?: string }
  ) => Promise<CampaignCommandResult>;
}

export function useCampaignCommands(options: { onConflict?: () => void } = {}): CampaignCommands {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { onConflict } = options;

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleError = useCallback(
    (err: unknown): { ok: false; error: PurchaseBffError } => {
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
      // 409: duplicado vivo, transición inválida o versión obsoleta ⇒ el caller
      // recarga para reflejar el estado real y muestra el mensaje del backend.
      else if (info.statusCode === 409) onConflict?.();
      return { ok: false, error: info };
    },
    [handleUnauthenticated, onConflict]
  );

  return useMemo<CampaignCommands>(
    () => ({
      createOpportunity: async (input) => {
        try {
          return { ok: true, opportunity: await createCampaignOpportunity(input) };
        } catch (err) {
          return handleError(err);
        }
      },
      transitionOpportunity: async (id, version, status, reason) => {
        try {
          return {
            ok: true,
            opportunity: await patchCampaignOpportunity(id, version, { status, reason }),
          };
        } catch (err) {
          return handleError(err);
        }
      },
      createCampaign: async (input) => {
        try {
          return { ok: true, campaign: await createCampaign(input) };
        } catch (err) {
          return handleError(err);
        }
      },
      transitionCampaign: async (id, version, status) => {
        try {
          return { ok: true, campaign: await patchCampaign(id, version, { status }) };
        } catch (err) {
          return handleError(err);
        }
      },
      updateCampaign: async (id, version, body) => {
        try {
          return { ok: true, campaign: await patchCampaign(id, version, body) };
        } catch (err) {
          return handleError(err);
        }
      },
    }),
    [handleError]
  );
}
