import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useRole, type Role } from "../../context/RoleContext";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";

// ============================================================================
//  Control de acceso por rol (front).
//  Las vistas de equipo / cross-comprador son exclusivas del Líder de Compras:
//  un comprador solo ve sus propios datos, no los de otros, salvo que tenga el
//  rol con acceso explícito. Si no lo tiene, mostramos un "sin permisos" claro.
// ============================================================================
export function RoleGate({ allow, children }: { allow: Role; children: ReactNode }) {
  const { role } = useRole();
  const navigate = useNavigate();

  if (role === allow) return <>{children}</>;

  return (
    <div className="py-10">
      <EmptyState
        title="Sección del Líder de Compras"
        description="Esta vista muestra datos de todo el equipo (varios compradores). Tu rol actual es Comprador, que solo accede a su propia cartera."
        action={<Button onClick={() => navigate("/")}>Volver al inicio</Button>}
      />
    </div>
  );
}
