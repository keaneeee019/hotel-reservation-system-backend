/**
 * Room model
 * 
 * This represents hotel with type, pricing, and availability
 */

import mongoose, { Schema } from 'mongoose';

export const ROOM_TYPES = ['single', 'double', 'suite', 'deluxe'];

const roomSchema = new Schema({
    roomNumber: {
        type: String,
        required: [true, 'Room number is required'],
        unique: true,
        trim: true,
        maxlength: [20, 'Room number cannot exceed 20 characters'],
        index: true,
    },

    // Room category
    type: {
        type: String,
        required: [true, 'Room type is required'],
        enum: {
            values: ROOM_TYPES,
            message: 'Room type must be one of: {VALUE}',
        },
        index: true,
    },

    // Price per night
    pricePerNight: {
        type: Number,
        required: [true, 'Price per night is required'],
        min: [0, 'Price per night cannot be negative'],
        validate: {
            validator: Number.isFinite,
            message: 'Price must be a valid number'
        },
    },

    // Maximum capacity for guest
    capacity: {
        type: Number,
        required: [true, 'Capacity is required'],
        min: [0, 'Capacity cannot be negative'],
        validate: {
            validator: Number.isFinite,
            message: 'Capacity must be a valid number',
        },
    },

    floor: {
        type: String,
        trim: true,
        maxlength: [10, 'Floor cannot exceed 10 characters'],
    },

    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    // Amenities list (WiFi, TV, AC, etc)
    amenities: [{
        type: String,
        trim: true,
        maxlength: [50, 'Amenity name cannot exceed 50 characters'],
    }],

    isAvailable: {
        type: Boolean,
        default: true,
        index: true,
    },

    // Timestamp
    lastCleanedAt: {
        type: Date,
    },
   
}, {
   timestamps: true,
   toJSON: { virtuals: true },
   toObject: { virtuals: true},
});

// Index for common queries
roomSchema.virtual('currentBooking', {
    ref: 'Booking',
    localField: '_id',
    foreignField: 'room',
    match: { status: { $in: ['confirmed', 'checked-in'] } },
});

// Formatted pricing
roomSchema.virtual('formattedPrice').get(function() {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(this.pricePerNight);
});

/**
 * Checks if room is available for given date
 * @param {Date} checkIn 
 * @param {Date} checkOut 
 * @returns {Promise<boolean>} 
 */
roomSchema.methods.isAvailableForDates = async function(checkIn, checkOut) {
    const Booking = mongoose.model('Booking');
    const conflictingBook = await Booking.findOne({
        room: this._id,
        status: { $in: ['confirmed', 'checked-in'] },
        $or: [ { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }, ],
    });
    return !conflictingBook;
};

/**
 * Get availabilty for date range
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<Object>}
 */

roomSchema.methods.getAvailability = async function(startDate, endDate) {
    const Booking = mongoose.model('Booking');
    const bookings = await Booking.find({
        room: this._id,
        status: { $in: ['confirmed', 'checked-in'] },
        $or: [ { checkIn: { $lt: endDate }, checkOut: { $gt: startDate } }, ],
    })
    .select('checkIn checkOut status');

    return {
        roomId: this._id,
        roomNumber: this.roomNumber,
        isAvailable: bookings.length === 0,
        bookings: bookings.map(b => ({
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            status: b.status,
        })),
    };
};

/**
 * Finds available rooms for date range
 * @param {Date} checkIn 
 * @param {Date} checkOut 
 * @param {Object} filters 
 * @returns {Promise<Array>}
 */
roomSchema.statics.findAvailable = async function(checkIn, checkOut, filters = {}) {
    const Booking = mongoose.model('Booking');

    // Conflicting booking
    const bookedRoomIds = await Booking.distinct('room', {
        status: { $in: ['confirmed', 'checked-in'] },
        $or: [ { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } }, ],
    });

    const query = {
        _id: { $nin: bookedRoomIds },
        isAvailable: true,
        ...filters,
    };

    return this.find(query).sort({ pricePerNight });
};

/**
 * Get room statistics for dashboard
 * @returns {Promise<Object>}
 */
roomSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 },
                available: { $sum: { $cond: ['$isAvailable', 1, 0] } },
                avgPrice: { $avg: '$pricePerNight' },
                minPrice: { $min: '$pricePerNight' },
                maxPrice: { $max: '$pricePerNight' },
            },
        },

        {
            $project: {
                type: '$_id',
                count: 1,
                available: 1,
                occupied: { $subtract: ['$count', '$available'] },
                avgPrice: { $round: ['$avgPrice', 2] },
                minPrice: 1,
                maxPrice: 1,
                _id: 0,
            },
        },
    ]);

    const total = await this.countDocuments();
    const totalAvailable = await this.countDocuments({ isAvailable: true });

    return {
        byType: stats,
        summary: {
            total,
            available: totalAvailable,
            occupied: total - totalAvailable,
            occupancyRate: total > 0 ? ((total - totalAvailable) / total * 100).toFixed(1) : 0,

        },
    };
};

// Clean up data
roomSchema.pre('save', function(next) {
    if (this.roomNumber) {
        this.roomNumber = this.roomNumber.toUpperCase().trim();
    }
    next();
});

const Room = mongoose.model('Room', roomSchema);

export default Room;

