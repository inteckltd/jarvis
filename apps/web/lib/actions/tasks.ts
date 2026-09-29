"use server";

import { Prisma, prisma } from "@jarvis/db";
import { firstFieldErrors, taskCommentSchema, taskInputSchema } from "@jarvis/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

/** Shown on Inteck's comments, including to client contacts once the portal exists. */
const INTECK_AUTHOR = "Inteck";

export type TaskFormState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Record<string, string> }
  /** `at` changes on every save so forms can reset themselves. */
  | { status: "saved"; at: number; title: string };

export type CommentFormState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Record<string, string> }
  | { status: "saved"; at: number };

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function revalidate() {
  revalidatePath("/tasks", "layout");
  revalidatePath("/clients", "layout");
  revalidatePath("/");
}

async function parseTask(formData: FormData) {
  const parsed = taskInputSchema.safeParse({
    title: text(formData, "title"),
    clientId: text(formData, "clientId"),
    dueDate: text(formData, "dueDate"),
    description: text(formData, "description"),
  });
  if (!parsed.success) {
    return {
      error: {
        status: "error",
        message: null,
        fieldErrors: firstFieldErrors(parsed.error),
      } satisfies TaskFormState,
    };
  }
  if (parsed.data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
      select: { id: true },
    });
    if (!client) {
      return {
        error: {
          status: "error",
          message: null,
          fieldErrors: { clientId: "This client no longer exists" },
        } satisfies TaskFormState,
      };
    }
  }
  return { data: parsed.data };
}

export async function createTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  await requireUser();
  const result = await parseTask(formData);
  if (result.error) return result.error;

  try {
    await prisma.task.create({ data: result.data });
  } catch (error) {
    console.error("Creating task failed", error);
    return {
      status: "error",
      message: "Could not add the task. Please try again.",
      fieldErrors: {},
    };
  }
  revalidate();
  return { status: "saved", at: Date.now(), title: result.data.title };
}

export async function updateTaskAction(
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  await requireUser();
  const result = await parseTask(formData);
  if (result.error) return result.error;

  try {
    await prisma.task.update({ where: { id: taskId }, data: result.data });
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      return { status: "error", message: "This task no longer exists.", fieldErrors: {} };
    }
    console.error("Updating task failed", error);
    return {
      status: "error",
      message: "Could not save the task. Please try again.",
      fieldErrors: {},
    };
  }
  revalidate();
  return { status: "saved", at: Date.now(), title: result.data.title };
}

export async function setTaskCompletedAction(
  taskId: string,
  completed: boolean,
): Promise<{ error: string } | undefined> {
  await requireUser();
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { completed, completedAt: completed ? new Date() : null },
    });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return { error: "This task no longer exists." };
    console.error("Updating task failed", error);
    return { error: "Could not update the task." };
  }
  revalidate();
  return undefined;
}

export async function deleteTaskAction(taskId: string): Promise<{ error: string } | undefined> {
  await requireUser();
  try {
    await prisma.task.delete({ where: { id: taskId } });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return { error: "This task no longer exists." };
    throw error;
  }
  revalidate();
  redirect("/tasks");
}

export async function addCommentAction(
  taskId: string,
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  await requireUser();
  const parsed = taskCommentSchema.safeParse({ body: text(formData, "body") });
  if (!parsed.success) {
    return { status: "error", message: null, fieldErrors: firstFieldErrors(parsed.error) };
  }
  try {
    await prisma.taskComment.create({
      data: { taskId, body: parsed.data.body, authorType: "INTECK", authorName: INTECK_AUTHOR },
    });
  } catch (error) {
    if (isPrismaError(error, "P2003")) {
      return { status: "error", message: "This task no longer exists.", fieldErrors: {} };
    }
    console.error("Adding comment failed", error);
    return { status: "error", message: "Could not post the comment.", fieldErrors: {} };
  }
  revalidate();
  return { status: "saved", at: Date.now() };
}

export async function deleteCommentAction(
  commentId: string,
): Promise<{ error: string } | undefined> {
  await requireUser();
  try {
    await prisma.taskComment.delete({ where: { id: commentId } });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return undefined;
    console.error("Deleting comment failed", error);
    return { error: "Could not delete the comment." };
  }
  revalidate();
  return undefined;
}
