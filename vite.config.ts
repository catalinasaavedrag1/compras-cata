import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { env: Record<string, string | undefined> };

// En GitHub Pages la app se sirve bajo /compras-cata/.
// En Vercel u otros hosts se sirve en la raíz (/).
const base = process.env.GHPAGES === "true" ? "/compras-cata/" : "/";

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
});
