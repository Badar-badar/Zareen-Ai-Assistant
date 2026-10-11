import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const validate =
  (schema: z.ZodType, source: "body" | "query" | "params" = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid request", details: z.flattenError(result.error) });
    }
    if (source === "body") req.body = result.data;
    next();
  };