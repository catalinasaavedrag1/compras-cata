import type { BadgeTone } from "../ui/Badge";
import type { Priority, RecommendationStatus } from "../../types/purchasing";

// ============================================================================
//  Significado de cada estado y prioridad en lenguaje de negocio.
//  Se usa en leyendas, tooltips y textos de ayuda para que un comprador
//  entienda qué significa cada etiqueta sin tecnicismos.
// ============================================================================

export interface StateMeaning {
  label: string;
  description: string;
  tone: BadgeTone;
}

export const recommendationMeaning: Record<RecommendationStatus, StateMeaning> = {
  critical: {
    label: "Crítico",
    description:
      "Sin stock disponible o con riesgo inmediato de quiebre. Requiere comprar de inmediato.",
    tone: "red",
  },
  buy_now: {
    label: "Comprar ahora",
    description:
      "Stock bajo considerando las ventas recientes y los días de entrega del proveedor.",
    tone: "amber",
  },
  review: {
    label: "Revisar",
    description: "Necesita análisis del comprador antes de generar una compra.",
    tone: "blue",
  },
  normal: {
    label: "Normal",
    description: "Stock suficiente para la venta esperada. No requiere acción.",
    tone: "green",
  },
  overstock: {
    label: "Sobrestock",
    description: "Hay más inventario del necesario según la rotación actual. No conviene comprar.",
    tone: "violet",
  },
};

export const priorityMeaning: Record<Priority, StateMeaning> = {
  high: {
    label: "Alta",
    description: "Atender hoy. Impacto directo en venta o quiebre inminente.",
    tone: "red",
  },
  medium: {
    label: "Media",
    description: "Atender esta semana. Riesgo moderado.",
    tone: "amber",
  },
  low: {
    label: "Baja",
    description: "Puede esperar. Sin riesgo relevante en el corto plazo.",
    tone: "neutral",
  },
};

/** Orden de urgencia para ordenar tablas (menor = más urgente). */
export const recommendationUrgency: Record<RecommendationStatus, number> = {
  critical: 0,
  buy_now: 1,
  review: 2,
  normal: 3,
  overstock: 4,
};

export const priorityUrgency: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
