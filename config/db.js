import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  const connectToUri = async (connectionUri) => {
    const conn = await mongoose.connect(connectionUri, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  };

  try {
    if (!uri) {
      throw new Error('MONGO_URI is not defined');
    }
    await connectToUri(uri);
  } catch (error) {
    console.warn(`Error connecting to MongoDB: ${error.message}`);
    console.warn('Falling back to in-memory MongoDB for development.');

    if (!mongoServer) {
      mongoServer = await MongoMemoryServer.create();
    }

    const memoryUri = mongoServer.getUri();
    const conn = await connectToUri(memoryUri);
    console.log(`In-memory MongoDB running at ${conn.connection.host}`);
  }

  try {
    // Auto-seed admin
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const email = process.env.ADMIN_EMAIL || 'manish@gmail.com';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await Admin.create({
        name: 'Admin User',
        email,
        password: hashedPassword,
      });
      console.log(`Admin user auto-seeded: ${email}`);
    }
  } catch (seedError) {
    console.error(`Error seeding admin user: ${seedError.message}`);
  }
};

export default connectDB;
