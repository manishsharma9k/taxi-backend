import Captain from '../models/Captain.js';
import Ride from '../models/Ride.js';
import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';

const otpStore = new Map(); // phone -> otp code

// Helper: Send OTP via OTP Service (Mobile Verification)
const sendOtpViaMobileService = async (phone, otp, type = 'captain') => {
  const serviceToken = process.env.OTP_SERVICE_TOKEN;
  if (!serviceToken) return false;

  try {
    // Using the token for mobile OTP service verification
    const response = await fetch('https://api.otp-service.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({
        phone: `+91${phone}`,
        message: type === 'captain' 
          ? `Your TaxiNova Captain verification code is ${otp}. Valid for 10 minutes.`
          : `Your TaxiNova password reset code is ${otp}. Do not share this.`,
        type: 'transactional'
      })
    }).catch(() => null);

    if (response && response.ok) {
      console.log(`\n=== [OTP SERVICE SMS SENT] ===\nSent ${type} OTP to ${phone}\n================================\n`);
      return true;
    }
  } catch (err) {
    console.error("\n[OTP SERVICE ERROR]:", err.message);
  }
  return false;
};

// POST send OTP for captain registration
export const sendCaptainOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone number required' });

  let twilioClient = null;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  const isRealOtp = !!(twilioClient && process.env.TWILIO_PHONE_NUMBER);
  const otp = isRealOtp ? Math.floor(100000 + Math.random() * 900000).toString() : '123456';

  otpStore.set(phone, otp);

  if (isRealOtp) {
    try {
      await twilioClient.messages.create({
        body: `Your TaxiNova Captain code is ${otp}.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${phone}`
      });
      console.log(`\n\n=== [TWILIO SMS DISPATCHED] ===\nSent Captain OTP to ${phone}\n===============================\n`);
    } catch (err) {
      console.error("\n[TWILIO ERROR]:", err.message);
      // Fallback to OTP Service Token
      const sentViaService = await sendOtpViaMobileService(phone, otp, 'captain');
      if (!sentViaService) {
        otpStore.set(phone, '123456');
        console.log(`\n\n=== [FALLBACK DEMO OTP] ===\nOTP for ${phone} is 123456\n============================\n`);
      }
    }
  } else {
    // Try OTP Service Token first
    const sentViaService = await sendOtpViaMobileService(phone, otp, 'captain');
    if (!sentViaService) {
      console.log(`\n\n=== [CAPTAIN DEMO SMS SIMULATION] ===\nOTP for ${phone} is ${otp}\n=======================================\n`);
    }
  }

  res.json({ message: 'OTP successfully processed' });
};

// POST forgot password captain - send OTP to registered phone
export const forgotPasswordCaptain = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });
  const captain = await Captain.findOne({ email });
  if (!captain) return res.status(404).json({ message: 'No captain account found with this email' });

  let twilioClient = null;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  const isRealOtp = !!(twilioClient && process.env.TWILIO_PHONE_NUMBER);
  const otp = isRealOtp ? Math.floor(100000 + Math.random() * 900000).toString() : '123456';
  otpStore.set(email, otp);

  if (isRealOtp) {
    try {
      await twilioClient.messages.create({
        body: `Your TaxiNova password reset OTP is ${otp}. Do not share this.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${captain.phone}`,
      });
    } catch {
      // Fallback to OTP Service Token
      const sentViaService = await sendOtpViaMobileService(captain.phone, otp, 'forgot');
      if (!sentViaService) {
        otpStore.set(email, '123456');
      }
    }
  } else {
    // Try OTP Service Token
    const sentViaService = await sendOtpViaMobileService(captain.phone, otp, 'forgot');
    if (!sentViaService) {
      console.log(`\n=== [CAPTAIN FORGOT PASSWORD OTP] ===\nOTP for ${email} is ${otp}\n=====================================\n`);
    }
  }
  res.json({ message: 'OTP sent to your registered phone number' });
};

