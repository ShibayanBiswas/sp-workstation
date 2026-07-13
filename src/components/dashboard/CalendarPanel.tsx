"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const MARKERS: Record<string, string> = {
  // Sample SP desk markers — extend later from live calendar API
};

export function CalendarPanel() {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[var(--fg-subtle)]">
            CALENDAR
          </p>
          <h3 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
            {format(cursor, "MMMM yyyy")}
          </h3>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="btn-ghost !p-2"
            onClick={() => setCursor((d) => subMonths(d, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="btn-ghost !p-2"
            onClick={() => setCursor((d) => addMonths(d, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] tracking-wider text-[var(--fg-subtle)]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const selectedDay = isSameDay(day, selected);
          const today = isSameDay(day, new Date());
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(day)}
              className={`relative aspect-square rounded-lg text-sm transition ${
                selectedDay
                  ? "gold-gradient font-semibold text-[#111]"
                  : today
                    ? "border border-[var(--gold)] text-[var(--fg)]"
                    : inMonth
                      ? "hover:bg-[var(--bg-muted)]"
                      : "text-[var(--fg-subtle)] opacity-40"
              }`}
            >
              {format(day, "d")}
              {MARKERS[key] ? (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--gold-deep)]" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-[var(--fg-subtle)]">
        Selected: {format(selected, "EEEE, d MMMM yyyy")}
      </p>
    </div>
  );
}
