import mongoose from 'mongoose';
import { env } from './application';

const db = env.MONGODB_URI;

const dbConnect = async (): Promise<typeof mongoose> => {
  try {
    const conn = await mongoose.connect(db);
    console.log('MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error; 
  }
};

export default dbConnect;