import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Captain from "../models/Captain.js";
import dotenv from 'dotenv';
dotenv.config();

const getBearerToken = (req) => {
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || token === "undefined" || token === "null") return null;
  return token;
};

const tokenErrorMessage = (error, context = "Not authorized") => {
  if (error?.name === "TokenExpiredError") return `${context}, token expired`;
  if (error?.name === "JsonWebTokenError")
    return `${context}, token malformed or invalid`;
  if (error?.name === "NotBeforeError")
    return `${context}, token not active yet`;
  return `${context}, token failed`;
};

export const protect = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret",
    );
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found, not authorized" });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('protect middleware error:', error?.name || error);

    // If token expired or invalid, try silent refresh if refresh token header provided
    try {
      const refreshToken = req.headers['x-refresh-token'] || req.body?.refreshToken;
      if (refreshToken) {
        // verify refresh token
        const decodedRefresh = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret'
        );
        const user = await User.findById(decodedRefresh.id).select('-password refreshToken');
        if (user && user.refreshToken === refreshToken) {
          // issue a new access token
          const newAccess = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '30d' });
          // set header so client can pick it up and persist
          res.setHeader('x-access-token', newAccess);
          req.user = user;
          return next();
        }
      }
    } catch (refreshErr) {
      console.warn('Silent refresh failed in protect:', refreshErr?.message || refreshErr);
    }

    return res
      .status(401)
      .json({ message: tokenErrorMessage(error, "Not authorized") });
  }
};

export const captainProtect = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ message: "Not authorized as captain, no token" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret",
    );
    const captain = await Captain.findById(decoded.id);

    if (!captain) {
      return res
        .status(401)
        .json({ message: "Captain not found, not authorized" });
    }

    req.captain = captain;
    return next();
  } catch (error) {
    console.error(error);
    return res
      .status(401)
      .json({ message: tokenErrorMessage(error, "Not authorized as captain") });
  }
};

export const protectAny = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret",
    );

    const user = await User.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
      return next();
    }

    const captain = await Captain.findById(decoded.id);
    if (captain) {
      req.captain = captain;
      return next();
    }

    return res
      .status(401)
      .json({ message: "User/Captain not found, not authorized" });
  } catch (error) {
    console.error(error);
    return res
      .status(401)
      .json({ message: tokenErrorMessage(error, "Not authorized") });
  }
};

export const adminProtect = async (req, res, next) => {
  let token;

  // If there are no admin users yet, allow the request to proceed
  try {
    const Admin = (await import("../models/Admin.js")).default;
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      // No admin exists yet — allow first-time registration without token
      return next();
    }
  } catch (err) {
    // If DB isn't available, continue to token check so we return a clear auth error
    console.warn("adminProtect: could not check admin count:", err.message);
  }

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fallback_secret",
      );

      const Admin = (await import("../models/Admin.js")).default;
      const admin = await Admin.findById(decoded.id).select("-password");

      if (!admin) {
        return res
          .status(401)
          .json({ message: "Admin not found, Not authorized" });
      }

      req.admin = admin;
      return next();
    } catch (error) {
      console.error(error);
      return res
        .status(401)
        .json({ message: "Not authorized as admin, token failed" });
    }
  }

  return res.status(401).json({ message: "Not authorized as admin, no token" });
};
