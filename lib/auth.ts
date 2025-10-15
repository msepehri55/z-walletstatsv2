import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev_secret_change_me");
const COOKIE_NAME = "zen_admin";

export const Auth = {
  cookieName: COOKIE_NAME,
  async sign(payload: any, expiresInSec = 60 * 60 * 24 * 2) {
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${expiresInSec}s`)
      .sign(secret);
    return jwt;
  },
  async verify(token?: string) {
    if (!token) return null;
    try {
      const res = await jwtVerify(token, secret);
      return res.payload;
    } catch {
      return null;
    }
  }
};