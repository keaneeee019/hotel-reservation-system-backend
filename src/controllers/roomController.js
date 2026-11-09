/**
 * Room Controller
 *
 * Handles all room-related HTTP requests
 */

import Room from '../models/room.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatResponse, createPaginationMeta, parsePagination, buildFilter } from '../utils/helpers.js';

/**
 * GET /api/v1/rooms
 * List all rooms with filtering, pagination, and search
 */
export const getRooms = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    
    // Build filter from query params
    const filter = buildFilter(req.query, {
        type: { type: 'enum', values: ['single', 'double', 'suite', 'deluxe'] },
        isAvailable: { type: 'boolean' },
        floor: { type: 'string' },
        minPrice: { type: 'number' },
        maxPrice: { type: 'number' },
    });

    if (req.query.minPrice || req.query.maxPrice) {
        filter.pricePerNight = {};
        if (req.query.minPrice) filter.pricePerNight.$gte = parseFloat(req.query.minPrice);
        if (req.query.maxPrice) filter.pricePerNight.$lte = parseFloat(req.query.maxPrice);
    }

    // Execute query with pagination
    const [rooms, total] = await Promise.all([
        Room.find(filter)
            .sort({ roomNumber: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Room.countDocuments(filter),
    ]);

    const meta = createPaginationMeta(page, limit, total);

    res.json(formatResponse(true, rooms, 'Rooms retrieved successfully', meta));
});

/**
 * GET /api/v1/rooms/stats
 * Get room statistics for dashboard
 */
export const getRoomStats = asyncHandler(async (req, res) => {
    const stats = await Room.getStats();
    res.json(formatResponse(true, stats, 'Room statistics retrieved successfully'));
});

/**
 * GET /api/v1/rooms/available
 * Find available rooms for date range
 */
export const getAvailableRooms = asyncHandler(async (req, res) => {
    const { checkIn, checkOut, ...filters } = req.query;

    if (!checkIn || !checkOut) {
        return res.status(400).json(formatResponse(false, null, 'checkIn and checkOut are required'));
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkOutDate <= checkInDate) {
        return res.status(400).json(formatResponse(false, null, 'Check-out must be after check-in'));
    }

    const rooms = await Room.findAvailable(checkInDate, checkOutDate, filters);

    res.json(formatResponse(true, rooms, 'Available rooms retrieved successfully'));
});

/**
 * GET /api/v1/rooms/:id
 * Get single room by ID
 */
export const getRoomById = asyncHandler(async (req, res) => {
    const room = await Room.findById(req.params.id).lean();

    if (!room) {
        return res.status(404).json(formatResponse(false, null, 'Room not found'));
    }

    res.json(formatResponse(true, room, 'Room retrieved successfully'));
});

/**
 * POST /api/v1/rooms
 * Create a new room
 */
export const createRoom = asyncHandler(async (req, res) => {
    const room = await Room.create(req.body);

    res.status(201).json(formatResponse(true, room, 'Room created successfully'));
});

/**
 * PUT /api/v1/rooms/:id
 * Update a room
 */
export const updateRoom = asyncHandler(async (req, res) => {
    const room = await Room.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!room) {
        return res.status(404).json(formatResponse(false, null, 'Room not found'));
    }

    res.json(formatResponse(true, room, 'Room updated successfully'));
});

/**
 * PATCH /api/v1/rooms/:id/availability
 * Toggle room availability
 */
export const toggleAvailability = asyncHandler(async (req, res) => {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
        return res.status(400).json(formatResponse(false, null, 'isAvailable must be a boolean'));
    }

    const room = await Room.findByIdAndUpdate(
        req.params.id,
        { isAvailable },
        { new: true, runValidators: true }
    );

    if (!room) {
        return res.status(404).json(formatResponse(false, null, 'Room not found'));
    }

    res.json(formatResponse(true, room, `Room marked as ${isAvailable ? 'available' : 'unavailable'}`));
});

/**
 * DELETE /api/v1/rooms/:id
 * Delete a room (only if no active bookings)
 */
export const deleteRoom = asyncHandler(async (req, res) => {
    const Booking = (await import('../models/booking.js')).default;

    // Check for active bookings
    const activeBooking = await Booking.findOne({
        room: req.params.id,
        status: { $in: ['pending', 'confirmed', 'checked-in'] },
    });

    if (activeBooking) {
        return res.status(409).json(formatResponse(false, null, 'Cannot delete room with active bookings'));
    }

    const room = await Room.findByIdAndDelete(req.params.id);

    if (!room) {
        return res.status(404).json(formatResponse(false, null, 'Room not found'));
    }

    res.json(formatResponse(true, null, 'Room deleted successfully'));
});

export default {
  getRooms,
  getRoomStats,
  getAvailableRooms,
  getRoomById,
  createRoom,
  updateRoom,
  toggleAvailability,
  deleteRoom,
};