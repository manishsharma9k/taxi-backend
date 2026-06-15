import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
    },
    pickup: {
      type: String,
      required: true,
    },
    dropoff: {
      type: String,
      required: true,
    },
    fare: {
      type: Number,
      required: true,
    },
    vehicleType: {
      type: String,
      enum: ['bike', 'auto', 'cab'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'ongoing', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet'],
      default: 'cash',
    },
    cancelReason: {
      type: String,
      default: '',
    },
    customId: {
      type: String,
      unique: true,
    },
    otp: {
      type: String,
      required: false,
    },
    commission: {
      type: Number,
      default: 0,
    },
    captainEarning: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Ride = mongoose.model('Ride', rideSchema);

export default Ride;
