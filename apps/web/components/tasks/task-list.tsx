import { daysUntil, formatDueDate } from "@jarvis/shared";
import { AlignLeft, CalendarDays, MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TaskCheckbox } from "./task-checkbox";

export type TaskListItem = {
  id: string;
  title: string;
  dueDate: Date;
  completed: boolean;
  completedAt: Date | null;
  description: string | null;
  client: { name: string; slug: string } | null;
  _count: { comments: number };
};

export function TaskList({
  tasks,
  now,
  showClient = true,
}: {
  tasks: TaskListItem[];
  now: Date;
  showClient?: boolean;
}) {
  return (
    <ul className="divide-y divide-border/60">
      {tasks.map((task) => {
        const days = daysUntil(task.dueDate, now);
        const overdue = !task.completed && days < 0;
        const today = !task.completed && days === 0;
        return (
          <li key={task.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="pt-0.5">
              <TaskCheckbox taskId={task.id} title={task.title} completed={task.completed} />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/tasks/${task.id}`}
                className={cn(
                  "block truncate text-sm hover:text-primary",
                  task.completed &&
                    "text-muted-foreground line-through decoration-muted-foreground/60",
                )}
              >
                {task.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "flex items-center gap-1 font-mono",
                    overdue && "text-status-critical",
                    today && "text-primary",
                  )}
                >
                  <CalendarDays className="size-3" />
                  {formatDueDate(task.dueDate, now, task.completed)}
                </span>
                {showClient &&
                  (task.client ? (
                    <Link href={`/clients/${task.client.slug}`} className="hover:text-primary">
                      {task.client.name}
                    </Link>
                  ) : (
                    <span className="italic">Internal</span>
                  ))}
                {task.description && (
                  <span className="flex items-center gap-1" title="Has a description">
                    <AlignLeft className="size-3" />
                    <span className="sr-only">Has a description</span>
                  </span>
                )}
                {task._count.comments > 0 && (
                  <span className="flex items-center gap-1 font-mono">
                    <MessageSquare className="size-3" />
                    {task._count.comments}
                    <span className="sr-only">comments</span>
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
