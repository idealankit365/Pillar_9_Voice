export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, status, code, message, details) {
  if (!condition) throw new AppError(status, code, message, details);
}

export function asAppError(error) {
  return error instanceof AppError ? error : new AppError(500, 'INTERNAL_ERROR', 'The request could not be completed.');
}
