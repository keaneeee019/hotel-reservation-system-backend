/**
 * Express setup
 * The core foundation for app configuration
 * Separated from server entry point
 */

import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

import roomRoutes from './routes/roomRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import guestRoutes from './routes/guestRoutes.js';

/**
 * Configure the express application
 * @returns {express.Application}
 */
export function createApp() {
    const app = express();

    app.use(cors(config.cors));

    // Health check
    app.get('/health', (req, res) => {
        res.json({
            success: true,
            message: 'Hotel Reservation API is running',
            timestamp: new Date().toISOString(),
            environment: config.nodeEnv,
        });
    });

    // API routes
    const apiPrefix = '/api/v1';
    app.use(`${apiPrefix}/rooms`, roomRoutes);
    app.use(`${apiPrefix}/bookings`, bookingRoutes);
    app.use(`${apiPrefix}/guests`, guestRoutes);

    // API documentation redirect
    app.get('/api', (req, res) => {
        res.json({
           success: true, 
           message: 'Hotel reservation system API',
           version: '1.0.0',
           documentation: '/api/docs',
           endpoints: {
                rooms: `${apiPrefix}/rooms`,
                booking: `${apiPrefix}/bookings`,
                guest: `${apiPrefix}/guests`,
           },
        });
    });

    // 404 Handler 
    app.use(notFoundHandler);
    
    // Global Error Handler
    app.use(errorHandler);
    
    return app;
}

export default createApp;