import dotenv from "dotenv";

dotenv.config();

import jwt from "jsonwebtoken";
import { JwtPayload } from "../../modules/auth/dto/auth.dto";
import { env } from "../../config/application";

export function generateAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

export function generateRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(
    token,

    env.JWT_REFRESH_SECRET,
  ) as {
    userId: string;

    email: string;

    role: string;
  };
}
