// Fecha "de hoy" de la demo (datos mock al 24/06/2026).
export const TODAY_ISO = "2026-06-24";

// Días objetivo de inventario por defecto cuando una regla no define uno propio.
export const DEFAULT_TARGET_COVERAGE_DAYS = 45;

// Umbral (CLP) sobre el cual el monto pendiente de un proveedor se marca en alerta.
export const SUPPLIER_PENDING_WARN_CLP = 20_000_000;

// Cumplimiento de entrega (%) del proveedor: bajo el crítico es rojo, bajo el
// de advertencia es ámbar. Sobre el de advertencia, sano.
export const SUPPLIER_COMPLIANCE_CRITICAL = 70;
export const SUPPLIER_COMPLIANCE_WARN = 85;

// Lead time (días) a partir del cual el plazo del proveedor se marca en alerta.
export const SUPPLIER_LEAD_TIME_WARN_DAYS = 15;
