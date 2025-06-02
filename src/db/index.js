import mongoose from 'mongoose'
import { DB_NAME } from '../constants.js'

const connectDB = async () => {
    try {
        const instance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`db connected at ${instance.connection.host}`);
    } catch (error) {
        console.log(`mongodb connection failed: ${error}`);
        throw error;
    }
}

export default connectDB;