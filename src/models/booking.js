/**
* Booking Model
*
* Represents a room reservation linking a guest to a room for specific dates.
*/

import mongoose, { Schema } from 'mongoose';
import { generateBookingReference } from '../utils/helpers.js';

export const BOOKING_STATUSES = [
    'pending',      
    'confirmed',    
    'checked-in',   
    'checked-out',  
    'cancelled',    
    'no-show',
];

export const PAYMENT_STATUSES = [
    'pending',
    'partial',
    'paid',
    'refunded',
    'failed',
];

const bookingSchema = new Schema({
    reference: {
        type: String,
        unique: true,
        default: () => generateBookingReference(),
        index: true,
    },

    guest: {
        type: Schema.Types.ObjectId,
        ref: 'Guest',
        required: [true, 'Guest is required'],
        index: true,
    },

    room: {
        type: Schema.Types.ObjectId,
        ref: 'Room',
        required: [true, 'Room is required'],
        index: true,
    },

    checkIn: {
        type: Date,
        required: [true, 'Check-in date is required'],
        index: true,
    },

    checkOut: {
        type: Date,
        required: [true, 'Check-out date is required'],
        index: true,
    },

    status: {
        type: String,
        enum: {
            values: BOOKING_STATUSES,
            message: 'Invalid booking status',
        },
        default: 'pending',
        index: true,
    },

    paymentStatus: {
        type: String,
        enum: {
            values: PAYMENT_STATUSES,
            message: 'Invalid payment status',
        },
        default: 'pending',
        index: true,
    },

    pricePerNight: {
        type: Number,
        required: [true, 'Price per night is required'],
        min: [0, 'Price cannot be negative'],
    },

    totalPrice: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [0, 'Total price cannot be negative'],
    },

    nights: {
        type: Number,
        required: [true, 'Number of nights is required'],
        min: [1, 'Minimum 1 night'],
    },

    guestCount: {
        type: Number,
        default: 1,
        min: [1, 'At least 1 guest'],
        max: [10, 'Maximum 10 guests'],
    },

    cancelledAt: {
        type: Date,
    },

    checkedInAt: {
        type: Date,
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Compound indexes for common queries
bookingSchema.index({ guest: 1, checkIn: -1 });
bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ status: 1, checkIn: 1 });
bookingSchema.index({ checkIn: 1, checkOut: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });

bookingSchema.virtual('guestDetails', {
    ref: 'Guest',
    localField: 'guest',
    foreignField: '_id',
    justOne: true,
});

bookingSchema.virtual('statusLabel').get(function() {
    const labels = {
        'pending': 'Pending Confirmation',
        'confirmed': 'Confirmed',
        'checked-in': 'Checked In',
        'checked-out': 'Checked Out',
        'cancelled': 'Cancelled',
        'no-show': 'No Show',
    };
    return labels[this.status] || this.status;
});

// Is currently active (guest in house)
bookingSchema.virtual('isActive').get(function() {
    return ['confirmed', 'checked-in'].includes(this.status);
});

// Is completed
bookingSchema.virtual('isCompleted').get(function() {
    return ['checked-out', 'cancelled', 'no-show'].includes(this.status);
});

/**
 * Calculates total price based on nights and price per night
 * @returns {number} 
 */
bookingSchema.methods.calculateTotal = function() {
    return this.nights * this.pricePerNight;
};

/**
 * Validates booking dates that don't conflict with existing bookings
 * @returns {Promise<boolean>} 
 */
bookingSchema.methods.validateNoConflicts = async function() {
    const Booking = mongoose.model('Booking');

    const conflict = await Booking.findOne({
        _id: { $ne: this._id }, // Exclude self
        room: this.room,
        status: { $in: ['pending', 'confirmed', 'checked-in'] },
        $or: [
            { checkIn: { $lt: this.checkOut }, checkOut: { $gt: this.checkIn } },
        ],
    });

    return !conflict;
};

/**
 * Confirms the booking
 * @returns {Promise<Booking>} 
 */
bookingSchema.methods.confirm = async function() {
    if (this.status !== 'pending') {
        throw new Error('Only pending bookings can be confirmed');
    }
    this.status = 'confirmed';
    return this.save();
};

/**
 * Checks in the guest
 * @returns {Promise<Booking>}
 */
bookingSchema.methods.performCheckIn = async function() {
    if (this.status !== 'confirmed') {
        throw new Error('Only confirmed bookings can be checked in');
    }
    this.status = 'checked-in';
    this.checkedInAt = new Date();

    // Update room availability
    const Room = mongoose.model('Room');
    await Room.findByIdAndUpdate(this.room, { isAvailable: false });

    return this.save();
};

/**
 * Checks out the guest
 * @returns {Promise<Booking>} Updated booking
 */
bookingSchema.methods.performCheckOut = async function() {
    if (this.status !== 'checked-in') {
        throw new Error('Only checked-in bookings can be checked out');
    }
    this.status = 'checked-out';
    this.checkedOutAt = new Date();

    const Room = mongoose.model('Room');
    await Room.findByIdAndUpdate(this.room, { isAvailable: true });

    // Update guest stats
    const Guest = mongoose.model('Guest');
    await Guest.findByIdAndUpdate(this.guest, {
        $inc: { totalBookings: 1, totalSpent: this.totalPrice },
        lastStayAt: this.checkOut,
    });

    return this.save();
};

/**
 * Cancels the booking
 * @returns {Promise<Booking>} Updated booking
 */