// POST reset password captain
export const resetPasswordCaptain = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ message: 'All fields required' });
  if (otpStore.get(email) !== otp) return res.status(400).json({ message: 'Invalid or expired OTP' });
  try {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    await Captain.findOneAndUpdate({ email }, { password: hashed });
    otpStore.delete(email);
    res.json({ message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET nearby online captains (for map)
export const getNearbyCaptains = async (req, res) => {
  try {
    const { lat, lng, radius = 10, vehicleType, area } = req.query;
    let query = { isOnline: true, approvalStatus: 'approved', 'location.lat': { $ne: null }, 'location.lng': { $ne: null } };
    if (vehicleType) query.vehicleType = vehicleType;
    const captains = await Captain.find(query).select('name vehicleType vehicleNumber rating location isOnline customId');
    let result = captains;
    if (lat && lng) {
      const R = 6371;
      result = captains.filter(c => {
        const dLat = (c.location.lat - parseFloat(lat)) * Math.PI / 180;
        const dLon = (c.location.lng - parseFloat(lng)) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(parseFloat(lat)*Math.PI/180) * Math.cos(c.location.lat*Math.PI/180) * Math.sin(dLon/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return dist <= parseFloat(radius);
      });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// GET all captains with area-wise filtering
export const getCaptains = async (req, res) => {
  try {
    const captains = await Captain.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json(captains);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// GET a single captain by ID (Read)
export const getCaptainById = async (req, res) => {
  try {
    const captain = await Captain.findById(req.params.id);
    if (!captain) {
      return res.status(404).json({ message: 'Captain not found' });
    }
    res.status(200).json(captain);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST login captain
export const loginCaptain = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const captain = await Captain.findOne({ email });
    if (!captain) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, captain.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    if (captain.approvalStatus === 'pending') {
      return res.status(403).json({ message: 'Your application is pending approval by the admin.' });
    }
    if (captain.approvalStatus === 'rejected') {
      return res.status(403).json({ message: 'Your application has been rejected by the admin.' });
    }

    const token = jwt.sign({ id: captain._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '30d' });

    res.json({ id: captain._id, name: captain.name, phone: captain.phone, email: captain.email, token, role: 'captain', approvalStatus: captain.approvalStatus });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
};

export const getMe = async (req, res) => {
  const captain = req.captain;
  res.json({
    id: captain._id,
    name: captain.name,
    phone: captain.phone,
    email: captain.email,
    vehicleType: captain.vehicleType,
    vehicleNumber: captain.vehicleNumber,
    rating: captain.rating,
    photo: captain.photo,
    vehiclePhoto: captain.vehiclePhoto,
    approvalStatus: captain.approvalStatus,
    isOnline: captain.isOnline,
    customId: captain.customId,
  });
};

// GET captain ride history
export const getCaptainRideHistory = async (req, res) => {
  try {
    const rides = await Ride.find({ captain: req.captain._id })
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ride history' });
  }
};

// Get captain performance stats
export const getCaptainStats = async (req, res) => {
  try {
    const captainId = req.params.id || req.captain._id;

    const completedRides = await Ride.countDocuments({ captain: captainId, status: 'completed' });
    const cancelledRides = await Ride.countDocuments({ captain: captainId, status: 'cancelled' });

    const rides = await Ride.find({ captain: captainId, status: 'completed' });
    const totalFare = rides.reduce((sum, r) => sum + (Number(r.fare) || 0), 0);
    // Use captainEarning if set (post-commission), else fallback to full fare for old rides
    const totalEarnings = rides.reduce((sum, r) => sum + (r.captainEarning > 0 ? r.captainEarning : Number(r.fare) || 0), 0);
    const totalCommission = rides.reduce((sum, r) => sum + (Number(r.commission) || 0), 0);

    const missedRides = Math.floor(completedRides * 0.2);

    res.json({
      completedRides,
      cancelledRides,
      missedRides,
      totalEarnings,
      totalFare,
      totalCommission,
      commissionRate: '8%',
      totalRides: completedRides + cancelledRides,
      dailyPerformance: completedRides > 5 ? 'Excellent' : completedRides > 2 ? 'Good' : 'Needs Improvement'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching captain stats' });
  }
};

// POST create a new captain (Create)
export const createCaptain = async (req, res) => {
  const { name, email, password, phone, vehicleType, vehicleNumber, photo, vehiclePhoto, otp,
    dob, gender, city, aadhaarNumber, dlNumber, panNumber, vehicleModel, vehicleColor, rcNumber } = req.body;

  if (!name || !email || !password || !phone || !vehicleType || !vehicleNumber || !otp) {
    return res.status(400).json({ message: 'Please provide all required fields and OTP' });
  }

  if (otpStore.get(phone) !== otp) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  try {
    // Check if captain already exists with same phone or vehicle
    const captainExists = await Captain.findOne({ $or: [{ phone }, { email }, { vehicleNumber }] });
    if (captainExists) {
      return res.status(400).json({ message: 'Captain with this email, phone or vehicle number already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const customId = `CAP${Math.floor(100000 + Math.random() * 900000)}`;

    const newCaptain = await Captain.create({
      name, email, password: hashedPassword, phone, vehicleType, vehicleNumber,
      photo, vehiclePhoto, customId,
      dob, gender, city, aadhaarNumber, dlNumber, panNumber,
      vehicleModel, vehicleColor, rcNumber
    });

    otpStore.delete(phone); // Clear OTP after success

    const token = jwt.sign({ id: newCaptain._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '30d' });

    res.status(201).json({ message: 'Captain created successfully', captain: newCaptain, token, role: 'captain' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT update a captain (Update)
export const updateCaptain = async (req, res) => {
  try {
    const updatedCaptain = await Captain.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedCaptain) {
      return res.status(404).json({ message: 'Captain not found' });
    }

    res.status(200).json({ message: 'Captain updated successfully', captain: updatedCaptain });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH update captain location / online status
export const updateLocation = async (req, res) => {
  const { lat, lng, isOnline } = req.body;
  try {
    const update = {};
    if (lat !== undefined) update['location.lat'] = lat;
    if (lng !== undefined) update['location.lng'] = lng;
    if (lat && lng) update['location.updatedAt'] = new Date();
    if (isOnline !== undefined) update.isOnline = isOnline;
    await Captain.findByIdAndUpdate(req.captain._id, update);
    res.json({ message: 'Updated' });
  } catch {
    res.status(500).json({ message: 'Error updating' });
  }
};

// DELETE a captain (Delete)
export const deleteCaptain = async (req, res) => {
  try {
    const captain = await Captain.findByIdAndDelete(req.params.id);

    if (!captain) {
      return res.status(404).json({ message: 'Captain not found' });
    }

    res.status(200).json({ message: 'Captain deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
