import { SignJWT } from "jose";

const key = (s: string) => new TextEncoder().encode(s);

export interface TokenOpts {
  sub?: string;
  secret?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string | number;
  alg?: "HS256" | "HS512";
}

export async function makeToken(o: TokenOpts = {}) {
  const jwt = new SignJWT({ role: "user" })
    .setProtectedHeader({ alg: o.alg ?? "HS256" })
    .setIssuer(o.issuer ?? "zareena-api")
    .setAudience(o.audience ?? "zareena-client")
    .setIssuedAt()
    .setExpirationTime(o.expiresIn ?? "1h");
  if (o.sub !== undefined || !("sub" in o)) jwt.setSubject(o.sub ?? "507f1f77bcf86cd799439011");
  return jwt.sign(key(o.secret ?? process.env.JWT_SECRET!));
}

// A token that claims "alg: none" (unsigned). A secure server must refuse it.
export function unsignedToken() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    sub: "507f1f77bcf86cd799439011", iss: "zareena-api", aud: "zareena-client", iat: now, exp: now + 3600,
  })}.`;
}