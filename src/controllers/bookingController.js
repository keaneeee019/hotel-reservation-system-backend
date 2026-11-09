/**
 * 
 * Controls booking
 * 
 * Handles all booking related http requests
 */

import Booking from '../models/booking.js';
import Room from '../models/room.js';
import Guest from '../models/guest.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatResponse, createPaginationMeta, parsePagination, buildFilter, calculateNights } from '../utils/helpers.js';

/**
 * GET /api/v1/bookings
 * List all bookings with pagnation, filtering
 */
export const getBookings = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

    const filter = buildFilter(req.query, {
        status: { type: 'enum', values: ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'] },
        guestId: { type: 'exact' },
        roomId: { type: 'exact' },
    });

    // Date range filters
    if (req.query.checkIn || req.query.checkOut) {
        filter.$or = [];
        if (req.query.checkIn) {
            filter.$or.push({ checkIn: { $gte: new Date(req.query.checkIn) } });
        }
        if (req.query.checkOut) {
            filter.$or.push({ checkOut: { $lte: new Date(req.query.checkOut) } });
        }
        if (filter.$or.length === 1) delete filter.$or;
    }

    const [bookings, total] = await Promise.all([
        Booking.find(filter)
            .populate('guest', 'firstName lastName phone')
            .populate('room', 'roomNumber type pricePerNight')
            .sort({ checkIn: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        Booking.countDocuments(filter),
    ]);

    const meta = createPaginationMeta(page, limit, total);

    res.json(formatResponse(true, bookings, 'Bookings retrieved successfully', meta));
});

/**
 * GET /api/v1/bookings/stats
 * Statistics for dashboard
 */
export const getBookingStats = asyncHandler(async (req, res) => {
    const [total, pending, confirmed, checkedIn, checkedOut, cancelled, noShow] = await Promise.all([
        Booking.countDocuments(),
        Booking.countDocuments({ status: 'pending' }),
        Booking.countDocuments({ status: 'confirmed' }),
        Booking.countDocuments({ status: 'checked-in' }),
        Booking.countDocuments({ status: 'checked-out' }),
        Booking.countDocuments({ status: 'cancelled' }),
        Booking.countDocuments({ status: 'no-show' }),
    ]);

    const stats = {
        total,
        byStatus: {
            pending,
            confirmed,
            'checked-in': checkedIn,
            'checked-out': checkedOut,
            cancelled,
            'no-show': noShow,
        },
    };

    res.json(formatResponse(true, stats, 'Booking statistics retrieved successfully'));
});

export const getTodayCheckIns = asyncHandler(async (req, res) => {
    const bookings = await Booking.getTodaysCheckIns();
    res.json(formatResponse(true, bookings, 'Today\'s check-ins retrieved successfully'));
});

export const getTodayCheckOuts = asyncHandler(async (req, res) => {
    const bookings = await Booking.getTodaysCheckOuts();
    res.json(formatResponse(true, bookings, 'Today\'s check-outs retrieved successfully'));
});

// Get occupancy rate for date range
export const getOccupancy = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json(formatResponse(false, null, 'startDate and endDate required'));
    }

    const occupancy = await Booking.getOccupancyRate(new Date(startDate), new Date(endDate));
    res.json(formatResponse(true, occupancy, 'Occupancy rate retrieved successfully'));
});

// Get single booking by ID
export const getBookingById = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate('guest', 'firstName lastName phone city country')
        .populate('room', 'roomNumber type pricePerNight capacity')
        .lean();

    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

    res.json(formatResponse(true, booking, 'Booking retrieved successfully'));
});

/**
 * POST /api/v1/bookings
 * Create new booking
 */

export const createBooking = asyncHandler(async (req, res) => {
    const { guestId, roomId, checkIn, checkOut, guestCount, source } = req.body;

    const guest = await Guest.findById(guestId);
    if (!guest) {
        return res.status(404).json(formatResponse(false, null, 'Guest not found'));
    }

    const room = await Room.findById(roomId);
    if (!room) {
        return res.status(404).json(formatResponse(false, null, 'Room not found'));
    }

    const isAvailable = await Booking.isRoomAvailable(roomId, new Date(checkIn), new Date(checkOut));
    if (!isAvailable) {
        return res.status(409).json(formatResponse(false, null, 'Room is not available for the selected dates'));
    }

    const nights = calculateNights(checkIn, checkOut);
    const pricePerNight = room.pricePerNight;
    const totalPrice = nights * pricePerNight;

    // Create booking
    const booking = await Booking.create({
        guest: guestId,
        room: roomId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        nights,
        pricePerNight,
        totalPrice,
        guestCount: guestCount || 1,
        source: source || 'direct',
        status: 'pending',
    });

    await booking.populate('guest', 'firstName lastName phone');
    await booking.populate('room', 'roomNumber type pricePerNight');

    res.status(201).json(formatResponse(true, booking, 'Booking created successfully'));
});

