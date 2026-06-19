import Captain from "../models/Captain.js";
import Ride from "../models/Ride.js";
import fetch from 'node-fetch';
import { getIo } from "../socket.js";

// Haversine distance in km
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getRouteData = async (pickup, dropoff) => {
  const defaults = { distanceKm: 5.0, durationMin: 15 };
  try {
    const [pickupRes, dropoffRes] = await Promise.all([
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickup)}&limit=1`,
      ),
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dropoff)}&limit=1`,
      ),
    ]);
    const [pickupData, dropoffData] = await Promise.all([
      pickupRes.json(),
      dropoffRes.json(),
    ]);

    if (pickupData.length === 0 || dropoffData.length === 0) {
      return defaults;
    }

    const lat1 = parseFloat(pickupData[0].lat);
    const lon1 = parseFloat(pickupData[0].lon);
    const lat2 = parseFloat(dropoffData[0].lat);
    const lon2 = parseFloat(dropoffData[0].lon);

    try {
      const osrmRes = await fetch(
        `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`,
      );
      const osrmData = await osrmRes.json();
      if (osrmData.code === "Ok" && osrmData.routes?.[0]) {
        return {
          distanceKm: parseFloat(
            (osrmData.routes[0].distance / 1000).toFixed(1),
          ),
          durationMin: Math.ceil(osrmData.routes[0].duration / 60),
        };
      }
    } catch (error) {
      console.warn("OSRM route failed:", error?.message || error);
    }

    const straight = getDistanceKm(lat1, lon1, lat2, lon2);
    return {
      distanceKm: Math.max(parseFloat((straight * 1.3).toFixed(1)), 1.0),
      durationMin: Math.ceil(
        Math.max(parseFloat((straight * 1.3).toFixed(1)), 1.0) * 3,
      ),
    };
  } catch (error) {
    console.warn("Route data fetch failed:", error?.message || error);
    return defaults;
  }
};

const calculateFare = (distanceKm, vehicleType) => {
  const dist = parseFloat(distanceKm) || 0;
  if (vehicleType === "bike") return Math.max(Math.ceil(10 + dist * 7), 25);
  if (vehicleType === "auto") return Math.max(Math.ceil(25 + dist * 12), 40);
  return Math.max(Math.ceil(50 + dist * 16), 80);
};

const VEHICLE_TYPES = new Set(["bike", "auto", "cab"]);

const generateRideCustomId = () => {
  const tsPart = Date.now().toString().slice(-6);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `RID${tsPart}${randomPart}`;
};

