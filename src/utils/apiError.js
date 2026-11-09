/**
 * API error handling with status codes and operation flags
 */

export class ApiError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = this.constructor.name;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class BadRequestError extends ApiError {
    constructor(message = 'Bad request') {
        super(message, 400);
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

export class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

export class ConflictError extends ApiError {
    constructor(message = 'Resource conflict') {
        super(message, 409);
    }
}

export class InternalServerError extends ApiError {
    constructor(message = 'Internal server error') {
        super(message, 500);
    }
}

export class ValidationError extends ApiError {
    constructor(message = 'Validation failed', errors = []) {
        super(message, 400);
        this.errors = errors;
    }
}

export class ServiceUnavailableError extends ApiError {
    constructor(message = 'Service unavailable') {
        super(message, 503);
    }
}

/**
 * Checks if operational ApiError
 * @param {Error} error
 * @returns {boolean}
 */
export function isOperationalError(error) {
    return error instanceof ApiError && error.isOperational;
}

export default {
    ApiError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    InternalServerError,
    ValidationError,
    ServiceUnavailableError,
    isOperationalError,
};