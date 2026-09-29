import { prisma } from "@jarvis/db";
import { dateOnlyKey, formatDueDate, formatLondonDateTime } from "@jarvis/shared";
import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type * as React from "react";
import { ConfirmDeleteButton } from "@/components/forms/confirm-delete-button";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { CommentForm } from "@/components/tasks/comment-form";
import { DeleteCommentButton } from "@/components/tasks/delete-comment-button";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { TaskForm } from "@/components/tasks/task-form";
import { Badge } from "@/components/ui/badge";
import { addCommentAction, deleteTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { loadTaskClients } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, select: { title: true } });
  return { title: task?.title ?? "Task not found" };
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function TaskDetailPage({ params }: Params) {
  const { id } = await params;
  const [task, activeClients] = await Promise.all([
    prisma.task.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, slug: true } },
        comments: { orderBy: { createdAt: "asc" } },
      },
    }),
    loadTaskClients(),
  ]);
  if (!task) notFound();

  const clients =
    task.client && !activeClients.some((c) => c.id === task.client?.id)
      ? [...activeClients, task.client]
      : activeClients;
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Tasks", href: "/tasks" },
          ...(task.client
            ? [{ label: task.client.name, href: `/tasks?client=${task.client.slug}` }]
            : []),
          { label: task.title },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <HudPanel
            label={task.client ? task.client.name : "Internal"}
            title={
              <span className="flex items-center gap-3">
                <TaskCheckbox
                  taskId={task.id}
                  title={task.title}
                  completed={task.completed}
                  size="lg"
                />
                <span className={cn(task.completed && "text-muted-foreground line-through")}>
                  {task.title}
                </span>
              </span>
            }
          >
            <TaskForm
              initial={{
                title: task.title,
                clientId: task.clientId ?? "",
                dueDate: dateOnlyKey(task.dueDate),
                description: task.description ?? "",
              }}
              clients={clients}
              action={updateTaskAction.bind(null, task.id)}
            />
          </HudPanel>

          <HudPanel label="Discussion" title={`Comments (${task.comments.length})`} corners={false}>
            {task.comments.length > 0 ? (
              <ol className="mb-5 flex flex-col gap-4">
                {task.comments.map((c) => (
                  <li key={c.id} className="group flex gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] uppercase",
                        c.authorType === "INTECK"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-status-warning/40 bg-status-warning/10 text-status-warning",
                      )}
                    >
                      {c.authorName.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-foreground">{c.authorName}</span>
                        {c.authorType === "CONTACT" && task.client && (
                          <Badge variant="outline">{task.client.name}</Badge>
                        )}
                        <time
                          dateTime={c.createdAt.toISOString()}
                          className="font-mono text-muted-foreground"
                        >
                          {formatLondonDateTime(c.createdAt)}
                        </time>
                        <span className="ml-auto">
                          <DeleteCommentButton commentId={c.id} />
                        </span>
                      </div>
                      <p className="mt-1 text-sm break-words whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="size-4" />
                No comments yet.
              </p>
            )}
            <CommentForm action={addCommentAction.bind(null, task.id)} />
          </HudPanel>
        </div>

        <div className="flex flex-col gap-6">
          <HudPanel label="Details" corners={false}>
            <dl className="divide-y divide-border/60">
              <Meta label="Status">
                {task.completed ? (
                  <Badge variant="healthy">Done</Badge>
                ) : (
                  <Badge variant="outline">Open</Badge>
                )}
              </Meta>
              <Meta label="Due">
                <span className="font-mono">
                  {formatDueDate(task.dueDate, now, task.completed)}
                </span>
              </Meta>
              <Meta label="Client">
                {task.client ? (
                  <Link
                    href={`/clients/${task.client.slug}`}
                    className="text-primary hover:underline"
                  >
                    {task.client.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Internal</span>
                )}
              </Meta>
              <Meta label="Created">
                <span className="font-mono text-xs">{formatLondonDateTime(task.createdAt)}</span>
              </Meta>
              {task.completedAt && (
                <Meta label="Completed">
                  <span className="font-mono text-xs">
                    {formatLondonDateTime(task.completedAt)}
                  </span>
                </Meta>
              )}
            </dl>
          </HudPanel>

          <HudPanel label="Danger zone" corners={false} tone="muted">
            <p className="mb-3 text-xs text-muted-foreground">
              Deleting removes the task and its comments. Completing it keeps the history for
              reports.
            </p>
            <ConfirmDeleteButton
              action={deleteTaskAction.bind(null, task.id)}
              confirmText={`Delete "${task.title}" and its comments?`}
              label="Delete task"
            />
          </HudPanel>
        </div>
      </div>
    </div>
  );
}
