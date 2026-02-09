import { Request, Response, NextFunction } from 'express';

// Error types
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

// Global error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Handle unexpected errors
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred',
  });
};

// Async handler wrapper to catch async errors
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request validation middleware
export const validateRequest = (schema: {
  body?: Record<string, { required?: boolean; type?: string }>;
  params?: Record<string, { required?: boolean; type?: string }>;
  query?: Record<string, { required?: boolean; type?: string }>;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      for (const [field, rules] of Object.entries(schema.body)) {
        const value = req.body[field];
        
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
        } else if (value !== undefined && rules.type) {
          if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          } else if (rules.type === 'number' && typeof value !== 'number') {
            errors.push(`${field} must be a number`);
          } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
            errors.push(`${field} must be a boolean`);
          }
        }
      }
    }

    // Validate params
    if (schema.params) {
      for (const [field, rules] of Object.entries(schema.params)) {
        const value = req.params[field];
        
        if (rules.required && !value) {
          errors.push(`${field} parameter is required`);
        }
      }
    }

    // Validate query
    if (schema.query) {
      for (const [field, rules] of Object.entries(schema.query)) {
        const value = req.query[field];
        
        if (rules.required && !value) {
          errors.push(`${field} query parameter is required`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

// Rate limiting store (simple in-memory)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (options: { windowMs?: number; max?: number } = {}) => {
  const { windowMs = 60000, max = 100 } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    const record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests, please try again later',
      });
    }

    record.count++;
    next();
  };
};
