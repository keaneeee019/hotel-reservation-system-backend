/** 
 * Database connection
 * Which it handles MongoDB with Mongoose
 */

import moongose from 'mongoose';
import { config } from './env.js';
import { error } from 'node:console';
import { message } from 'statuses';

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

        moongose.connection.on('disconnected', () => {
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

export default {connectDB};