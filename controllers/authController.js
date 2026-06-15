import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import twilio from 'twilio';
import fetch from 'node-fetch';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

const otpStore = new Map(); // phone -> otp code
// Safely configure Twilio Client
const getTwilioClient = () => {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
};

// Helper: Send OTP via Mobile Service (OTP_SERVICE_TOKEN)
const sendOtpViaMobileService = async (phone, otp, contextLabel) => {
  const serviceToken = process.env.OTP_SERVICE_TOKEN;
  if (!serviceToken) return false;

  try {
    const response = await fetch('https://api.otp-service.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({
        phone: `+91${phone}`,
        message: `Your TaxiNova ${contextLabel} code is ${otp}. Do not share this with anyone. Valid for 10 minutes.`,
        type: 'transactional'
      })
    }).catch(() => null);

    if (response && response.ok) {
      console.log(`\n\n=== [OTP SERVICE DISPATCHED] ===\nSent ${contextLabel} OTP to ${phone}\n==================================\n`);
      return true;
    }
  } catch (err) {
    console.error("\n[OTP SERVICE ERROR]:", err.message);
  }
  return false;
};

export const dispatchOtp = async (phone, contextLabel = 'verification') => {
  const twilioClient = getTwilioClient();
  const isRealOtp = !!(twilioClient && process.env.TWILIO_PHONE_NUMBER);

  const otp = isRealOtp ? Math.floor(100000 + Math.random() * 900000).toString() : '123456';
  otpStore.set(phone, otp);

  if (isRealOtp) {
    try {
      await twilioClient.messages.create({
        body: `Your TaxiNova ${contextLabel} code is ${otp}. Do not share this with anyone.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${phone}` // Indian number formatting
      });
      console.log(`\n\n=== [TWILIO SMS DISPATCHED] ===\nSent true ${contextLabel} OTP to ${phone}\n===============================\n`);
    } catch (err) {
      console.error("\n[TWILIO ERROR]:", err.message);
      // Try OTP Service Token
      const sentViaService = await sendOtpViaMobileService(phone, otp, contextLabel);
      if (!sentViaService) {
        // Fallback to Demo OTP
        otpStore.set(phone, '123456');
        console.log(`\n\n=== [FALLBACK DEMO OTP] ===\nResorting to Demo OTP: 123456\n=============================\n`);
      }
    }
  } else {
    // Try OTP Service Token first
    const sentViaService = await sendOtpViaMobileService(phone, otp, contextLabel);
    if (!sentViaService) {
      console.log(`\n\n=== [DEV DEMO SMS SIMULATION] ===\n${contextLabel} OTP for ${phone} is ${otp}\n===============================\n`);
    }
  }
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

// 1. Send OTP for Signup Flow
export const sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone number required' });

  await dispatchOtp(phone, 'Signup');

  res.json({ message: 'OTP successfully processed' });
};

// 2. Signup (consumes OTP)

export const signup = async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body;

    if (!name || !email || !phone || !password || !otp) {
      return res.status(400).json({ message: 'All fields and OTP are required' });
    }

    if (otpStore.get(phone) !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const customId = `USR${Math.floor(100000 + Math.random() * 900000)}`;

    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      customId,
    });

    otpStore.delete(phone); // clear specific OTP

    res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      phone: newUser.phone,
      token: generateToken(newUser._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during signup' });
  }
};

// 3. Login Init - Validates credentials, sends OTP unconditionally
export const loginInit = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await dispatchOtp(phone, 'Login');

    res.json({ message: 'Credentials verified, OTP processed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login init' });
  }
};

// 4. Final Login - Verifies OTP, returns token

export const login = async (req, res) => {
  try {
    const { phone, password, otp } = req.body;

    if (!otp) return res.status(400).json({ message: 'OTP is required' });

    if (otpStore.get(phone) !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    otpStore.delete(phone);

    res.json({
      id: user._id,
      name: user.name,
      phone: user.phone,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const getMe = async (req, res) => {
  // User is injected by protect middleware
  const user = req.user;
  res.json({
    id: user._id,
    name: user.name,
    phone: user.phone
  });
};

export const adminRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = await Admin.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign({ id: newAdmin._id, role: 'admin' }, process.env.JWT_SECRET || 'fallback_secret', {
      expiresIn: '30d',
    });

    res.status(201).json({ token, message: 'Admin registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during admin registration', error: error.message });
  }
};

// 5. Forgot Password - send OTP to phone
export const forgotPasswordUser = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone number required' });
  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: 'No account found with this phone number' });
  await dispatchOtp(phone, 'Password Reset');
  res.json({ message: 'OTP sent to your phone' });
};

// 6. Reset Password - verify OTP and update password
export const resetPasswordUser = async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  if (!phone || !otp || !newPassword) return res.status(400).json({ message: 'All fields required' });
  if (otpStore.get(phone) !== otp) return res.status(400).json({ message: 'Invalid or expired OTP' });
  try {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    await User.findOneAndUpdate({ phone }, { password: hashed });
    otpStore.delete(phone);
    res.json({ message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET || 'fallback_secret', {
      expiresIn: '30d',
    });
    
    res.json({ token, name: admin.name, email: admin.email, message: 'Admin logged in successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during admin login', error: error.message });
  }
};
