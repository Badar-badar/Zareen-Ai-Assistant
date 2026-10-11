import type { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { JWT_KEY, JWT_ISSUER, JWT_AUDIENCE } from "../config/jwt.js";

const deny = (res: Response) =>
  res.set("WWW-Authenticate", 'Bearer realm="api"').status(401).json({ error: "Unauthorized" });

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token) return deny(res);
  try {
    const { payload } = await jwtVerify(token, JWT_KEY, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (!payload.sub) return deny(res);
    req.user = { id: payload.sub, role: payload.role as string | undefined };
    next();
  } catch {
    return deny(res);
  }
}