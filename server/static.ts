import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Health check at root for deployment - only respond if it looks like a health check request
  app.get("/", (req, res, next) => {
    // If request explicitly asks for JSON or doesn't accept HTML, treat as health check
    const acceptsHtml = req.accepts('html');
    const acceptsJson = req.accepts('json');
    
    if (!acceptsHtml || (acceptsJson && !acceptsHtml)) {
      return res.status(200).json({ status: 'ok', message: 'InvoTech Clinic Management System' });
    }
    
    // Otherwise serve the frontend
    next();
  });

  // fall through to index.html if the file doesn't exist
  // BUT skip this for API routes - let them return 404 if not found
  app.use("*", (req, res) => {
    if (req.originalUrl.startsWith('/api')) {
      // API route not found - let Express handle it (will 404)
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
