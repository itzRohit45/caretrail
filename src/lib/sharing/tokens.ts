import { createHash, randomBytes, randomInt } from "node:crypto";

/** 32 random bytes, base64url. Shown once; only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const isTokenShape = (token: string | null): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
/** Six digits the patient reads out to the doctor. */
export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
