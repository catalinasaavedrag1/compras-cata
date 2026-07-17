import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Chip } from "../components/ui/Chip";
import { Skeleton } from "../components/ui/Skeleton";
import { isOpenClaim, useClaims } from "../context/ClaimsContext";
import { useToast } from "../context/ToastContext";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import { formatDate, formatNumber } from "../utils/formatters";
import { IconAlerts, IconCheck, IconClock, IconLock, IconSuppliers } from "../components/ui/icons";
import {
  describePurchaseBffError,
  type ClaimDetailView,
  type ClaimPatchBody,
  type ClaimResolution,
  type ClaimSummaryView,
} from "../services/purchaseBff";
import {
  CLAIM_RESOLUTION_LABEL,
  CLAIM_RESOLVE_PERMISSION,
  CLAIM_STATUS_UI,
  CLAIM_TYPE_UI,
  describeClaimConflict,
} from "./claims/helpers";
import { CreateClaimModal } from "./claims/CreateClaimModal";

// ============================================================================
//  Reclamos (flujo 5) conectados al purchase-bff-service. El mapeo de la
//  máquina real (open → in_review → resolved | rejected) a los chips
//  existentes vive en ./claims/helpers.ts:
//    chip "Abiertos"  = open | in_review
//    chip "Resueltos" = resolved | rejected
//  El valor reclamado en CLP del mock no existe en el contrato: las KPIs
//  monetarias se reemplazan por conteos reales de la máquina de estados.
//  Resolver/rechazar exigen purchase:claim:resolve (solo líder): los botones
//  se gatean con el contexto de sesión, con el aviso de candado de Aprobaciones.
// ============================================================================

const fmtDate = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

