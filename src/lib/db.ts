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

/**
 * Ensure Atlas URIs always target the dedicated `sp-workstation` database
 * so a shared Cluster0 never accidentally uses another project's DB.
 */
export function normalizeMongoUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed || trimmed === "memory") return trimmed;

  try {
    // mongodb+srv://user:pass@host/db?params  OR  mongodb://...
    const schemeSplit = trimmed.indexOf("://");
    if (schemeSplit === -1) return trimmed;
    const afterScheme = trimmed.slice(schemeSplit + 3);
    const slash = afterScheme.indexOf("/");
    const q = afterScheme.indexOf("?");

    if (slash === -1) {
      // No DB path — insert /sp-workstation before query or at end
      if (q === -1) return `${trimmed}/sp-workstation`;
      const hostPart = trimmed.slice(0, schemeSplit + 3 + q);
      const query = afterScheme.slice(q);
      return `${hostPart}/sp-workstation${query}`;
    }

    const dbAndQuery = afterScheme.slice(slash + 1);
    const dbName = dbAndQuery.split("?")[0];
    if (!dbName || dbName === "test" || dbName === "admin") {
      const hostPart = trimmed.slice(0, schemeSplit + 3 + slash);
      const query = dbAndQuery.includes("?")
        ? dbAndQuery.slice(dbAndQuery.indexOf("?"))
        : "";
      return `${hostPart}sp-workstation${query}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

async function resolveUri(): Promise<string> {
  const configured = process.env.MONGODB_URI?.trim();
  if (configured && configured !== "memory") {
    return normalizeMongoUri(configured);
  }

  if (!cached.memory) {
    cached.memory = await MongoMemoryServer.create();
    console.warn(
      "[SP Workstation] Using in-memory MongoDB. Set MONGODB_URI for Atlas/production."
    );
  }
  return cached.memory.getUri("sp-workstation");
}

function friendlyMongoError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("whitelist") ||
    lower.includes("ip that isn't") ||
    lower.includes("could not connect to any servers")
  ) {
    return new Error(
      "Database blocked by MongoDB Atlas Network Access. In Atlas → Network Access, add 0.0.0.0/0 (Allow from anywhere), wait 2 minutes, then retry."
    );
  }
  if (lower.includes("authentication failed") || lower.includes("bad auth")) {
    return new Error(
      "MongoDB authentication failed. Check MONGODB_URI username/password on Vercel (URL-encode @ as %40)."
    );
  }
  if (lower.includes("enotfound") || lower.includes("querySrv")) {
    return new Error(
      "Could not resolve MongoDB Atlas host. Recheck MONGODB_URI cluster hostname on Vercel."
    );
  }
  return err instanceof Error ? err : new Error(raw);
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      const uri = await resolveUri();
      return mongoose.connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 12_000,
        connectTimeoutMS: 12_000,
        maxPoolSize: 5,
      });
    })().catch((err) => {
      // Allow the next request to retry after a failed cold-start connect.
      cached.promise = null;
      cached.conn = null;
      throw friendlyMongoError(err);
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw friendlyMongoError(err);
  }
}
