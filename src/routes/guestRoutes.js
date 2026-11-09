/**
 * Guest Routes
 *
 * Defines all API endpoints for guest management.
 */

import express from 'express';
import {
  getGuests,
  getGuestStats,
  searchGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
} from '../controllers/guestController.js';

const router = express.Router();

// Guest list and search

/**
 * @route GET /api/v1/guests
 * @description Get all guests with filtering, pagination
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 50)
 * @query {string} search - Search by name or phone
 * @query {boolean} isVip - Filter by VIP status
 * @query {string} city - Filter by city
 * @query {string} country - Filter by country
 * @access Public
 */
router.get('/', getGuests);

/**
 * @route GET /api/v1/guests/stats
 * @description Get guest statistics for dashboard
 * @access Public
 */
router.get('/stats', getGuestStats);

/**
 * @route GET /api/v1/guests/search
 * @description Search guests by name or phone (for autocomplete)
 * @query {string} q - Search query (required, min 1 char)
 * @query {number} limit - Max results (default: 10)
 * @access Public
 */
router.get('/search', searchGuests);

// Single guest

/**
 * @route GET /api/v1/guests/:id
 * @description Get single guest by ID with recent bookings
 * @param {string} id - Guest ObjectId
 * @access Public
 */
router.get('/:id', getGuestById);

// Create guest
/**
 * @route POST /api/v1/guests
 * @description Create a new guest
 * @body {string} firstName - First name (required)
 * @body {string} lastName - Last name (required)
 * @body {string} phone - Phone number (required)
 * @body {string} city - City (required)
 * @body {string} country - Country (required)
 * @body {boolean} marketingConsent - Marketing consent
 * @access Private (requires auth in production)
 */
router.post('/', createGuest);

// Update guest

/**
 * @route PUT /api/v1/guests/:id
 * @description Update a guest
 * @param {string} id - Guest ObjectId
 * @body {string} firstName - First name
 * @body {string} lastName - Last name
 * @body {string} phone - Phone number
 * @body {string} city - City
 * @body {string} country - Country
 * @body {boolean} isVip - VIP status
 * @body {boolean} marketingConsent - Marketing consent
 * @access Private (requires auth in production)
 */
router.put('/:id', updateGuest);

// Delete guest

/**
 * @route DELETE /api/v1/guests/:id
 * @description Delete a guest (only if no bookings)
 * @param {string} id - Guest ObjectId
 * @access Private (requires auth in production)
 */
router.delete('/:id', deleteGuest);

export default router;