export function ClaimsPage() {
  const { claims, configured, loading, error, refetch } = useClaims();
  const { hasPermission } = usePurchaseContext();
  const canResolve = hasPermission(CLAIM_RESOLVE_PERMISSION);

  const [filter, setFilter] = useState<"abiertos" | "todos" | "resueltos">("abiertos");
  const [managing, setManaging] = useState<ClaimSummaryView | null>(null);
  const [creating, setCreating] = useState(false);

  const kpis = useMemo(
    () => ({
      open: claims.filter((c) => c.status === "open").length,
      inReview: claims.filter((c) => c.status === "in_review").length,
      resolved: claims.filter((c) => c.status === "resolved").length,
      creditNotes: claims.filter((c) => c.resolution === "credit_note").length,
    }),
    [claims]
  );
  const openCount = kpis.open + kpis.inReview;

  const rows = useMemo(() => {
    const list =
      filter === "abiertos"
        ? claims.filter((c) => isOpenClaim(c.status))
        : filter === "resueltos"
          ? claims.filter((c) => !isOpenClaim(c.status))
          : claims;
    return [...list].sort((a, b) => ((a.dateCreated ?? "") < (b.dateCreated ?? "") ? 1 : -1));
  }, [claims, filter]);

  const pageTitle = "Reclamos a proveedores";
  const pageDescription =
    "Cantidad, calidad, precio u otros: qué está en juego, quién responde y cómo se resuelve. Alimenta la evaluación del proveedor.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver los reclamos reales y gestionarlos contra el servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && claims.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando reclamos">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && claims.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar los reclamos
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const columns: Column<ClaimSummaryView>[] = [
    {
      key: "ref",
      header: "OC / Proveedor",
      render: (c) => (
        <div className="min-w-[150px]">
          <p className="text-sm font-medium text-slate-800">{c.poNumber ?? c.purchaseOrderId}</p>
          <p
            className="text-xs text-slate-500"
            title="Ficha de proveedor disponible al conectar proveedores"
          >
            {c.supplierRef || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "reception",
      header: "Recepción",
      render: (c) =>
        c.receptionId ? (
          <Link
            to={`/recepciones?rid=${encodeURIComponent(c.receptionDisplayId ?? c.receptionId)}`}
            className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.receptionDisplayId ?? c.receptionId}
          </Link>
        ) : (
          <span className="text-xs text-slate-400">Directo a la OC</span>
        ),
    },
    {
      key: "tipo",
      header: "Motivo",
      render: (c) => (
        <div className="min-w-[180px] max-w-[280px]">
          <Badge tone={CLAIM_TYPE_UI[c.type].tone}>{CLAIM_TYPE_UI[c.type].label}</Badge>
          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.description}</p>
        </div>
      ),
    },
    {
      key: "fecha",
      header: "Fecha / cierre",
      hideOnMobile: true,
      render: (c) => (
        <div className="text-sm">
          <p className="text-slate-700">{fmtDate(c.dateCreated)}</p>
          {c.resolvedAt && (
            <p className="text-xs text-slate-400">cerrado {fmtDate(c.resolvedAt)}</p>
          )}
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (c) => (
        <div>
          <Badge tone={CLAIM_STATUS_UI[c.status].tone} dot>
            {CLAIM_STATUS_UI[c.status].label}
          </Badge>
          {c.resolution && (
            <p className="mt-1 text-xs text-slate-500">
              {CLAIM_RESOLUTION_LABEL[c.resolution]}
              {c.creditNoteRef ? ` · ${c.creditNoteRef}` : ""}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button size="sm" variant="secondary" onClick={() => setManaging(c)}>
          Gestionar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={<Button onClick={() => setCreating(true)}>Nuevo reclamo</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Reclamos abiertos"
          value={formatNumber(kpis.open)}
          tone={kpis.open > 0 ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Esperan revisión"
        />
        <KpiCard
          title="En revisión"
          value={formatNumber(kpis.inReview)}
          tone={kpis.inReview > 0 ? "warn" : "neutral"}
          icon={<IconClock className="w-4 h-4" />}
          description="Con el proveedor"
        />
        <KpiCard
          title="Resueltos"
          value={formatNumber(kpis.resolved)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
        />
        <KpiCard
          title="Con nota de crédito"
          value={formatNumber(kpis.creditNotes)}
          tone="good"
          icon={<IconSuppliers className="w-4 h-4" />}
          description="NC solicitadas a Finanzas/SAP"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            { k: "abiertos", label: `Abiertos (${openCount})` },
            { k: "resueltos", label: "Resueltos / rechazados" },
            { k: "todos", label: "Todos" },
          ] as const
        ).map((t) => (
          <Chip key={t.k} active={filter === t.k} onClick={() => setFilter(t.k)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(c) => c.id}
          emptyMessage="Sin reclamos con este filtro. Los reclamos se crean desde una recepción cerrada o con “Nuevo reclamo”."
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {c.poNumber ?? c.purchaseOrderId}
                  </p>
                  <p className="text-xs text-slate-400">
                    {c.supplierRef || "—"}
                    {c.receptionDisplayId ? ` · ${c.receptionDisplayId}` : ""}
                  </p>
                </div>
                <Badge tone={CLAIM_STATUS_UI[c.status].tone} dot={false}>
                  {CLAIM_STATUS_UI[c.status].label}
                </Badge>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone={CLAIM_TYPE_UI[c.type].tone}>{CLAIM_TYPE_UI[c.type].label}</Badge>
                {c.resolution && (
                  <span className="text-xs text-slate-500">
                    {CLAIM_RESOLUTION_LABEL[c.resolution]}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.description}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => setManaging(c)}
              >
                Gestionar
              </Button>
            </div>
          )}
        />
      </Card>

      {managing && (
        <ManageClaimModal
          claim={managing}
          canResolve={canResolve}
          onClose={() => setManaging(null)}
        />
      )}

      {creating && <CreateClaimModal onClose={() => setCreating(false)} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Gestionar reclamo: trae el detalle real (reason + versión fresca) y aplica
//  las transiciones C22. Resolver/rechazar solo con purchase:claim:resolve.
// ----------------------------------------------------------------------------

type ManageMode = "view" | "resolve" | "reject";

function ManageClaimModal({
  claim,
  canResolve,
  onClose,
}: {
  claim: ClaimSummaryView;
  canResolve: boolean;
  onClose: () => void;
}) {
  const { fetchDetail, applyAction } = useClaims();
  const toast = useToast();

  const [detail, setDetail] = useState<ClaimDetailView | null>(null);
  const [mode, setMode] = useState<ManageMode>("view");
  const [resolution, setResolution] = useState<ClaimResolution>("credit_note");
  const [creditNoteRef, setCreditNoteRef] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchDetail(claim.id).then((result) => {
      // Si el detalle falla, el modal sigue operando con el resumen de la lista.
      if (active && result.ok) setDetail(result.claim);
    });
    return () => {
      active = false;
    };
  }, [claim.id, fetchDetail]);

  // Vista vigente: detalle fresco si llegó; si no, el resumen de la lista.
  const view: ClaimSummaryView = detail ?? claim;

  const run = async (body: ClaimPatchBody) => {
    setBusy(true);
    const result = await applyAction(claim.id, view.version, body);
    setBusy(false);
    if (result.ok) {
      setDetail(result.claim);
      if (body.action === "start_review") {
        // El reclamo queda en revisión: el modal sigue abierto para resolverlo.
        toast.success("Revisión iniciada: gestiona la respuesta del proveedor");
        return;
      }
      if (body.action === "resolve") {
        toast.success(
          body.resolution === "credit_note"
            ? "Reclamo resuelto — solicitud de nota de crédito enviada a Finanzas/SAP"
            : "Reclamo resuelto"
        );
      } else {
        toast.success("Reclamo rechazado");
      }
      onClose();
      return;
    }
    const info = result.error;
    if (info.code === "VERSION_CONFLICT") {
      toast.warning("El reclamo cambió en otra sesión; se recargaron los datos");
    } else if (info.code === "CONFLICT") {
      toast.error(describeClaimConflict(info) ?? describePurchaseBffError(info));
    } else {
      toast.error(describePurchaseBffError(info));
      return;
    }
    // Estado o versión obsoletos: refrescar el detalle abierto.
    const fresh = await fetchDetail(claim.id);
    if (fresh.ok) {
      setDetail(fresh.claim);
      setMode("view");
    }
  };

  const submitResolve = () => {
    void run({
      action: "resolve",
      resolution,
      // creditNoteRef solo aplica con nota de crédito (lo valida el dominio).
      ...(resolution === "credit_note" && creditNoteRef.trim()
        ? { creditNoteRef: creditNoteRef.trim() }
        : {}),
    });
  };

  const footer =
    mode === "resolve" ? (
      <>
        <Button variant="secondary" disabled={busy} onClick={() => setMode("view")}>
          Volver
        </Button>
        <Button disabled={busy} onClick={submitResolve}>
          {busy ? "Resolviendo…" : "Confirmar resolución"}
        </Button>
      </>
    ) : mode === "reject" ? (
      <>
        <Button variant="secondary" disabled={busy} onClick={() => setMode("view")}>
          Volver
        </Button>
        <Button disabled={busy || !reason.trim()} onClick={() => void run({ action: "reject", reason: reason.trim() })}>
          {busy ? "Rechazando…" : "Rechazar reclamo"}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        {view.status === "open" && (
          <Button disabled={busy} onClick={() => void run({ action: "start_review" })}>
            {busy ? "Aplicando…" : "Iniciar revisión"}
          </Button>
        )}
        {view.status === "in_review" && canResolve && (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setMode("reject")}>
              Rechazar
            </Button>
            <Button disabled={busy} onClick={() => setMode("resolve")}>
              Resolver
            </Button>
          </>
        )}
      </>
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Gestionar reclamo · ${view.poNumber ?? view.purchaseOrderId}`}
      description={`${CLAIM_TYPE_UI[view.type].label} · ${view.supplierRef || "—"}${
        view.receptionDisplayId ? ` · recepción ${view.receptionDisplayId}` : ""
      }`}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CLAIM_STATUS_UI[view.status].tone} dot>
            {CLAIM_STATUS_UI[view.status].label}
          </Badge>
          <span className="text-xs text-slate-400">
            creado {fmtDate(view.dateCreated)}
            {view.resolvedAt ? ` · cerrado ${fmtDate(view.resolvedAt)}` : ""}
          </span>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {view.description}
        </p>

        {view.status === "resolved" && view.resolution && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Resolución
            </p>
            <p className="mt-0.5 text-sm text-emerald-900">
              {CLAIM_RESOLUTION_LABEL[view.resolution]}
              {view.creditNoteRef ? ` · ${view.creditNoteRef}` : ""}
            </p>
          </div>
        )}

        {view.status === "rejected" && detail?.reason && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Motivo del rechazo
            </p>
            <p className="mt-0.5 text-sm text-slate-700">{detail.reason}</p>
          </div>
        )}

        {mode === "resolve" && (
          <div className="space-y-3">
            <Select
              label="Resolución"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ClaimResolution)}
              options={(Object.keys(CLAIM_RESOLUTION_LABEL) as ClaimResolution[]).map((r) => ({
                value: r,
                label: CLAIM_RESOLUTION_LABEL[r],
              }))}
            />
            {resolution === "credit_note" && (
              <Input
                label="N° de nota de crédito (opcional: la emite Finanzas/SAP)"
                placeholder="NC-2026-0000"
                value={creditNoteRef}
                onChange={(e) => setCreditNoteRef(e.target.value)}
              />
            )}
          </div>
        )}

        {mode === "reject" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Motivo del rechazo (obligatorio)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Ej: la diferencia no es atribuible al proveedor…"
            />
          </div>
        )}

        {mode === "view" && view.status === "in_review" && !canResolve && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <IconLock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span>
              Resolver o rechazar requiere el permiso{" "}
              <b className="text-slate-700">purchase:claim:resolve</b> en tu sesión.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
