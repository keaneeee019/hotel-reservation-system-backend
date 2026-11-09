/**
 * Room Routes
 * 
 * Defines all API endpoints for room management
 */

import express from 'express';
import {
    getRooms,
    getRoomStats,
    getAvailableRooms,
    getRoomById,
    createRoom,
    updateRoom,
    toggleAvailability,
    deleteRoom,
} from '../controllers/roomController.js';

const router = express.Router();

// Room list and search

/**
 * @route GET /api/v1/rooms
 * @description Get all rooms with filtering, pagination
 * @query {number} page - Page number default by 1
 * @query {number} limit - Items per page default by 10 and max by 50
 * @query {string} type - Filter room type (single, double, suite, deluxe)
 * @query {boolean} available - Filter by availabilty
 * @query {string} floor - Filter by floor level
 * @query {number} minPrice - Minimum price per night
 * @query {number} maxPrice - Maximum price per night
 * @access Public
 */ 
router.get('/', getRooms);

/**
 * @route GET /api/v1/rooms/stats
 * @description Get room statistics for dashboard
 * @access Public
 */
router.get('/stats', getRoomStats);

/**
 * @route GET /api/v1/rooms/available
 * @description Find available rooms for date range
 * @query {string} checkIn - Check-in date (ISO 8601, required)
 * @query {string} checkOut - Check-out date (ISO 8601, required)
 * @query {string} type - Filter by room type
 * @query {number} minPrice - Minimum price
 * @query {number} maxPrice - Maximum price
 * @query {number} capacity - Minimum capacity
 * @access Public
 */
router.get('/available', getAvailableRooms);

// Single room

/**
 * @route GET /api/v1/rooms/:id
 * @description Get single room by ID
 * @param {string} id - Room ObjectId
 * @access Public
 */
router.get('/:id', getRoomById);

// Create room

/**
 * @route POST /api/v1/rooms
 * @description Create a new room
 * @body {string} roomNumber - Unique room number (required)
 * @body {string} type - Room type: single, double, suite, deluxe (required)
 * @body {number} pricePerNight - Price per night (required)
 * @body {number} capacity - Guest capacity (required, default: 2)
 * @body {string} description - Room description
 * @body {string} floor - Floor number/name
 * @access Private (requires auth in production)
 */
router.post('/', createRoom);

// Update room

/**
 * @route PUT /api/v1/rooms/:id
 * @description Update a room
 * @param {string} id - Room ObjectId
 * @body {string} roomNumber - Unique room number
 * @body {string} type - Room type
 * @body {number} pricePerNight - Price per night
 * @body {number} capacity - Guest capacity
 * @body {string} description - Room description
 * @body {string} floor - Floor number/name
 * @body {boolean} isAvailable - Availability status
 * @access Private (requires auth in production)
 */
router.put('/:id', updateRoom);

/**
 * @route PATCH /api/v1/rooms/:id/availability
 * @description Toggle room availability
 * @param {string} id - Room ObjectId
 * @body {boolean} isAvailable - Availability status (required)
 * @access Private (requires auth in production)
 */
router.patch('/:id/availability', toggleAvailability);

// Delete room

/**
 * @route DELETE /api/v1/rooms/:id
 * @description Delete a room (only if no active bookings)
 * @param {string} id - Room ObjectId
 * @access Private (requires auth in production)
 */
router.delete('/:id', deleteRoom);

export default router;