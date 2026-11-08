/**
 * Room model
 * 
 * This represents hotel with type, pricing, and availability
 */

import mongoose, { Schema } from 'mongoose';

export const ROOM_TYPES = ['single', 'double', 'suite', 'deluxe'];

const roomSchema = new Schema({
    roomNumber: {
        required: [true, 'Room bumber is required'],
        unique: true,
        trim: true,
        maxlength: [20, 'Room number cannot exceed 20 characters'],
        index: true,
    },

    // Room category
    type: {
        required: [true, 'Room type is required'],
        enum: {
            values: ROOM_TYPES,
            message: 'Room type must be one of: {VALUE}',
        },
        index: true,
    },

    // Press per night
    pricePerNight: {
        type: Number,
        required: [true, 'Price number is required'],
        min: [0, 'Price per night is required'],
        validate: {
            validator: Number.isFinite,
            message: 'Price must be a valid number'
        },
    },

    // Maximum capacity for guest
    capacity: {
        type: Number,
        required: [true, 'Capacity is required'],
        min: [0, 'Price cannot be negative'],
        validate: {
            validator: Number.isFinite,
            message: 'Price must be valid number',
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

    // Amenties list (WiFi, TV, AC, etc)
    amenties: [{
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
   timestamp: true,
   toJSON: { virtuals: true },
   toObject: { virtuals: true}, 
});

// Index for common quaries
roomSchema.virtual('currentBooking', {
    ref: 'Booking',
    localField: '_id',
    foreignField: 'room',
    match: { status: { $in: ['confirmed', 'check-in'] } },
});

// Formatted pricing
roomSchema.virtual('formattedPrice').get(function() {
    return new Intl.Numberformat('en-PH', {
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
    const cconflictingBook = await Booking.findOne({
        room: this._id,
        status: { $in: ['confirmed', 'checked-in'] },
        $or: [ { checkIn: { $lt: checkOut }, checkOut: {$gt: checkIn} }, ],
    });
    return !cconflictingBook;
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
        $or: [ { checkIn: {$lt: startDate}, checkOut: {$lt: endDate} }, ],
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
        $or: [ { checkIn: {$lt: checkIn}, checkOut: {$lt: checkOut} }, ],
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
                available: { $sum: { $cond: ['isAvailable', 1, 0] } },
                avgPrice: { $avg: '$pricePerNight' },
                minPrice: { $min:'$PricePerNight' },
                maxprice: { $min:'$PricePerNight' },
            },
        },

        {
            $projects: {
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
            occupancyRate: total > 0 ? ((total - totalAvailable) / total * 100).toFixe(1): 0,

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

