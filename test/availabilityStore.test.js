import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseAvailabilityCsv, readAvailability } from "../src/admin/availabilityStore.js";

test("lee disponibilidad válida e ignora fechas desconocidas", () => {
  const records = parseAvailabilityCsv([
    "fecha,estado,cliente,notas",
    "2026-09-25,reservado,Ana,Entrada tarde",
    "2026-09-26,bloqueado,,Mantenimiento",
    "2026-02-30,reservado,Inválido,No debe entrar",
    "2026-09-27,otro,No válido,Estado desconocido",
  ].join("\n"));
  assert.deepEqual(records, [
    { date: "2026-09-25", state: "reservado", client: "Ana", notes: "Entrada tarde" },
    { date: "2026-09-26", state: "bloqueado", client: "", notes: "Mantenimiento" },
  ]);
});

test("acepta el formato publicado por Google Sheets con fecha día-mes-año", () => {
  const records = parseAvailabilityCsv([
    "Fecha,Estado,Nombre visitante,Pago",
    "01-09-2026,Disponible,Cabaña disponible,0",
    "02-09-2026,Reservado,Ana,50000",
  ].join("\n"));
  assert.deepEqual(records, [
    { date: "2026-09-01", state: "disponible", client: "Cabaña disponible", notes: "Pago: 0" },
    { date: "2026-09-02", state: "reservado", client: "Ana", notes: "Pago: 50000" },
  ]);
});

test("acepta la columna Estado de Pago sin perder su valor", () => {
  const records = parseAvailabilityCsv([
    "Fecha,Estado,Nombre del visitante,Estado del Pago",
    "03-09-2026,Reservado,Ana,Pagado",
  ].join("\n"));
  assert.equal(records[0].notes, "Pago: Pagado");
});

test("usa la copia cacheada cuando Google Sheets no responde", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auscultor-availability-"));
  const cachePath = path.join(root, "availability.json");
  const url = "https://docs.google.com/spreadsheets/d/demo/pub?output=csv";
  const first = await readAvailability({
    url,
    cachePath,
    now: () => new Date("2026-09-25T12:00:00Z"),
    fetchImpl: async (requestUrl) => {
      assert.match(requestUrl, /_auscultor_refresh=/);
      return { ok: true, text: async () => "fecha,estado,cliente,notas\n2026-09-25,reservado,Ana," };
    },
  });
  assert.equal(first.source, "online");
  const cached = await readAvailability({ url, cachePath, fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(cached.source, "cache");
  assert.equal(cached.records[0].client, "Ana");
  assert.match(cached.message, /Sin conexión/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("combina pestañas mensuales aunque el enlace no contenga single ni gid", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auscultor-months-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const url = "https://docs.google.com/spreadsheets/d/e/demo/pub?output=csv";
  let failFebruary = false;
  const fetchImpl = async (target) => {
    const u = new URL(target);
    if (u.pathname.endsWith("pubhtml")) return { ok: true, text: async () => 'items.push({name: "Enero", gid: "11"});items.push({name: "Febrero", gid: "22"});' };
    const february = u.searchParams.get("gid") === "22";
    return { ok: !(february && failFebruary), status: 503, text: async () => `Fecha,Estado,Nombre del visitante,Estado del Pago\n01-${february ? "02" : "01"}-2026,${february ? "bloqueado" : "reservado"},,` };
  };
  const options = { url, fetchImpl, cachePath: path.join(root, "cache.json") };
  const first = await readAvailability(options);
  assert.equal(first.source, "online");
  assert.deepEqual(first.records.map(r => [r.date, r.state]), [["2026-01-01", "reservado"], ["2026-02-01", "bloqueado"]]);
  failFebruary = true;
  const second = await readAvailability(options);
  assert.equal(second.source, "cache");
  assert.equal(second.records.length, 2);
});