const createUniqueRideCustomId = async (maxAttempts = 5) => {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = generateRideCustomId();
    const exists = await Ride.exists({ customId: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Could not generate unique ride id");
};

export const getEstimate = async (req, res) => {
  const { pickup, dropoff } = req.body;
  if (!pickup || !dropoff) {
    return res
      .status(400)
      .json({ message: "Please provide pickup and dropoff locations" });
  }

  const { distanceKm, durationMin } = await getRouteData(pickup, dropoff);

  const bikeFare = calculateFare(distanceKm, "bike");
  const autoFare = calculateFare(distanceKm, "auto");
  const cabFare = calculateFare(distanceKm, "cab");

  res.json({
    pickup,
    dropoff,
    distance: `${distanceKm} km`,
    duration: `${durationMin} mins`,
    currency: "₹",
    options: [
      {
        id: "bike",
        type: "TaxiNova Bike",
        description: "Beat the traffic",
        price: bikeFare,
        eta: `${Math.max(Math.ceil(durationMin * 0.7), 2)} mins`,
        iconUrl: "🏍️",
      },
      {
        id: "auto",
        type: "TaxiNova Auto",
        description: "Haggle-free rides",
        price: autoFare,
        eta: `${Math.max(Math.ceil(durationMin * 0.9), 4)} mins`,
        iconUrl: "🛺",
      },
      {
        id: "cab",
        type: "TaxiNova Cab",
        description: "Comfortable & clean",
        price: cabFare,
        eta: `${Math.max(Math.ceil(durationMin * 1.1), 6)} mins`,
        iconUrl: "🚗",
      },
    ],
  });
};

export const bookRide = async (req, res) => {
  const { pickup, dropoff, fare, vehicleType, pickupLat, pickupLng } = req.body;

  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "User not authorized" });

    if (!pickup || !dropoff) {
      return res
        .status(400)
        .json({ message: "Pickup and dropoff are required" });
    }

    if (!VEHICLE_TYPES.has(vehicleType)) {
      return res.status(400).json({
        message: "Invalid vehicle type. Allowed values: bike, auto, cab",
      });
    }

    const customRideId = await createUniqueRideCustomId();
    const routeData = await getRouteData(pickup, dropoff);
    const actualFare = calculateFare(routeData.distanceKm, vehicleType);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const newRide = await Ride.create({
      user: user._id,
      pickup,
      dropoff,
      fare: actualFare,
      vehicleType,
      // Lock booking payment method at server side to avoid accidental client overrides
      paymentMethod: "cash",
      customId: customRideId,
      otp,
    });

    const populatedRide = await Ride.findById(newRide._id).populate(
      "user",
      "name phone",
    );

    // Find online captains with matching vehicle type
    const nearbyCaptains = await Captain.find({
      vehicleType,
      approvalStatus: "approved",
      isOnline: true,
    });

    // If pickup coords provided, sort by proximity (within 10km); else broadcast all
    let targetCaptains = nearbyCaptains;
    if (pickupLat && pickupLng) {
      targetCaptains = nearbyCaptains.filter(
        (c) =>
          c.location?.lat &&
          c.location?.lng &&
          getDistanceKm(pickupLat, pickupLng, c.location.lat, c.location.lng) <=
            10,
      );
      // Fallback: if no nearby captain found, broadcast to all online
      if (targetCaptains.length === 0) targetCaptains = nearbyCaptains;
    }

    // Broadcast ride request to each matching captain via their room (NO otp sent to captain)
    const io = getIo();
    targetCaptains.forEach((captain) => {
      io.to(`captain_${captain._id}`).emit("ride:new", {
        rideId: newRide._id,
        pickup,
        dropoff,
        fare: actualFare,
        vehicleType,
        user: { name: user.name, phone: user.phone },
      });
    });

    res.status(201).json({
      message:
        targetCaptains.length > 0
          ? `Ride request sent to ${targetCaptains.length} captain(s).`
          : "Ride booked. Waiting for a captain to accept.",
      ride: populatedRide,
    });
  } catch (error) {
    console.error("bookRide error:", error);

    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "Ride booking conflict. Please retry." });
    }

    return res
      .status(500)
      .json({ message: "Error booking ride", error: error.message });
  }
};

export const getPendingRides = async (req, res) => {
  try {
    const captain = req.captain;
    const rides = await Ride.find({
      status: "pending",
      vehicleType: captain.vehicleType,
    }).populate("user", "name phone");
    res.json(rides);
  } catch {
    res.status(500).json({ message: "Error fetching rides" });
  }
};

export const getActiveRide = async (req, res) => {
  try {
    const captain = req.captain;
    const ride = await Ride.findOne({
      captain: captain._id,
      status: { $in: ["accepted", "ongoing"] },
    }).populate("user", "name phone");
    res.json({ activeRide: ride || null });
  } catch {
    res.status(500).json({ message: "Error fetching active ride" });
  }
};

export const acceptRide = async (req, res) => {
  const { rideId } = req.body;
  try {
    const captain = req.captain;
    const ride = await Ride.findById(rideId).populate("user", "name phone");

    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.status !== "pending")
      return res.status(400).json({ message: "Ride is no longer available" });

    ride.status = "accepted";
    ride.captain = captain._id;
    await ride.save();

    const populatedRide = await Ride.findById(ride._id)
      .populate("user", "name phone")
      .populate(
        "captain",
        "name phone vehicleType vehicleNumber rating photo location",
      );

    // Notify the user in real-time
    const io = getIo();
    io.to(`user_${ride.user._id}`).emit("ride:accepted", {
      rideId: ride._id,
      captain: {
        name: captain.name,
        phone: captain.phone,
        vehicleType: captain.vehicleType,
        vehicleNumber: captain.vehicleNumber,
        rating: captain.rating,
        photo: captain.photo,
        location: captain.location,
        _id: captain._id,
      },
      otp: ride.otp,
    });

    res.json({ message: "Ride accepted successfully", ride: populatedRide });
  } catch (error) {
    res.status(500).json({ message: "Error accepting ride" });
  }
};

