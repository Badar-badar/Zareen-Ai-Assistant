const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters");
}
export const JWT_KEY = new TextEncoder().encode(secret);
export const JWT_ISSUER = process.env.JWT_ISSUER ?? "zareena-api";
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "zareena-client";
export const JWT_TTL = process.env.JWT_TTL ?? "1h";