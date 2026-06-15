import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Captain from '../models/Captain.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ message: 'User not found, Not authorized' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const captainProtect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      
      const captain = await Captain.findById(decoded.id);
      
      if (!captain) {
        return res.status(401).json({ message: 'Captain not found, Not authorized' });
      }

      req.captain = captain;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized as captain, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized as captain, no token' });
  }
};

export const protectAny = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
         req.user = user;
         return next();
      }

      const captain = await Captain.findById(decoded.id);
      if (captain) {
         req.captain = captain;
         return next();
      }

      return res.status(401).json({ message: 'User/Captain not found, Not authorized' });
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const adminProtect = async (req, res, next) => {
  let token;

  // If there are no admin users yet, allow the request to proceed
  try {
    const Admin = (await import('../models/Admin.js')).default;
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      // No admin exists yet — allow first-time registration without token
      return next();
    }
  } catch (err) {
    // If DB isn't available, continue to token check so we return a clear auth error
    console.warn('adminProtect: could not check admin count:', err.message);
  }

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

      const Admin = (await import('../models/Admin.js')).default;
      const admin = await Admin.findById(decoded.id).select('-password');

      if (!admin) {
        return res.status(401).json({ message: 'Admin not found, Not authorized' });
      }

      req.admin = admin;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized as admin, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized as admin, no token' });
};
