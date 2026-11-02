/**
 * Entry point for application
 * Starts http server and connect to database
 */

import { createApp } from './app.js';
import config from './config/env.js';
import { connectDB } from './config/database.js'

let server;

async function startServer() {
    try {
        // Connect to database
        await connectDB();

        const app = createApp();

        // Start http server
        server = app.listen(config.port, () => {
            console.log(`
                Hotel Reservation System API
                Server running on port ${config.port}
                Environment: ${config.nodeEnv.padEnd(36)}
                API URL: http://localhost:${config.port}/api/v1
                `);
        });

        //Handle server error
        server.on('error', (error) => {
            if (error.code === 'Adress in use'){
                console.error(`Port ${config.port} is already in use`);
            } else {
                console.error('Server error:', error);
            }
         process.exit(1);

        });
    }
    catch (error) {
        console.error('Failed to start error:', error);
        process.exit(1);
    }
}

startServer();

export {server};
