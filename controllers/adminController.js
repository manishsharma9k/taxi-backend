import User from '../models/User.js';
import Captain from '../models/Captain.js';
import Contact from '../models/Contact.js';
import HeaderLink from '../models/HeaderLink.js';
import PageContent from '../models/PageContent.js';

import Ride from '../models/Ride.js';

// Get overall stats
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCaptains = await Captain.countDocuments();
    const activeCaptains = await Captain.countDocuments({ isOnline: true, approvalStatus: 'approved' });
    const onlineBike = await Captain.countDocuments({ isOnline: true, approvalStatus: 'approved', vehicleType: 'bike' });
    const onlineAuto = await Captain.countDocuments({ isOnline: true, approvalStatus: 'approved', vehicleType: 'auto' });
    const onlineCab  = await Captain.countDocuments({ isOnline: true, approvalStatus: 'approved', vehicleType: 'cab' });
    const totalContacts = await Contact.countDocuments();
    
    const totalRides = await Ride.countDocuments();
    const bikeRides = await Ride.countDocuments({ vehicleType: 'bike' });
    const autoRides = await Ride.countDocuments({ vehicleType: 'auto' });
    const cabRides = await Ride.countDocuments({ vehicleType: 'cab' });

    const completedRides = await Ride.countDocuments({ status: 'completed' });
    const cancelledRides = await Ride.countDocuments({ status: 'cancelled' });

    const pendingCaptains = await Captain.countDocuments({ approvalStatus: 'pending' });
    const approvedCaptains = await Captain.countDocuments({ approvalStatus: 'approved' });
    const rejectedCaptains = await Captain.countDocuments({ approvalStatus: 'rejected' });

    // Calculate total commission (8% from completed rides)
    const completedRidesData = await Ride.find({ status: 'completed' });
    const totalCommission = completedRidesData.reduce((sum, r) => sum + (Number(r.commission) || 0), 0);
    const totalRevenue = completedRidesData.reduce((sum, r) => sum + (Number(r.fare) || 0), 0);

    res.json({
      totalUsers,
      totalCaptains,
      activeCaptains,
      onlineBike,
      onlineAuto,
      onlineCab,
      totalContacts,
      totalRides,
      bikeRides,
      autoRides,
      cabRides,
      completedRides,
      cancelledRides,
      pendingCaptains,
      approvedCaptains,
      rejectedCaptains,
      totalCommission,
      totalRevenue,
      commissionRate: '8%',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// Get all captains
export const getAllCaptains = async (req, res) => {
  try {
    const captains = await Captain.find().select('-password').sort({ createdAt: -1 });
    res.json(captains);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching captains', error: error.message });
  }
};

// Get currently online captains
export const getOnlineCaptains = async (req, res) => {
  try {
    const captains = await Captain.find({
      isOnline: true,
      approvalStatus: 'approved'
    }).select('name phone vehicleType vehicleNumber rating location isOnline customId photo').sort({ 'location.updatedAt': -1 });
    res.json(captains);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching online captains', error: error.message });
  }
};

// Get all contacts
export const getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contacts', error: error.message });
  }
};

// Get editable header links
export const getHeaderLinks = async (req, res) => {
  try {
    let links = await HeaderLink.find().sort({ order: 1, label: 1 });
    if (!links.length) {
      const defaultLinks = [
        { label: 'Ride', path: '/', visible: true, order: 0 },
        { label: 'Drive', path: '/drive', visible: true, order: 1 },
        { label: 'About', path: '/about', visible: true, order: 2 },
        { label: 'Contact', path: '/contact', visible: true, order: 3 },
      ];
      links = await HeaderLink.create(defaultLinks);
    }
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching header links', error: error.message });
  }
};

// Create a new header link
export const createHeaderLink = async (req, res) => {
  try {
    const { label, path, visible = true, order = 0 } = req.body;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const headerLink = await HeaderLink.create({ label, path: normalizedPath, visible, order });
    res.status(201).json(headerLink);
  } catch (error) {
    res.status(500).json({ message: 'Error creating header link', error: error.message });
  }
};

