// api/_lib/db.js
// Cached MongoDB connection so we don't reconnect on every serverless invocation.
const mongoose = require('mongoose');

let cached = global._abem_mongoose;
if (!cached) {
  cached = global._abem_mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
