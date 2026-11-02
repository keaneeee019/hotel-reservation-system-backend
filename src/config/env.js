/** Centralize all environment variables with validation and default
 * which prevents undefined errors
 */

if (process.env.NODE_ENV !== 'production') {
    import('dotenv').then(dotenv => dotenv.config())
}

/**
 * Validation required env variables 
 * @param {string[]} required
   @throws {Error}
 */

function validateEnv(required) {
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
       throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    } 
}

const requiredVar = ['MONGODB_URI'];

export const config = {

    // Server
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database using Mongodb
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-reservation',
        options: {
            maxPool: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }
    },

    // Rate limit for 15 minutes 
    rateLimit: {
        windowMS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10 ) || 900000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUEST, 10) || 100,
    }

};

export default config;