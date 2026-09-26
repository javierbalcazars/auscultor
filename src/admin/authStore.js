import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { ENV_PATH } from "../config.js";

const MIN_PASSWORD_LENGTH = 6;
const sessions = new Map();

function readEnv() {
  return fs.existsSync(ENV_PATH) ? dotenv.parse(fs.readFileSync(ENV_PATH)) : {};
}

function saveEnv(values) {
  fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true, mode: 0o700 });
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value ?? "")}`);
  const temporary = `${ENV_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${lines.join("\n")}\n`, { mode: 0o600 });
  fs.renameSync(temporary, ENV_PATH);
  fs.chmodSync(ENV_PATH, 0o600);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

function matches(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function authStatus() {
  const env = readEnv();
  return { setupRequired: !env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH, username: env.ADMIN_USERNAME || "" };
}

export function setupAdmin(username, password) {
  const current = readEnv();
  if (current.ADMIN_USERNAME && current.ADMIN_PASSWORD_HASH) throw new Error("El administrador ya está configurado");
  const name = String(username || "").trim();
  const secret = String(password || "");
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(name)) throw new Error("El nombre de usuario no es válido");
  if (secret.length < MIN_PASSWORD_LENGTH) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  saveEnv({ ...current, ADMIN_USERNAME: name, ADMIN_PASSWORD_HASH: hashPassword(secret) });
  return name;
}

export function loginAdmin(username, password) {
  const env = readEnv();
  if (String(username) !== env.ADMIN_USERNAME || !matches(String(password || ""), env.ADMIN_PASSWORD_HASH)) throw new Error("Usuario o contraseña incorrectos");
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now());
  return token;
}

export function verifyAdminPassword(password) {
  const env = readEnv();
  return matches(String(password || ""), env.ADMIN_PASSWORD_HASH);
}

export function isAuthenticated(token) {
  const created = sessions.get(token);
  if (!created) return false;
  if (Date.now() - created > 12 * 60 * 60 * 1000) { sessions.delete(token); return false; }
  return true;
}

export function logoutAdmin(token) { sessions.delete(token); }
