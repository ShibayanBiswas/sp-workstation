import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },
    team: { type: String, default: "Structured Products" },
    /** Current login device — previous JWTs with a different sid are rejected. */
    activeSessionId: { type: String, default: null },
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

// Next.js HMR can keep a stale compiled model without new paths — rebuild if needed.
const existing = models.User as mongoose.Model<UserDocument> | undefined;
if (existing && !existing.schema.path("activeSessionId")) {
  delete models.User;
}

export const User =
  (models.User as mongoose.Model<UserDocument> | undefined) ||
  model<UserDocument>("User", UserSchema);
