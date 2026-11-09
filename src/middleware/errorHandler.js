/**
 * Global error handling
 * Centralized error handling for all routes
 */

import { isOperationalError } from '../utils/apiError.js';
import config from '../config/env.js';

/**
 * Handle Mongoose validation error
 * @param {Error} error
 * @returns {ValidationError}
 */
function handleMoongoseValidationError(error) {
    const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value,
    }));
    return new ValidationError('Validation failed', errors);
}

/**
 * Handles duplaction key errors
 * @param {Error} error 
 * @returns {ValidationError}
 */
function handleDuplicateKey(error) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return new ValidationError(`${field} '${value}' already exists`, [{
        field,
        message: `${field} already exists`,
        value,
    }]);
}

/**
 * Handles cast errors
 * @param {Error} error 
 * @returns {ValidationError}
 */
function handleCastError(error) {
    return new ValidationError(`Invalid ${error.path}: ${error.value}`, [{
        field: error.path,
        message: `Invalid ${error.path}`,
        value: error.value,
    }]);
}

/**
 * Global error handler
 * @param {Error} err 
 * @param {Request} req 
 * @param {Response} res 
 * @param {Function} next
 */
export async function errorHandler(err, req, res, next) {
    console.error('error: ', {
        name: err.name,
        message: err.message,
        stack: config.isDevelopment() ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });

    let error = err;

    if (!isOperationalError(error)) {
        console.error('Programming Error: ', error);
        if (config.isProduction()) {
            error = new (await import('../utils/apiError.js')).InternalServerError();
        }
    }


    // Handle other errors
    if (err.name === 'ValidationError') {
        error = handleMoongoseValidationError(err);
    } else if (err.code === 11000) {
        error = handleDuplicateKey(err);
    } else if (err.name === 'CastError') {
        error = handleCastError(err);
    }

    // Send error response
    const statusCode = error.statusCode || 500;
    const response = {
        success: false,
        message: error.message,
    };

    if (error.errors) {
        response.errors = error.errors;
    }
    if (config.isDevelopment() && error.stack) {
        response.stack = error.stack;
    }

    res.status(statusCode).json(response);
}

/**
 * Async wrapper to catch errors in route handlers
 * @param {Function} fn
 * @returns {Function}
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next).catch(next));
    };
}

/**
 * 404 Not Found handler
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
}

export default { errorHandler, asyncHandler, notFoundHandler }

