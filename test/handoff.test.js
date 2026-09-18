import test from "node:test";
import assert from "node:assert/strict";
import { isHumanTakeoverActive } from "../src/handoff.js";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const HANDOFF_AT = "2026-08-25T12:00:00.000Z";
const HANDOFF_TIME = new Date(HANDOFF_AT).getTime();

test("mantiene la pausa durante dos horas", () => {
  const conversation = { awaitingHuman: true, humanHandoffAt: HANDOFF_AT };
  assert.equal(isHumanTakeoverActive(conversation, TWO_HOURS_MS, HANDOFF_TIME), true);
  assert.equal(
    isHumanTakeoverActive(conversation, TWO_HOURS_MS, HANDOFF_TIME + TWO_HOURS_MS - 1),
    true
  );
});

test("reactiva la automatización al cumplirse dos horas", () => {
  const conversation = { awaitingHuman: true, humanHandoffAt: HANDOFF_AT };
  assert.equal(
    isHumanTakeoverActive(conversation, TWO_HOURS_MS, HANDOFF_TIME + TWO_HOURS_MS),
    false
  );
});

test("los chats sin derivación permanecen activos", () => {
  assert.equal(
    isHumanTakeoverActive({ awaitingHuman: false, humanHandoffAt: HANDOFF_AT }, TWO_HOURS_MS),
    false
  );
});

test("una fecha inválida conserva la pausa por seguridad", () => {
  assert.equal(
    isHumanTakeoverActive({ awaitingHuman: true, humanHandoffAt: "invalida" }, TWO_HOURS_MS),
    true
  );
});
