/**
 * Booking Routes
 *
 * Defines all API endpoints for booking management.
 */

import express from 'express';
import {
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
} from '../controllers/bookingController.js';

const router = express.Router();

// Booking list and dashboard

/**
 * @route GET /api/v1/bookings
 * @description Get all bookings with filtering, pagination
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 50)
 * @query {string} status - Filter by status (pending, confirmed, checked-in, checked-out, cancelled, no-show)
 * @query {string} guestId - Filter by guest ID
 * @query {string} roomId - Filter by room ID
 * @query {string} checkIn - Filter by check-in date (ISO 8601)
 * @query {string} checkOut - Filter by check-out date (ISO 8601)
 * @access Public
 */
router.get('/', getBookings);

/**
 * @route GET /api/v1/bookings/stats
 * @description Get booking statistics for dashboard
 * @access Public
 */
router.get('/stats', getBookingStats);

/**
 * @route GET /api/v1/bookings/today/check-ins
 * @description Get today's check-ins
 * @access Public
 */
router.get('/today/check-ins', getTodayCheckIns);

/**
 * @route GET /api/v1/bookings/today/check-outs
 * @description Get today's check-outs
 * @access Public
 */
router.get('/today/check-outs', getTodayCheckOuts);

/**
 * @route GET /api/v1/bookings/occupancy
 * @description Get occupancy rate for date range
 * @query {string} startDate - Start date (ISO 8601, required)
 * @query {string} endDate - End date (ISO 8601, required)
 * @access Public
 */
router.get('/occupancy', getOccupancy);

// Single booking

/**
 * @route GET /api/v1/bookings/:id
 * @description Get single booking by ID with populated guest and room
 * @param {string} id - Booking ObjectId
 * @access Public
 */
router.get('/:id', getBookingById);

// Create booking

/**
 * @route POST /api/v1/bookings
 * @description Create a new booking
 * @body {string} guestId - Guest ObjectId (required)
 * @body {string} roomId - Room ObjectId (required)
 * @body {string} checkIn - Check-in date ISO 8601 (required)
 * @body {string} checkOut - Check-out date ISO 8601 (required)
 * @body {number} guestCount - Number of guests (default: 1)
 * @access Public (or Private with auth in production)
 */
router.post('/', createBooking);

// Update booking

/**
 * @route PUT /api/v1/bookings/:id
 * @description Update a booking (re-validates availability if dates/room change)
 * @param {string} id - Booking ObjectId
 * @body {string} guestId - Guest ObjectId
 * @body {string} roomId - Room ObjectId
 * @body {string} checkIn - Check-in date ISO 8601
 * @body {string} checkOut - Check-out date ISO 8601
 * @body {string} status - Booking status
 * @body {number} totalPrice - Total price
 * @access Private (requires auth in production)
 */
router.put('/:id', updateBooking);

// Status transition

/**
 * @route PATCH /api/v1/bookings/:id/check-in
 * @description Check in a guest (pending/confirmed -> checked-in)
 * @param {string} id - Booking ObjectId
 * @access Private (requires auth in production)
 */
router.patch('/:id/check-in', checkIn);

/**
 * @route PATCH /api/v1/bookings/:id/check-out
 * @description Check out a guest (checked-in -> checked-out)
 * @param {string} id - Booking ObjectId
 * @access Private (requires auth in production)
 */
router.patch('/:id/check-out', checkOut);

/**
 * @route PATCH /api/v1/bookings/:id/cancel
 * @description Cancel a booking
 * @param {string} id - Booking ObjectId
 * @access Private (requires auth in production)
 */
router.patch('/:id/cancel', cancelBooking);

/**
 * @route PATCH /api/v1/bookings/:id/no-show
 * @description Mark booking as no-show (confirmed -> no-show)
 * @param {string} id - Booking ObjectId
 * @access Private (requires auth in production)
 */
router.patch('/:id/no-show', markNoShow);

// Delete booking

/**
 * @route DELETE /api/v1/bookings/:id
 * @description Delete a booking (only if pending or cancelled)
 * @param {string} id - Booking ObjectId
 * @access Private (requires auth in production)
 */
router.delete('/:id', deleteBooking);

export default router;