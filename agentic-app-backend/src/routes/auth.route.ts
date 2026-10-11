import express from "express";
import { SignJWT } from "jose";
import UserModel from "../models/user.model.js";
import { verifyPassword, hashPassword } from "../utils/password.js";
import { JWT_KEY, JWT_ISSUER, JWT_AUDIENCE, JWT_TTL } from "../config/jwt.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { LoginBody } from "../validation/schemas.js";

const router = express.Router();
const DUMMY_HASH = await hashPassword("dummy-password-for-timing");

router.post("/login", loginLimiter, express.json({ limit: "2kb" }), validate(LoginBody), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = await new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user._id.toString())
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(JWT_TTL)
      .sign(JWT_KEY);

    res.json({ token, expiresIn: JWT_TTL });
  } catch (err) {
    next(err);
  }
});

export default router;