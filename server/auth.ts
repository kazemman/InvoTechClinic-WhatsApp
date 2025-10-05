import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { User } from '@shared/schema';

const JWT_SECRET = process.env.SESSION_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `sk_${randomBytes.toString('hex')}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    if (token.startsWith('sk_')) {
      const keyHash = hashApiKey(token);
      const apiKey = await storage.getApiKeyByHash(keyHash);
      
      if (!apiKey) {
        return res.status(403).json({ message: 'Invalid API key' });
      }

      const user = await storage.getUser(apiKey.userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ message: 'User not found or inactive' });
      }

      await storage.updateApiKeyLastUsed(apiKey.id);
      req.user = user;
      next();
    } else {
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(403).json({ message: 'Invalid token' });
      }

      const user = await storage.getUser(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ message: 'User not found or inactive' });
      }

      req.user = user;
      next();
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}
