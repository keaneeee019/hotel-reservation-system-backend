/** 
 * Database connection
 * Which it handles MongoDB with Mongoose
 */

import mongoose from 'mongoose';
import { config } from './env.js';
//import { error } from 'node:console';
//import { message } from 'statuses';

/**
 * Connect to MongoDB with Mongoose instance
 * @returns {Promise<mongoose.Connection>}
 */

export async function connectDB() {
    try {
        mongoose.set('strictQuery', true );

        // Connection options
        const options = {
            ...config.mongodb.options,
            autoIndex: config.isDevelopment(),
            bufferCommands: false,
        };

        const connect = await mongoose.connect(config.mongodb.uri, options);

        console.log(`MongoDB Connected: ${connect.connection.host}`);
        console.log(`Database ${connect.connection.name}`);

        mongoose.connection.on('error', (err)=> {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

        return connect.connection;
    }
    catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

/**
 * Health check
 * @returns {boolean}
 */
export function isConnected() {
    return moongose.connection.readyState === 1;
}

/**
 * Get connection stats
 * @returns {Object}
 */
export function getConnection() {
    const connect = mongoose.connection;
    return {
        readyState: connect.readyState,
        host: connect.host,
        name: connect.name,
        collections: Object.keys(connect.collections).length,
    };
}
export default {connectDB, isConnected, getConnection};