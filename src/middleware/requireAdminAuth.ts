import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * Minimal bearer-token guard for admin/dashboard routes.
 * Replace with a real auth solution (sessions, OAuth, etc.) before production
 * if more than one person will use the dashboard.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env.ADMIN_API_TOKEN;

  if (env.NODE_ENV !== "production" && !adminToken) {
    // Allow unauthenticated access in local dev only when no token is configured.
    next();
    return;
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!adminToken || token !== adminToken) {
    res.sendStatus(401);
    return;
  }

  next();
}
