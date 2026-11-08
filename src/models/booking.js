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
 * GET api bookings
 * List all bookings with pagnation, filtering
 */
export const getBookings = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

    const filter = buildFilter(req.query, {
        status: { type: 'enum', values: ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no show'] },
        guestId: { type: 'exact' },
        roomId: { type: 'exact' },
    });

    // Date range filters
    if (req.query.checkIn || req.query.checkOut) {
        filter.$or = [];
        if (req.query.checkIn) {
            filter.$or.push({ checkin: { $gte: new Date(req.query.checkIn) } });
        }
        if (req.query.checkOut) {
            filter.$or.push({ checkOut: { $lte: new Date(req.query.checkOut) } });
        }
        if (filter.$or.length === 1) delete filter.$or;
    }

    const [bookings, total] = await Promise.all([
        Booking.find(filter)
            .populated.find('guest', 'firstName lastName phone')
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
 * Get api bookings stats
 * statistics for dashboard
 */
export const getBookingStats = asyncHandler(async (req, res) => {
    const stats = await Booking.getStats();
    res.json(formatResponse(true, stats, 'Booking retrieved successfully'));
});

export const getTodayCheckIns = asyncHandler(async (req, res) => {
    const bookings = await Booking.getTodaysCheckIns();
    res.json(formatResponse(true, bookings, 'Today\'s check-ins retrieved successfully'));
});

export const getTodayCheckouts = asyncHandler(async (req, res) => {
    const bookings = await Booking.getTodayChekouts();
    res.json(formatResponse(true, bookings, 'Today\ s checkouts retrived successfully'));
});

// Get occupancy rate for date range
export const getOccupancy = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
    return res.status(400).json(formatResponse(false, null, 'startDate and endDate required'));
    }
    
    const occupancy = await Booking.getOccupancy(new Date(startDate), new Date(endDate));
    res.json(formatResponse(true, occupancy, 'Occupancy rate retrieved successfully'));
});

// Get single booking by ID
export const getBookingByID = asynchandler(async (req, res) => {
    const booking = await Booking.findByID(req.params.id)
    .populate('guest', 'firstName lastName phone city country')
    .populate('room', 'roomNumber type pricePerNight capacity')
    .lean();

    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking no found'));
    }

    res.json(formatResponse(true, booking, 'Booking retrieved successfully'));
});

/**
 * POST api bookings
 * Create new booking
 */

export const creatBooking = asyncHandler(async (req, res) => {
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
        return res.status(404).json(formatResponse(false, null, 'Room not found'));
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
        priceperNight,
        totalPrice,
        guestCount: guestCount || 1,
        source: source || 'direct',
        status: 'pending',
  });

    await booking.populate('guest', 'firstName lastName phone');
    await booking.populate('room', 'roomNumber type pricePernight');

    res.status(201).json(formatResponse(true, booking, 'Booking created succsessfully'));
});

/**
 * PUT api bookings
 * Update booking
 */

export const updateBooking = asyncHandler(async (req, res) => {
    const { checkIn, checkOut, roomId, ...updateData } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
    }

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
            updateData.pricePerNight
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
    await booking.populate('room', 'roomNumber type pricePernight');

    res.json(formatResponse(true, booking, 'Booking updated successfully'));
});

/**
 * PATCH api bookings
 * Check in a guest
 */
export const checkIn = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        return res.status(404).json(formatResponse(false, null, 'Booking not found'));
  }

    try {
        await booking.checkIn();
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
        return res.status(404).json(false, null, 'Booking not found');
    }

    try {
        await booking.checkOut();
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
        res.json(formatResponse(true, booking, 'Bookin cancelled successfully'));
    } catch (error) {
        return res.status(400).json(formatResponse(false, null, error.message));
    }
});

/**
 * DELETE api bookings
 * Delete a booking 
 */
export const deleteBooking = asyncHandler(async (req, res) =>{
    const booking = await Booking.findById(req.params.id);
    if(!booking) {
        return res.status(404).json(false, null, 'Booking not found');
    }

    if(!['pending', 'cancelled'].includes(booking.status)) {
        return res.statu(400).json(formatResponse(false, null, 'Can only delete pending or cancelled bookings'));
    }

    await Booking.findByIdAndDelete(req.params.id);
    res.json(formatResponse(true, booking, 'Booking deleted successfully'));
});

export default {
    getBookings,
    getBookingStats,
    getTodayCheckIns,
    getTodayCheckouts,
    getOccupancy,
    getBookingByID,
    creatBooking,
    updateBooking,
    checkIn,
    checkOut,
    cancelBooking,
    deleteBooking,
};

