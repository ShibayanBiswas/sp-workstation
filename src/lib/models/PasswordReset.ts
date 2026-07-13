import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const PasswordResetSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetDocument = InferSchemaType<
  typeof PasswordResetSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const PasswordReset =
  models.PasswordReset || model("PasswordReset", PasswordResetSchema);
