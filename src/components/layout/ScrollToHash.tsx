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
    if (hash) {
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      // Nueva vista sin ancla: partir desde arriba (no quedar a media página).
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [hash, pathname]);
  return null;
}