const COMMISSION_RATE = 0.08; // 8% admin commission

export const updateRideStatus = async (req, res) => {
  const { rideId, status, otp } = req.body;
  try {
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.captain.toString() !== req.captain._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this ride" });
    }

    if (status === "ongoing") {
      if (!otp)
        return res
          .status(400)
          .json({ message: "OTP is required to start the ride" });
      if (ride.otp !== otp)
        return res.status(400).json({ message: "Invalid OTP" });
    }

    ride.status = status;

    // Calculate 8% commission on completion
    if (status === "completed") {
      const fare = Number(ride.fare) || 0;
      ride.commission = Math.round(fare * COMMISSION_RATE);
      ride.captainEarning = Math.round(fare * (1 - COMMISSION_RATE));
    }

    await ride.save();

    const io = getIo();
    io.to(`user_${ride.user}`).emit("ride:statusUpdate", {
      rideId: ride._id,
      status,
    });
    if (status === "completed") {
      io.to(`captain_${ride.captain}`).emit("ride:completed", {
        rideId: ride._id,
      });
    }

    res.json({ message: "Ride status updated", ride });
  } catch (error) {
    res.status(500).json({ message: "Error updating status" });
  }
};

export const cancelRide = async (req, res) => {
  const { rideId, cancelReason } = req.body;
  try {
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized to cancel this ride" });
    }

    if (["completed", "cancelled"].includes(ride.status)) {
      return res
        .status(400)
        .json({ message: "Ride cannot be cancelled at this stage" });
    }

    ride.status = "cancelled";
    if (cancelReason) ride.cancelReason = cancelReason;
    await ride.save();

    if (ride.captain) {
      const io = getIo();
      io.to(`captain_${ride.captain}`).emit("ride:cancelled", {
        rideId: ride._id,
        reason: cancelReason,
      });
    }

    res.json({ message: "Ride cancelled successfully", ride });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error cancelling ride", error: error.message });
  }
};

// Captain cancels an accepted/ongoing ride
export const captainCancelRide = async (req, res) => {
  const { rideId, cancelReason } = req.body;
  try {
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    // Allow cancel if captain matches OR if ride is still pending (no captain assigned yet)
    const isCaptainRide =
      ride.captain && ride.captain.toString() === req.captain._id.toString();
    const isPending = ride.status === "pending";

    if (!isCaptainRide && !isPending) {
      return res
        .status(403)
        .json({ message: "Unauthorized to cancel this ride" });
    }

    if (["completed", "cancelled"].includes(ride.status)) {
      return res
        .status(400)
        .json({ message: "Ride cannot be cancelled at this stage" });
    }

    ride.status = "cancelled";
    ride.cancelReason = cancelReason || "Cancelled by captain";
    await ride.save();

    // Notify user
    const io = getIo();
    io.to(`user_${ride.user}`).emit("ride:cancelledByCaptain", {
      rideId: ride._id,
      reason: ride.cancelReason,
    });

    res.json({ message: "Ride cancelled by captain", ride });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error cancelling ride", error: error.message });
  }
};

export const getRideById = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).populate(
      "captain",
      "name phone vehicleType vehicleNumber rating photo location",
    );
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    // Never expose OTP to captain — only the user who booked the ride may see it
    const rideObj = ride.toObject();
    const isUser = req.user && ride.user.toString() === req.user._id.toString();
    if (!isUser) delete rideObj.otp;
    res.json(rideObj);
  } catch {
    res.status(500).json({ message: "Error fetching ride details" });
  }
};

export const getUserRides = async (req, res) => {
  try {
    const user = req.user;
    const rides = await Ride.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate("captain", "name phone vehicleType vehicleNumber rating photo");
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user rides", error: error.message });
  }
};

