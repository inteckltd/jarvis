import { type Prisma, prisma } from "@jarvis/db";
import {
  dateOnlyKey,
  isTaskView,
  TASK_BUCKETS,
  type TaskBucket,
  taskBucket,
  type TaskView,
} from "@jarvis/shared";
import { CheckCheck, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { SectionLabel } from "@/components/hud/section-label";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskList, type TaskListItem } from "@/components/tasks/task-list";
import { loadTaskClients, TASK_LIST_SELECT } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tasks" };

const COMPLETED_LIMIT = 100;

const VIEW_LABEL: Record<TaskView, string> = {
  open: "All open",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
};

const BUCKET_EMPTY: Record<TaskBucket, string> = {
  overdue: "Nothing overdue.",
  today: "Nothing due today.",
  upcoming: "Nothing scheduled.",
};

type Props = {
  searchParams: Promise<{ view?: string | string[]; client?: string | string[] }>;
};

function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export default async function TasksPage({ searchParams }: Props) {
  const query = await searchParams;
  const viewParam = one(query.view);
  const view: TaskView = isTaskView(viewParam) ? viewParam : "open";
  const clientParam = one(query.client);

  const clients = await loadTaskClients();
  const selectedClient = clients.find((c) => c.slug === clientParam);
  const internalOnly = clientParam === "internal";
  const clientWhere: Prisma.TaskWhereInput = internalOnly
    ? { clientId: null }
    : selectedClient
      ? { clientId: selectedClient.id }
      : {};

  const now = new Date();
  const [open, completedCount, completed] = await Promise.all([
    prisma.task.findMany({
      where: { ...clientWhere, completed: false },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: TASK_LIST_SELECT,
    }),
    prisma.task.count({ where: { ...clientWhere, completed: true } }),
    view === "completed"
      ? prisma.task.findMany({
          where: { ...clientWhere, completed: true },
          orderBy: { completedAt: "desc" },
          take: COMPLETED_LIMIT,
          select: TASK_LIST_SELECT,
        })
      : Promise.resolve([]),
  ]);

  const buckets: Record<TaskBucket, TaskListItem[]> = { overdue: [], today: [], upcoming: [] };
  for (const task of open) buckets[taskBucket(task.dueDate, now)].push(task);

  const counts: Record<TaskView, number> = {
    open: open.length,
    overdue: buckets.overdue.length,
    today: buckets.today.length,
    upcoming: buckets.upcoming.length,
    completed: completedCount,
  };

  const href = (next: { view?: TaskView; client?: string | null }) => {
    const params = new URLSearchParams();
    const v = next.view ?? view;
    const c = next.client === undefined ? clientParam : next.client;
    if (v !== "open") params.set("view", v);
    if (c) params.set("client", c);
    const qs = params.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };

  const clientFilters = [
    { key: null, label: "All" },
    ...clients.map((c) => ({ key: c.slug, label: c.name })),
    { key: "internal", label: "Internal" },
  ];
  const activeClientKey = internalOnly ? "internal" : (selectedClient?.slug ?? null);
  const showClient = !selectedClient && !internalOnly;

  return (
    <div className="flex flex-col gap-6">
      <HudPanel label="Operations" title="Tasks">
        <QuickAddTask
          clients={clients}
          today={dateOnlyKey(now)}
          defaultClientId={selectedClient?.id ?? ""}
        />
      </HudPanel>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Task views" className="flex flex-wrap gap-1">
          {(["open", ...TASK_BUCKETS, "completed"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                v === view
                  ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_14px_-6px_var(--glow)]"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {VIEW_LABEL[v]}
              <span
                className={cn(
                  "font-mono text-xs",
                  v === "overdue" && counts.overdue > 0 && "text-status-critical",
                )}
              >
                {counts[v]}
              </span>
            </Link>
          ))}
        </nav>
        <nav aria-label="Filter by client" className="flex flex-wrap items-center gap-1">
          <SectionLabel className="mr-1">Client</SectionLabel>
          {clientFilters.map((f) => (
            <Link
              key={f.key ?? "all"}
              href={href({ client: f.key })}
              aria-current={f.key === activeClientKey ? "true" : undefined}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                f.key === activeClientKey
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      {view === "open" ? (
        open.length === 0 ? (
          <HudPanel corners={false}>
            <EmptyState
              icon={<CheckCheck />}
              title="All clear"
              description="No open tasks. Add one above."
            />
          </HudPanel>
        ) : (
          TASK_BUCKETS.map((bucket) => (
            <HudPanel
              key={bucket}
              label={VIEW_LABEL[bucket]}
              title={
                <span className="flex items-center gap-2">
                  {VIEW_LABEL[bucket]}
                  <span
                    className={cn(
                      "font-mono text-sm text-muted-foreground",
                      bucket === "overdue" && counts.overdue > 0 && "text-status-critical",
                    )}
                  >
                    {counts[bucket]}
                  </span>
                </span>
              }
              corners={false}
              tone={bucket === "upcoming" ? "muted" : "default"}
            >
              {buckets[bucket].length ? (
                <TaskList tasks={buckets[bucket]} now={now} showClient={showClient} />
              ) : (
                <p className="text-sm text-muted-foreground">{BUCKET_EMPTY[bucket]}</p>
              )}
            </HudPanel>
          ))
        )
      ) : (
        <HudPanel label="Tasks" title={VIEW_LABEL[view]} corners={false}>
          {(() => {
            const list = view === "completed" ? completed : buckets[view];
            if (list.length === 0) {
              return (
                <EmptyState
                  icon={<ListChecks />}
                  title={view === "completed" ? "Nothing completed yet" : BUCKET_EMPTY[view]}
                  className="py-8"
                />
              );
            }
            return (
              <>
                <TaskList tasks={list} now={now} showClient={showClient} />
                {view === "completed" && completedCount > COMPLETED_LIMIT && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Showing the latest {COMPLETED_LIMIT} of {completedCount}.
                  </p>
                )}
              </>
            );
          })()}
        </HudPanel>
      )}
    </div>
  );
}
