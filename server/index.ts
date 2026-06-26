// ============================================================================
//  Backend real de la Plataforma de Compras.
//  Express + almacén JSON (db.json) sembrado desde los datos mock del front.
//  Expone una API REST genérica por colección + persistencia en disco.
//  Ejecutar: npm run server   (o npm run dev:full para front + back)
// ============================================================================
import express, { type Request, type Response } from "express";
import cors from "cors";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildDb, DB_PATH, ID_FIELD, type Db } from "./seed.js";

const PORT = Number(process.env.PORT ?? 4100);

// Carga el almacén: usa db.json si existe; si no, lo siembra desde el mock.
function loadDb(): Db {
  if (existsSync(DB_PATH)) {
    try {
      return JSON.parse(readFileSync(DB_PATH, "utf8")) as Db;
    } catch {
      console.warn("db.json corrupto, re-sembrando desde el mock");
    }
  }
  const db = buildDb();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return db;
}

const db = loadDb();
let saveTimer: NodeJS.Timeout | null = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeFileSync(DB_PATH, JSON.stringify(db, null, 2)), 150);
}

const idField = (c: string) => ID_FIELD[c] ?? "id";
const exists = (c: string) => Object.prototype.hasOwnProperty.call(db, c);

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Salud + índice de colecciones
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    collections: Object.fromEntries(Object.entries(db).map(([k, v]) => [k, v.length])),
  });
});

// Listar una colección (con filtro ?campo=valor opcional)
app.get("/api/:collection", (req: Request, res: Response) => {
  const { collection } = req.params;
  if (!exists(collection)) return res.status(404).json({ error: `Colección '${collection}' no existe` });
  let rows = db[collection] as Record<string, unknown>[];
  const q = req.query as Record<string, string>;
  for (const [k, v] of Object.entries(q)) {
    rows = rows.filter((r) => String(r[k]) === v);
  }
  res.json(rows);
});

// Obtener por id
app.get("/api/:collection/:id", (req, res) => {
  const { collection, id } = req.params;
  if (!exists(collection)) return res.status(404).json({ error: "Colección no existe" });
  const row = (db[collection] as Record<string, unknown>[]).find((r) => String(r[idField(collection)]) === id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  res.json(row);
});

// Crear
app.post("/api/:collection", (req, res) => {
  const { collection } = req.params;
  if (!exists(collection)) return res.status(404).json({ error: "Colección no existe" });
  const item = req.body as Record<string, unknown>;
  const field = idField(collection);
  if (item[field] == null) item[field] = `${collection}-${Date.now()}`;
  (db[collection] as Record<string, unknown>[]).unshift(item);
  persist();
  res.status(201).json(item);
});

// Actualizar (merge parcial)
app.patch("/api/:collection/:id", (req, res) => {
  const { collection, id } = req.params;
  if (!exists(collection)) return res.status(404).json({ error: "Colección no existe" });
  const rows = db[collection] as Record<string, unknown>[];
  const idx = rows.findIndex((r) => String(r[idField(collection)]) === id);
  if (idx < 0) return res.status(404).json({ error: "No encontrado" });
  rows[idx] = { ...rows[idx], ...(req.body as object) };
  persist();
  res.json(rows[idx]);
});

// Eliminar
app.delete("/api/:collection/:id", (req, res) => {
  const { collection, id } = req.params;
  if (!exists(collection)) return res.status(404).json({ error: "Colección no existe" });
  const rows = db[collection] as Record<string, unknown>[];
  const idx = rows.findIndex((r) => String(r[idField(collection)]) === id);
  if (idx < 0) return res.status(404).json({ error: "No encontrado" });
  const [removed] = rows.splice(idx, 1);
  persist();
  res.json(removed);
});

app.listen(PORT, () => {
  const total = Object.values(db).reduce((a, c) => a + c.length, 0);
  console.log(`\n  Plataforma de Compras · API en http://localhost:${PORT}/api`);
  console.log(`  ${Object.keys(db).length} colecciones · ${total} registros\n`);
});
