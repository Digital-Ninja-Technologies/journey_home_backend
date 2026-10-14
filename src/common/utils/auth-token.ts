import { Types } from "mongoose";
import { generateAccessToken, generateRefreshToken } from "./jwt";

export function generateAuthTokens(user: { id: Types.ObjectId; email: string; role: string }) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role
    };

    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload)
    };
}
