"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

type Todo = {
  _id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
};

const priorityColor = {
  low: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  medium: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  high: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
} as const;

export function TodoPanel() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("medium");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (!res.ok) return;
      const data = await res.json();
      setTodos(data.todos || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const done = todos.filter((t) => t.completed).length;
    const total = todos.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const high = todos.filter((t) => !t.completed && t.priority === "high").length;
    return { done, total, pct, high };
  }, [todos]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, priority }),
    });
    if (res.ok) {
      setTitle("");
      await load();
    }
  }

  async function toggle(todo: Todo) {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todo._id, completed: !todo.completed }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/todos?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="glass-panel flex h-full flex-col rounded-2xl">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-[var(--fg-subtle)]">
              PRODUCTIVITY
            </p>
            <h3
              className="text-lg"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Desk to-do
            </h3>
          </div>
          {stats.total > 0 ? (
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums text-[var(--gold-deep)] dark:text-[var(--gold)]">
                {stats.pct}%
              </p>
              <p className="text-[10px] text-[var(--fg-subtle)]">complete</p>
            </div>
          ) : null}
        </div>
        {stats.total > 0 ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full gold-gradient transition-all duration-500"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        ) : null}
        {stats.high > 0 ? (
          <p className="mt-2 text-[10px] text-rose-600 dark:text-rose-400">
            {stats.high} high-priority item{stats.high > 1 ? "s" : ""} pending
          </p>
        ) : null}
      </div>

      <form
        onSubmit={onAdd}
        className="flex gap-2 border-b border-[var(--border)] p-3"
      >
        <input
          className="input-field !py-2.5"
          placeholder="Add observation, rollover, or follow-up…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="input-field !w-auto !py-2.5"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Todo["priority"])}
        >
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
        </select>
        <button
          type="submit"
          className="btn-primary !px-3"
          aria-label="Add todo"
        >
          <Plus size={16} />
        </button>
      </form>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {loading ? (
          <p className="text-sm text-[var(--fg-subtle)]">Loading…</p>
        ) : todos.length === 0 ? (
          <p className="text-sm text-[var(--fg-subtle)]">
            No tasks yet — plan your observation / rollover follow-ups.
          </p>
        ) : (
          todos.map((todo) => (
            <div
              key={todo._id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-3 py-2.5 transition hover:border-[color-mix(in_srgb,var(--gold)_30%,var(--border))]"
            >
              <button
                type="button"
                onClick={() => toggle(todo)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                  todo.completed
                    ? "gold-gradient border-transparent text-[#111]"
                    : "border-[var(--border)] hover:border-[var(--gold)]"
                }`}
                aria-label="Toggle complete"
              >
                {todo.completed ? <Check size={12} /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${
                    todo.completed
                      ? "text-[var(--fg-subtle)] line-through"
                      : ""
                  }`}
                >
                  {todo.title}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${priorityColor[todo.priority]}`}
                >
                  {todo.priority}
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 text-[var(--fg-subtle)] transition hover:text-red-500"
                onClick={() => remove(todo._id)}
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