bookingSchema.methods.cancel = async function(reason = '') {
    if (this.isCompleted) {
        throw new Error('Completed bookings cannot be cancelled');
    }

    // Store original status before changing
    const wasActive = ['confirmed', 'checked-in'].includes(this.status);

    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancellationReason = reason;

    // Free up room if it was confirmed/checked-in
    if (wasActive) {
        const Room = mongoose.model('Room');
        await Room.findByIdAndUpdate(this.room, { isAvailable: true });
    }

    return this.save();
};

/**
 * Marks as no-show
 * @returns {Promise<Booking>} 
 */
bookingSchema.methods.markNoShow = async function() {
    if (this.status !== 'confirmed') {
        throw new Error('Only confirmed bookings can be marked as no-show');
    }
    this.status = 'no-show';

    const Room = mongoose.model('Room');
    await Room.findByIdAndUpdate(this.room, { isAvailable: true });

    return this.save();
};

/**
 * Checks room availability for date range
 * @param {ObjectId} roomId 
 * @param {Date} checkIn 
 * @param {Date} checkOut 
 * @param {ObjectId} [excludeBookingId] 
 * @returns {Promise<boolean>} 
 */
bookingSchema.statics.isRoomAvailable = async function(roomId, checkIn, checkOut, excludeBookingId = null) {
    const query = {
        room: roomId,
        status: { $in: ['pending', 'confirmed', 'checked-in'] },
        $or: [
        { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
        ],
    };

    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }

    const conflict = await this.findOne(query);
    return !conflict;
};

/**
 * Finds bookings for a date range (for dashboard/calendar)
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<Array>}
 */
bookingSchema.statics.findByDateRange = async function(startDate, endDate) {
    return this.find({
        $or: [
        { checkIn: { $gte: startDate, $lt: endDate } },
        { checkOut: { $gt: startDate, $lte: endDate } },
        { checkIn: { $lte: startDate }, checkOut: { $gte: endDate } },
        ],
        status: { $in: ['confirmed', 'checked-in'] },
    })
    .populate('guest', 'firstName lastName email phone')
    .populate('room', 'roomNumber type')
    .sort({ checkIn: 1 });
};

/**
 * Gets today's check-ins
 * @returns {Promise<Array>} 
 */
bookingSchema.statics.getTodaysCheckIns = async function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.find({
        checkIn: { $gte: today, $lt: tomorrow },
        status: 'confirmed',
    })
    .populate('guest', 'firstName lastName phone')
    .populate('room', 'roomNumber type');
};

/**
 * Gets today's check-outs
 * @returns {Promise<Array>} 
 */
bookingSchema.statics.getTodaysCheckOuts = async function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.find({
        checkOut: { $gte: today, $lt: tomorrow },
        status: 'checked-in',
    })
    .populate('guest', 'firstName lastName phone')
    .populate('room', 'roomNumber type');
};

/**
 * Gets occupancy rate for date range
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<Object>} 
 */
bookingSchema.statics.getOccupancyRate = async function(startDate, endDate) {
    const Room = mongoose.model('Room');

    const totalRooms = await Room.countDocuments({ isAvailable: true });

    const bookings = await this.find({
        status: { $in: ['confirmed', 'checked-in'] },
        $or: [
            { checkIn: { $lt: endDate }, checkOut: { $gt: startDate } },
        ],
    });

    // Calculate occupied room-nights
    let occupiedRoomNights = 0;
    for (const booking of bookings) {
        const overlapStart = booking.checkIn > startDate ? booking.checkIn : startDate;
        const overlapEnd = booking.checkOut < endDate ? booking.checkOut : endDate;
        const nights = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
        occupiedRoomNights += Math.max(0, nights);
    }

    const totalRoomNights = totalRooms * Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    return {
        totalRooms,
        totalRoomNights,
        occupiedRoomNights,
        occupancyRate: totalRoomNights > 0 ? (occupiedRoomNights / totalRoomNights * 100).toFixed(1) : 0,
    };
};

// Pre-validate: Calculate nights and total price
bookingSchema.pre('validate', function(next) {
    if (this.checkIn && this.checkOut) {
        const checkIn = new Date(this.checkIn);
        const checkOut = new Date(this.checkOut);

        if (checkOut <= checkIn) {
            return next(new Error('Check-out must be after check-in'));
        }

        this.nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        if (this.pricePerNight) {
            this.totalPrice = this.nights * this.pricePerNight;
        }
    }
    next();
});

// Pre-save: Validate no conflicts
bookingSchema.pre('save', async function(next) {
    if (this.isNew || this.isModified('checkIn') || this.isModified('checkOut') || this.isModified('room')) {
        const isAvailable = await this.constructor.isRoomAvailable(
            this.room,
            this.checkIn,
            this.checkOut,
            this.isNew ? null : this._id
        );

        if (!isAvailable) {
            return next(new Error('Room is not available for the selected dates'));
        }
  }
  next();
});

// Post-save: Update room availability on status change
bookingSchema.post('save', async function(doc) {
    if (doc.isModified('status')) {
        const Room = mongoose.model('Room');

    if (doc.status === 'checked-in') {
        await Room.findByIdAndUpdate(doc.room, { isAvailable: false });
    } else if (['checked-out', 'cancelled', 'no-show'].includes(doc.status)) {

        // Check if room has other active bookings
        const activeBookings = await this.constructor.countDocuments({
            room: doc.room,
            status: { $in: ['confirmed', 'checked-in'] },
            _id: { $ne: doc._id },
        });

        if (activeBookings === 0) {
            await Room.findByIdAndUpdate(doc.room, { isAvailable: true });
        }
    }
  }
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
