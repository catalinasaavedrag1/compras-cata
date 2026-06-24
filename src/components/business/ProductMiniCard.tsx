import { Link } from "react-router-dom";
import type { Product } from "../../types/purchasing";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import { StatusBadge } from "./StatusBadge";
import { IconChevronRight } from "../ui/icons";

interface ProductMiniCardProps {
  product: Product;
}

export function ProductMiniCard({ product }: ProductMiniCardProps) {
  return (
    <Link
      to={`/productos/${product.sku}`}
      className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">{product.sku}</span>
          <StatusBadge kind="purchase" value={product.purchaseStatus} dot={false} />
        </div>
        <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Disp. {formatNumber(product.availableStock)} · Vende{" "}
          {formatNumber(product.salesLast30Days)}/mes · {formatCurrency(product.price)}
        </p>
      </div>
      <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 flex-shrink-0" />
    </Link>
  );
}
