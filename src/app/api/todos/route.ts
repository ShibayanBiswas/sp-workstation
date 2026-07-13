import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Todo } from "@/lib/models/Todo";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const todos = await Todo.find({ userId: session.userId })
    .sort({ completed: 1, createdAt: -1 })
    .lean();
  return NextResponse.json({ todos });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid todo" }, { status: 400 });
  }
  await connectDB();
  const todo = await Todo.create({
    userId: session.userId,
    title: parsed.data.title,
    priority: parsed.data.priority || "medium",
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
  });
  return NextResponse.json({ todo });
}

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const patchSchema = z.object({
  id: objectId,
  completed: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }
  await connectDB();
  const todo = await Todo.findOne({
    _id: parsed.data.id,
    userId: session.userId,
  });
  if (!todo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (typeof parsed.data.completed === "boolean") {
    todo.completed = parsed.data.completed;
  }
  if (parsed.data.title) todo.title = parsed.data.title;
  if (parsed.data.priority) todo.priority = parsed.data.priority;
  await todo.save();
  return NextResponse.json({ todo });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !objectId.safeParse(id).success) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }
  await connectDB();
  await Todo.deleteOne({ _id: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}
