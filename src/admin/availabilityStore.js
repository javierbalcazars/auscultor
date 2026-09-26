import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "../config.js";

const DEFAULT_CACHE_PATH = path.join(DATA_ROOT, ".local", "availability-cache.json");
const VALID_STATES = new Set(["disponible", "reservado", "bloqueado"]);

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeState(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split("-");
    return `${year}-${month}-${day}`;
  }
  return text;
}

function validDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field);
  return fields;
}

export function parseAvailabilityCsv(csv) {
  const lines = String(csv ?? "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines.shift()).map(normalizeHeader);
  const findHeader = (...names) => names.map(normalizeHeader).map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const indexes = {
    date: findHeader("fecha", "date"),
    state: findHeader("estado", "status"),
    client: findHeader("cliente", "nombre visitante", "nombre del visitante", "nombre", "guest"),
    notes: findHeader("notas", "notes", "comentarios"),
    payment: findHeader("pago", "estado de pago", "estado del pago", "payment", "payment status"),
    unit: findHeader("unidad", "cabaña", "cabana", "alojamiento", "unit"),
  };
  if (indexes.date < 0 || indexes.state < 0) return [];
  return lines.map(parseCsvLine).flatMap((fields) => {
    const date = normalizeDate(fields[indexes.date]);
    const state = normalizeState(fields[indexes.state]);
    if (!validDate(date) || !VALID_STATES.has(state)) return [];
    const payment = indexes.payment >= 0 ? String(fields[indexes.payment] ?? "").trim() : "";
    const notes = String(fields[indexes.notes] ?? "").trim();
    const unit = indexes.unit >= 0 ? String(fields[indexes.unit] ?? "").trim().slice(0, 100) : "";
    const record = { date, state, client: String(fields[indexes.client] ?? "").trim().slice(0, 300), notes: [notes, payment ? `Pago: ${payment}` : ""].filter(Boolean).join(" · ").slice(0, 1000) };
    if (unit) record.unit = unit;
    return [record];
  });
}

function readCache(cachePath) {
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (!cache || !Array.isArray(cache.records) || !cache.updatedAt) return null;
    return cache;
  } catch { return null; }
}

function writeCache(cachePath, cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true, mode: 0o700 });
  const temporary = `${cachePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(cache)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, cachePath);
  fs.chmodSync(cachePath, 0o600);
}

export async function readAvailability({ url, cachePath = DEFAULT_CACHE_PATH, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const sheetUrl = String(url || "").trim();
  if (!sheetUrl) return { records: [], updatedAt: null, source: "not-configured", message: "Configura una URL pública de Google Sheets para consultar disponibilidad." };
  const cached = readCache(cachePath);
  try {
    async function download(url, accept = "text/csv") {
      const target = new URL(url);
      target.searchParams.set("_auscultor_refresh", String(Date.now()));
      const response = await fetchImpl(target.toString(), {
        signal: globalThis.AbortSignal?.timeout?.(15000),
        headers: { Accept: accept }, cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    }
    const requestUrl = new URL(sheetUrl);
    let sheets = [];
    if (/\/spreadsheets\/d\/e\/[^/]+\/(pub|pubhtml)$/.test(requestUrl.pathname)) {
      const discoveryUrl = new URL(sheetUrl);
      discoveryUrl.pathname = discoveryUrl.pathname.replace(/\/(pub|pubhtml)$/, "/pubhtml");
      discoveryUrl.search = "";
      const html = await download(discoveryUrl, "text/html");
      sheets = [...html.matchAll(/items\.push\(\{name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/g)]
        .map((match) => ({ name: match[1], gid: match[2] }));
      if (!sheets.length) throw new Error("No se pudieron identificar las pestañas publicadas del documento.");
    }
    const recordsByDate = new Map();
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    for (const sheet of sheets.length ? sheets : [{ name: "", gid: requestUrl.searchParams.get("gid") }]) {
      const target = new URL(sheetUrl);
      target.pathname = target.pathname.replace(/\/pubhtml$/, "/pub");
      target.searchParams.set("output", "csv");
      if (sheet.gid !== null) target.searchParams.set("gid", sheet.gid);
      target.searchParams.set("single", "true");
      const csv = await download(target);
      if (!/^\uFEFF?[^\r\n]*fecha/i.test(csv) && !/^fecha/i.test(csv)) throw new Error(`Formato CSV inválido en ${sheet.name || "la hoja"}.`);
      const rows = parseAvailabilityCsv(csv);
      const month = months.indexOf(normalizeHeader(sheet.name));
      for (const row of rows) {
        if (month >= 0 && Number(row.date.slice(5, 7)) !== month + 1) {
          throw new Error(`La fecha ${row.date} no corresponde a la pestaña ${sheet.name}.`);
        }
        recordsByDate.set(row.date, row);
      }
    }
    const records = [...recordsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const updatedAt = now().toISOString();
    writeCache(cachePath, { url: sheetUrl, updatedAt, records });
    return { records, updatedAt, source: "online", message: "Datos actualizados." };
  } catch (error) {
    if (cached?.url === sheetUrl) {
      return { records: cached.records, updatedAt: cached.updatedAt, source: "cache", message: `Sin conexión, datos de ${cached.updatedAt}.` };
    }
    return { records: [], updatedAt: null, source: "error", message: `No se pudo consultar Google Sheets: ${error.message}` };
  }
}
