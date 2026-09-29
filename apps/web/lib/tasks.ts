import "server-only";
import { type Prisma, prisma } from "@jarvis/db";

export const TASK_LIST_SELECT = {
  id: true,
  title: true,
  dueDate: true,
  completed: true,
  completedAt: true,
  description: true,
  client: { select: { name: true, slug: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskSelect;

export function loadTaskClients() {
  return prisma.client.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}
