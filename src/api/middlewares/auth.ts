import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/application";
import { User } from "../../modules/auth/models/auth.model";
import { UserRole } from "../../modules/auth/models/auth.model";
import { logger } from "../../common/logger/logger";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
        isSuperAdmin?: boolean;
      };
    }
  }
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  isSuperAdmin?: boolean;
}

export async function authRequired(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ success: false, message: "Token not found" });
    return;
  }

  if (!authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ success: false, message: "Invalid authorization format" });
    return;
  }

  const token = authHeader.substring(7);
  if (!token) {
    res.status(401).json({ success: false, message: "Token not found" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    const user = await User.findById(decoded.userId)
      .select("_id role email isSuperAdmin")
      .lean();
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: user.email,
      role: user.role,
      isSuperAdmin: Boolean(user.isSuperAdmin || user.role === UserRole.SUPER_ADMIN),
    };
    next();
  } catch (error) {
    logger.warn({ err: error }, "JWT verification failed");
    res.status(401).json({ success: false, message: "Invalid token" });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const hasPermission =
      roles.includes(req.user.role) ||
      req.user.isSuperAdmin ||
      req.user.role === UserRole.SUPER_ADMIN;
    if (!hasPermission) {
      res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  if (!req.user.isSuperAdmin && req.user.role !== UserRole.SUPER_ADMIN) {
    res
      .status(403)
      .json({ success: false, message: "Unauthorized to perform action" });
    return;
  }
  next();
}
