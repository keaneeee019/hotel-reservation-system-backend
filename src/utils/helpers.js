/**
 * Helper utilities functions across the application
 */

import { parse } from "dotenv";

/**
 * Formatting consistenst API response
 * @param {boolean} success
 * @param {*} data
 * @param {string} message
 * @param {object} meta
 * @returns {Object}
 */

export function formatResponse(success, data, message = '', meta = {}) {
    const response = { success };
    if (message) response.message = message;
    if (data !== undefined && data !== null) response.data = data;
    if (Object.keys(meta).length > 0) response.meta = meta;
    return response;
}

/**
 * Creates pagination metadata
 * @param {number} page 
 * @param {number} limit 
 * @param {number} total 
 * @returns {Object} 
 */
export function createPaginationMeta(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    return {
        pagnation: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        }
    };
}

/**
 * Parses and validates pagination query params
 * @param {Object} query 
 * @param {Object} options 
 * @returns {Object}
 */

export function parsePagination(query, options = {}) {
    const defaultLimit = options.defaultLimit || 10;
    const maxLimit = options.maxLimit || 100;

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.min(1, parseInt(query.limit, 10) || defaultLimit));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
}

/**
 * Builds MongoDB filter object from query params
 * @param {Object} query 
 * @param {Object} allowedFilters 
 * @returns {Object}
 */
export function buildFilter(query, allowedFilters) {
    const filter = {};

    for (const [key, config] of Object.entries(allowedFilters)) {
        const value = query[key];
        if (value === undefined || value === '') continue;

        switch (config.type) {
            case 'string':
                filter[key] = { $regex: value, $options: 'i' };
                break;
            case 'exact':
                filter[key] = value;
                break;
            case 'number':
                filter[key] = parseFloat(value);
                break;
            case 'boolean':
                filter[key] = value === 'true';
                break;
            case 'enum':
                if (config.values.includes(value)) {
                    filter[key] = value;
                }
                break;
            case 'date':
                filter[key] = new Date(value);
                break;
            case 'dateRange':
                if (query.startDate || query.endDate) {
                    filter[key] = {};
                    if (query.startDate) filter[key].$gte = new Date(query.startDate);
                    if (query.endDate) filtetr[key].$lte = new Date(query.endDate);
                }
                break;
        }
    }

    return filter;
}

/**
 * Removing undefined or null values
 * @param {Object} obj 
 * @returns {Object}
 */
export function sanitizedObject(obj) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null && value !== '') {
            sanitized[key] =  value;
        }
    }

    return sanitized;
}

/**
 * Calculates nights between two dates
 * @param {Date|sting} checkIn
 * @param {Date|sting} checkOut
 * @returns {number}
 */
export function calculateNights(checkIn, checkOut) {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    const diffTime = outDate - inDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generates unique booking reference
 * @returns {string}
 */
export function generateBookingReference() {
    const timestamp = Date.now().toString(36).toUpperCase;
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BK-${timestamp}-${random}`;
}

export default {
    formatResponse,
    createPaginationMeta,
    parsePagination,
    buildFilter,
    sanitizedObject,
    calculateNights,
    generateBookingReference,

};