/**
 * PUT /api/v1/bookings/:id
 * Update booking
 */

export const updateBooking = asyncHandler(async (req, res) => {
    const { checkIn, checkOut, roomId, guestId, ...updateData } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

    // If dates or room changing, re-validate availability
    if (checkIn || checkOut || roomId) {
        const newCheckIn = checkIn ? new Date(checkIn) : booking.checkIn;
        const newCheckOut = checkOut ? new Date(checkOut) : booking.checkOut;
        const newRoomId = roomId || booking.room;

        if (newCheckOut <= newCheckIn) {
            return res.status(400).json(formatResponse(false, null, 'Check-out must be after Check-in'));
        }

        const isAvailable = await Booking.isRoomAvailable(newRoomId, newCheckIn, newCheckOut, booking._id);
        if (!isAvailable) {
            return res.status(409).json(formatResponse(false, null, 'Room is not available'));
        }

        // Update price if changes in room or dates
        if (roomId || checkIn || checkOut) {
            const room = await Room.findById(newRoomId);
            const nights = calculateNights(newCheckIn, newCheckOut);
            updateData.pricePerNight = room.pricePerNight;
            updateData.totalPrice = nights * room.pricePerNight;
            updateData.nights = nights;
        }
    }

    // Update booking
    Object.assign(booking, updateData);
    if (checkIn) booking.checkIn = new Date(checkIn);
    if (checkOut) booking.checkOut = new Date(checkOut);
    if (roomId) booking.room = roomId;
    if (guestId) booking.guest = guestId;

    await booking.save();

    await booking.populate('guest', 'firstName lastName phone');
    await booking.populate('room', 'roomNumber type pricePerNight');

    res.json(formatResponse(true, booking, 'Booking updated successfully'));
});

/**
 * PATCH /api/v1/bookings/:id/check-in
 * Check in a guest
 */
export const checkIn = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

    try {
        await booking.performCheckIn();
        await booking.populate('guest', 'firstName lastName email phone');
        await booking.populate('room', 'roomNumber type');
        res.json(formatResponse(true, booking, 'Guest checked in successfully'));
    } catch (error) {
        return res.status(400).json(formatResponse(false, null, error.message));
    }
});

// PATCH Check out a guest
export const checkOut = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

    try {
        await booking.performCheckOut();
        await booking.populate('guest', 'firstName lastName phone');
        await booking.populate('room', 'roomNumber type');
        res.json(formatResponse(true, booking, 'Guest checked out successfully'));
    } catch (error) {
        return res.status(400).json(formatResponse(false, null, error.message));
    }
});

// PATCH Cancel a booking
export const cancelBooking = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

    try {
        await booking.cancel(reason);
        res.json(formatResponse(true, booking, 'Booking cancelled successfully'));
    } catch (error) {
        return res.status(400).json(formatResponse(false, null, error.message));
    }
});

// PATCH Mark booking as no show
export const markNoShow = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

    try {
        await booking.markNoShow();
        res.json(formatResponse(true, booking, 'Booking marked as no-show'));
    } catch (error) {
        return res.status(400).json(formatResponse(false, null, error.message));
    }
});

/**
 * DELETE /api/v1/bookings/:id
 * Delete a booking
 */
export const deleteBooking = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

    if (!['pending', 'cancelled'].includes(booking.status)) {
        return res.status(400).json(formatResponse(false, null, 'Can only delete pending or cancelled bookings'));
    }

    await Booking.findByIdAndDelete(req.params.id);
    res.json(formatResponse(true, null, 'Booking deleted successfully'));
});

export default {
    getBookings,
    getBookingStats,
    getTodayCheckIns,
    getTodayCheckOuts,
    getOccupancy,
    getBookingById,
    createBooking,
    updateBooking,
    checkIn,
    checkOut,
    cancelBooking,
    markNoShow,
    deleteBooking,
};