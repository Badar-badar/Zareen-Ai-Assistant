import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const OPTS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, 64, OPTS)) as Buffer;
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [s, h] = stored.split(":");
  if (!s || !h) return false;
  const expected = Buffer.from(h, "base64");
  const actual = (await scryptAsync(password, Buffer.from(s, "base64"), expected.length, OPTS)) as Buffer;
  return timingSafeEqual(actual, expected);
}