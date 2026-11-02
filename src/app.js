/**
 * Express setup
 * The core foundation for app configuration
 * Separated from server entry point
 */

import express from 'express';
import config from './config/env.js';

// import roomRoutes from './routes/roomRoutes.js';
// import bookingRoutes from './routes/bookingRoutes.js';
// import guestRoutes from './routes/guestRoutes.js';
// import { message } from 'statuses';

/**
 * Configure express app
 * @returns {express.Application}
 */
export function createApp() {
    const app = express();

    // API routes
    const apiPrefix = '/api/v1';
    app.use(`${apiPrefix}/rooms`, roomRoutes);
    app.use(`${apiPrefix}/bookings`, bookingRoutes);
    app.use(`${apiPrefix}/guest`, guestRoutes);

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
}