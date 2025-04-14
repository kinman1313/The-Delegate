import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Define JWT payload structure
interface JWTPayload {
  id: string;
  [key: string]: any;
}

// Extend the Request type
export interface AuthRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId;
    id: string;
    [key: string]: any;
  };
  token?: string;
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).send({ error: 'Authentication required' });
    }

    // Verify JWT secret exists
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured in environment');
      return res.status(500).send({ error: 'Server authentication configuration error' });
    }
    
    // Verify the token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // Set user info on request object
    req.user = {
      _id: new mongoose.Types.ObjectId(decoded.id),
      ...decoded
    };
    
    // Store the token for potential use in the route handler
    req.token = token;
    
    next();
  } catch (error: any) {
    // More specific error handling
    if (error.name === 'TokenExpiredError') {
      return res.status(401).send({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).send({ error: 'Invalid token' });
    }
    
    console.error('Authentication error:', error);
    res.status(401).send({ error: 'Please authenticate' });
  }
};