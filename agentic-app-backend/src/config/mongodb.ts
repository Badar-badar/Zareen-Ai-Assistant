import mongoose from "mongoose";

export async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("Please provide MONGODB_URI in the environment variables");
    }

    mongoose.set('bufferCommands', false);
    mongoose.connection.on('connected', () => {
        console.log("MongoDB connected");
    });
    mongoose.connection.on('error', (error) => {
        console.log("Error connecting to MongoDB", error);
        process.exit(1);
    });
    mongoose.connection.on('disconnected', () => {
        console.log("MongoDB disconnected");
    });


    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log("MongoDB connected");
    } catch (error) {
        console.log("Error connecting to MongoDB", error);
        process.exit(1);
    }
}

export default connectDB;