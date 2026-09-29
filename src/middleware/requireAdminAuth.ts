import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";


export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env.ADMIN_API_TOKEN;

  if (env.NODE_ENV !== "production" && !adminToken) {
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
