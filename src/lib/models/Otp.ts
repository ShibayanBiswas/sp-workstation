import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const OtpSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpDocument = InferSchemaType<typeof OtpSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Otp = models.Otp || model("Otp", OtpSchema);
