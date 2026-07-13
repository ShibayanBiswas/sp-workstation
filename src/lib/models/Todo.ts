import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const TodoSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    dueDate: { type: Date },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  { timestamps: true }
);

export type TodoDocument = InferSchemaType<typeof TodoSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Todo = models.Todo || model("Todo", TodoSchema);
