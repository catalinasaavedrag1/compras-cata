import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// ============================================================================
//  Hace scroll a un ancla (#seccion) al cambiar la ruta/hash.
//  Necesario bajo BrowserRouter: los <Link to="#riesgo"> no hacen scroll solos.
//  El requestAnimationFrame asegura que el destino ya esté renderizado.
// ============================================================================
export function ScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash, pathname]);
  return null;
}
