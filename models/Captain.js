import mongoose from 'mongoose';

const captainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
      type: String,
      required: true,
      unique: true,
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ['bike', 'auto', 'cab'],
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
    },
    vehicleModel: {
      type: String,
      default: '',
    },
    vehicleColor: {
      type: String,
      default: '',
    },
    rcNumber: {
      type: String,
      default: '',
    },
    dob: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    aadhaarNumber: {
      type: String,
      default: '',
    },
    dlNumber: {
      type: String,
      default: '',
    },
    panNumber: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'offline'],
      default: 'offline', // changed to offline by default
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    photo: {
      type: String,
      required: false,
    },
    vehiclePhoto: {
      type: String,
      required: false,
    },
    rating: {
      type: Number,
      default: 5.0,
    },
    customId: {
      type: String,
      unique: true,
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Captain = mongoose.model('Captain', captainSchema);

export default Captain;
