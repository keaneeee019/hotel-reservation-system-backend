/**
 * Guests model
 * 
 * Represents hotel guest with pr=ersonal information
 */

import mongoose, { Schema } from 'mongoose';

const guestSchema = new Schema ({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters'],
        index: true,
    },

    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characterss'],
        index: true,
    },

    phone: {
        type: String,
        trim: true,
        required: [true, 'Phone number is required'],
        maxlength: [13, 'Phone number cannot exceed 13 characters'],
        match: [/^(09|\+639)\d{9}$/, 'Enter a valid phone number format'],
    },

    // Address information
    city: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        maxlength: [50, 'Address cannot exceed 50 characters'],
    },

    country: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        maxlength: [50, 'Address cannot exceed 50 characters'],
    },

    isVip: {
        type: Boolean,
        default: false,
        index: true,
    },

    marketingConsent: {
        type: Boolean,
        default: false,
    },

    totalBookings: {
        type: Number,
        default: 0,
        min: 0,
    },

    lastStayAt: {
        type: Date,
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Text index for search
guestSchema.index({
    firstName: 'text',
    lastName: 'text',
    email: 'text',
    phone: 'text',
});

guestSchema.index({ lastName: 1, firstName: 1 });
guestSchema.index({ createdAt: -1 });

// Full name
guestSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

guestSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'guest',
});

/**
 * Gets guest's booking history
 * @param {Object} options 
 * @returns {Promise<Array>} 
 */
guestSchema.methods.getBookings = async function(options = {}) {
  const Booking = mongoose.model('Booking');
  const query = { guest: this._id };

  if (options.status) {
    query.status = options.status;
  }

  return Booking.find(query)
    .populate('room', 'roomNumber type pricePerNight')
    .sort({ checkIn: -1 })
    .limit(options.limit || 50);
};

/**
 * Updates denormalized counters
 * @returns {Promise<Guest>} 
 */
guestSchema.methods.updateCounters = async function() {
    const Booking = mongoose.model('Booking');

    const stats = await Booking.aggregate([
        { $match: { guest: this._id, status: 'checked-out' } },
        {
            $group: {
                _id: '$guest',
                totalBookings: { $sum: 1 },
                totalSpent: { $sum: '$totalPrice' },
                lastStay: { $max: '$checkOut' },
            },
        },
    ]);

    if (stats.length > 0) {
        this.totalBookings = stats[0].totalBookings;
        this.totalSpent = stats[0].totalSpent;
        this.lastStayAt = stats[0].lastStay;
        await this.save();
    }
    
    return rhis;
};

/**
 * Searches guests by name or phone number
 * @param {string} searchTerm 
 * @param {Object} options 
 * @returns {Promise<Array>}
 */

guestSchema.statics.search = async function(searchTerm, options = {}) {
    const query = {
        $or: [
            { firstName: { $regex: searchTerm, $options: 'i' } },
            { lastName: { $regex: searchTerm, $options: 'i' } },
            { phone: { $regex: searchTerm, $options: 'i' } },
        ],
    };

    return this.find(query)
        .sort({ lastName: 1, firstName: 1 })
        .limit(options.limit || 20)
        .skip(options.skip || 0);
};

/**
 * Gets guest statistics for dashboard
 * @returns {Promise<Object>}
 */
guestSchema.statics.getStats = async function() {
    const total = await this.countDocuments();
    const vipCount = await this.countDocuments({isVip: true });
    const withBookings = await this.countDocuments({ totalBookings: { $gt: 0 } });

    return {
        total,
        vip: vipCount,
        returning: withBookings,
        new: total - withBookings,
    };
};

guestSchema.pre('save', function(next) {
  if (this.isModified('firstName')) {
    this.firstName = this.firstName.charAt(0).toUpperCase() + this.firstName.slice(1).toLowerCase();
  }
  if (this.isModified('lastName')) {
    this.lastName = this.lastName.charAt(0).toUpperCase() + this.lastName.slice(1).toLowerCase();
  }
  if (this.isModified('city')) {
    this.city = this.city.charAt(0).toUpperCase() + this.city.slice(1).toLowerCase();
  }
  if (this.isModified('country')) {
    this.country = this.country.charAt(0).toUpperCase() + this.country.slice(1).toLowerCase();
  }
  next();
});


const Guest = mongoose.model('Guest', guestSchema);

export default Guest;