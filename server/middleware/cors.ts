import type { NextFunction, Request, Response } from "express";

export const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
];

export function parseAllowedOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]) {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  return allowedOrigins.includes("*") || allowedOrigins.includes(normalizedOrigin);
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    ...defaultAllowedOrigins,
    ...parseAllowedOrigins(process.env.MSDS_ALLOWED_ORIGINS)
  ];

  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    res.status(origin && isOriginAllowed(origin, allowedOrigins) ? 204 : 403).end();
    return;
  }

  next();
}
