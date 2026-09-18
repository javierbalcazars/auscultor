import test from "node:test";
import assert from "node:assert/strict";
import { buildHumanAlert } from "../src/humanAlert.js";

const FIXED_DATE = new Date("2026-08-25T15:30:45.000Z");

test("incluye solamente la información necesaria para la atención humana", () => {
  const alert = buildHumanAlert({
    remoteJid: "123456@lid",
    contactName: "Cliente",
    text: "Necesito ayuda",
    reason: "Se requiere atención personalizada",
    now: FIXED_DATE,
  });

  assert.match(alert, /Cliente: Cliente/);
  assert.match(alert, /Identificador del chat: 123456@lid/);
  assert.match(alert, /Consulta: Necesito ayuda/);
  assert.match(alert, /Motivo: Se requiere atención personalizada/);
  assert.match(alert, /Hora:/);
  assert.doesNotMatch(alert, /Número del cliente/);
  assert.doesNotMatch(alert, /wa\.me/);
});