// Update a header link
export const updateHeaderLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, path, visible, order } = req.body;
    const normalizedPath = path && !path.startsWith('/') ? `/${path}` : path;
    const updates = {
      ...(label !== undefined ? { label } : {}),
      ...(path !== undefined ? { path: normalizedPath } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(order !== undefined ? { order } : {}),
    };
    const headerLink = await HeaderLink.findByIdAndUpdate(id, updates, { new: true });
    if (!headerLink) {
      return res.status(404).json({ message: 'Header link not found' });
    }
    res.json(headerLink);
  } catch (error) {
    res.status(500).json({ message: 'Error updating header link', error: error.message });
  }
};

// Delete a header link
export const deleteHeaderLink = async (req, res) => {
  try {
    const { id } = req.params;
    await HeaderLink.findByIdAndDelete(id);
    res.json({ message: 'Header link deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting header link', error: error.message });
  }
};

// Get all page content records for admin
export const getPageContents = async (req, res) => {
  try {
    const items = await PageContent.find().sort({ order: 1, path: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching page content', error: error.message });
  }
};

// Get page content by frontend path
export const getPageContentByPath = async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({ message: 'Path query parameter is required' });
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const item = await PageContent.findOne({ path: normalizedPath, visible: true });
    if (!item) {
      return res.status(404).json({ message: 'Page content not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching page content', error: error.message });
  }
};

// Create a page content entry
export const createPageContent = async (req, res) => {
  try {
    const { path, title, content, visible = true, order = 0 } = req.body;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const pageContent = await PageContent.create({ path: normalizedPath, title, content, visible, order });
    res.status(201).json(pageContent);
  } catch (error) {
    res.status(500).json({ message: 'Error creating page content', error: error.message });
  }
};

// Update a page content entry
export const updatePageContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { path, title, content, visible, order } = req.body;
    const updates = {
      ...(path !== undefined ? { path: path.startsWith('/') ? path : `/${path}` } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(order !== undefined ? { order } : {}),
    };
    const pageContent = await PageContent.findByIdAndUpdate(id, updates, { new: true });
    if (!pageContent) {
      return res.status(404).json({ message: 'Page content not found' });
    }
    res.json(pageContent);
  } catch (error) {
    res.status(500).json({ message: 'Error updating page content', error: error.message });
  }
};

// Delete a page content entry
export const deletePageContent = async (req, res) => {
  try {
    const { id } = req.params;
    await PageContent.findByIdAndDelete(id);
    res.json({ message: 'Page content deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting page content', error: error.message });
  }
};

// Delete a user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

// Delete a captain
export const deleteCaptain = async (req, res) => {
  try {
    const { id } = req.params;
    await Captain.findByIdAndDelete(id);
    res.json({ message: 'Captain deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting captain', error: error.message });
  }
};

// Approve a captain
export const approveCaptain = async (req, res) => {
  try {
    const { id } = req.params;
    await Captain.findByIdAndUpdate(id, { approvalStatus: 'approved' });
    res.json({ message: 'Captain approved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error approving captain', error: error.message });
  }
};

// Reject a captain
export const rejectCaptain = async (req, res) => {
  try {
    const { id } = req.params;
    await Captain.findByIdAndUpdate(id, { approvalStatus: 'rejected' });
    res.json({ message: 'Captain rejected successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting captain', error: error.message });
  }
};

// Delete a contact
export const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    await Contact.findByIdAndDelete(id);
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting contact', error: error.message });
  }
};

// Get all rides with area-wise filtering
export const getAllRides = async (req, res) => {
  try {
    const { area, vehicleType, status, startDate, endDate } = req.query;
    let query = {};
    if (vehicleType) query.vehicleType = vehicleType;
    if (status) query.status = status;
    if (area) query.$or = [{ pickup: { $regex: area, $options: 'i' } }, { dropoff: { $regex: area, $options: 'i' } }];
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23,59,59));
    }
    const rides = await Ride.find(query)
      .populate('user', 'name phone')
      .populate('captain', 'name phone')
      .sort({ createdAt: -1 });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rides', error: error.message });
  }
};

// Delete a ride
export const deleteRide = async (req, res) => {
  try {
    const { id } = req.params;
    await Ride.findByIdAndDelete(id);
    res.json({ message: 'Ride deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting ride', error: error.message });
  }
};
