/**
 * Guest Controller
 *
 * Handles all guest-related HTTP requests.
 */

import Guest from '../models/guest.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatResponse, createPaginationMeta, parsePagination, buildFilter } from '../utils/helpers.js';

export const getGuests = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

    // Build filter from query params
    const filter = buildFilter(req.query, {
        isVip: { type: 'boolean' },
        city: { type: 'string' },
        country: { type: 'string' },
    });

    // Handle search (text search across multiple fields)
    if (req.query.search) {
        const searchTerm = req.query.search.trim();
        filter.$text = { $search: searchTerm };
    }

    // Execute query with pagination
    const [guests, total] = await Promise.all([
        Guest.find(filter)
            .sort({ lastName: 1, firstName: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Guest.countDocuments(filter),
    ]);

    const meta = createPaginationMeta(page, limit, total);

    res.json(formatResponse(true, guests, 'Guests retrieved successfully', meta));
});

/**
 * GET /api/v1/guests/stats
 * Get guest statistics for dashboard
 */
export const getGuestStats = asyncHandler(async (req, res) => {
    const stats = await Guest.getStats();
    res.json(formatResponse(true, stats, 'Guest statistics retrieved successfully'));
});

/**
 * GET /api/v1/guests/search
 * Search guests
 */
export const searchGuests = asyncHandler(async (req, res) => {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 1) {
        return res.status(400).json(formatResponse(false, null, 'Search query is required'));
    }

    const guests = await Guest.search(q.trim(), { limit: parseInt(limit, 10) });

    res.json(formatResponse(true, guests, 'Guests found'));
});

/**
 * GET /api/v1/guests/:id
 * Get single guest by ID with booking history
 */
export const getGuestById = asyncHandler(async (req, res) => {
    const guest = await Guest.findById(req.params.id).lean();

    if (!guest) {
        return res.status(404).json(formatResponse(false, null, 'Guest not found'));
    }

    // Include recent bookings
    const Booking = (await import('../models/booking.js')).default;
    const bookings = await Booking.find({ guest: guest._id })
        .populate('room', 'roomNumber type pricePerNight')
        .sort({ checkIn: -1 })
        .limit(10)
        .lean();

    res.json(formatResponse(true, { ...guest, recentBookings: bookings }, 'Guest retrieved successfully'));
});

/**
 * POST /api/v1/guests
 * Create a new guest
 */
export const createGuest = asyncHandler(async (req, res) => {
    const guest = await Guest.create(req.body);

    res.status(201).json(formatResponse(true, guest, 'Guest created successfully'));
});

/**
 * PUT /api/v1/guests/:id
 * Update a guest
 */
export const updateGuest = asyncHandler(async (req, res) => {
    const guest = await Guest.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!guest) {
        return res.status(404).json(formatResponse(false, null, 'Guest not found'));
    }

    res.json(formatResponse(true, guest, 'Guest updated successfully'));
});

/**
 * DELETE /api/v1/guests/:id
 * Delete a guest (only if no bookings)
 */
export const deleteGuest = asyncHandler(async (req, res) => {
    const Booking = (await import('../models/booking.js')).default;

    // Check for any bookings
    const bookingCount = await Booking.countDocuments({ guest: req.params.id });

    if (bookingCount > 0) {
        return res.status(409).json(formatResponse(false, null, 'Cannot delete guest with existing bookings'));
    }

    const guest = await Guest.findByIdAndDelete(req.params.id);

    if (!guest) {
        return res.status(404).json(formatResponse(false, null, 'Guest not found'));
    }
    
    res.json(formatResponse(true, null, 'Guest deleted successfully'));
});

export default {
  getGuests,
  getGuestStats,
  searchGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
};