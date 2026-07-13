import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  memory: MongoMemoryServer | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
  memory: null,
};

global.mongooseCache = cached;

async function resolveUri(): Promise<string> {
  const configured = process.env.MONGODB_URI?.trim();
  if (configured && configured !== "memory") {
    return configured;
  }

  // Local / CI fallback when Atlas URI is not configured yet
  if (!cached.memory) {
    cached.memory = await MongoMemoryServer.create();
    console.warn(
      "[SP Workstation] Using in-memory MongoDB. Set MONGODB_URI for Atlas/production."
    );
  }
  return cached.memory.getUri("sp-workstation");
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      const uri = await resolveUri();
      return mongoose.connect(uri, { bufferCommands: false });
    })();
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
