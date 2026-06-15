import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// GET all users (Read)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET a single user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST add a new user (Create via Admin/API)
export const addUser = async (req, res) => {
  const { name, phone, password, address, email } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: 'Please provide name and phone at minimum' });
  }

  try {
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this phone already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    // Provide a default password if not supplied
    const hashedPassword = await bcrypt.hash(password || '123456', salt);

    const newUser = await User.create({
      name,
      phone,
      password: hashedPassword,
      address,
      email
    });

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({ message: 'User added successfully', user: userResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT update a user (Update)
export const updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // Hash new password if updating it
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE a user (Delete)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
