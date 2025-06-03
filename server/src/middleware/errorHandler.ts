import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean; // To distinguish between operational errors and programmer errors
  errorCode?: string;      // Optional: for specific error codes like 'VALIDATION_ERROR'
}

const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
): void => {
  // Log the error (extensible for more robust logging)
  console.error('------------------------------------------------------');
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`Path: ${req.path}`);
  console.error(`Method: ${req.method}`);
  // In a real app, you might want to log req.body, req.query, req.params carefully, redacting sensitive info
  // console.error(`Request Body: ${JSON.stringify(req.body)}`); // Be cautious with logging request bodies

  if (err.stack) {
    console.error(`Stacktrace: ${err.stack}`);
  } else {
    console.error(`Error: ${err.message}`);
  }
  console.error('------------------------------------------------------');


  // Determine status code
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred on the server.';
  let errorType = 'ServerError';

  // Handle specific error types (e.g., Mongoose validation errors, JWT errors, etc.)
  if (err.name === 'ValidationError') { // Example: Mongoose validation error
    statusCode = 400;
    message = Object.values((err as any).errors).map((e: any) => e.message).join(', ');
    errorType = 'ValidationError';
  } else if (err.name === 'CastError' && (err as any).kind === 'ObjectId') { // Example: Mongoose CastError for ObjectId
    statusCode = 400;
    message = `Invalid ID format: ${(err as any).value}`;
    errorType = 'InvalidIdFormatError';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
    errorType = 'JsonWebTokenError';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
    errorType = 'TokenExpiredError';
  }
  // Add more specific error type checks as needed

  // For operational errors, use the error's message and status code directly if provided
  if (err.isOperational) {
    message = err.message;
    statusCode = err.statusCode || 500;
  } else {
    // For non-operational (programmer errors) or unknown errors, avoid leaking details
    if (statusCode === 500 && process.env.NODE_ENV === 'production') {
      message = 'An internal server error occurred. Please try again later.';
    }
  }


  res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail', // 'fail' for 4xx, 'error' for 5xx
    errorType: errorType, // Provides a more specific error type string
    message: message,
    // Optionally include stack in development
    ...(process.env.NODE_ENV === 'development' && err.stack && { stack: err.stack }),
    // Optionally include errorCode if defined
    ...(err.errorCode && { errorCode: err.errorCode }),
  });
};

// Utility class for creating operational errors
export class OperationalError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Mark as an operational error
    this.errorCode = errorCode;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default errorHandler;
