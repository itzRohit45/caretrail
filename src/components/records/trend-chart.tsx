"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ArrowRight, ArrowSquareOut } from "@phosphor-icons/react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BpPoint, Trend, TrendPoint } from "@/lib/records/trends";
import { RangeLine } from "@/components/ui/range-line";
import { cn } from "@/lib/cn";

const VARS = ["--chart-1", "--chart-2", "--rule", "--ink-2", "--ink-3", "--sheet", "--verified-soft", "--verified-rule"] as const;
type Palette = Record<(typeof VARS)[number], string>;

/** SVG presentation attributes cannot read CSS variables, so resolve them (and follow theme changes). */
function usePalette() {
  const [p, setP] = useState<Palette | null>(null);
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      setP(Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(v).trim()])) as Palette);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return p;
}

/** Round axis ticks (4 to 6 of them) covering the data and the normal range. */
function niceTicks(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rough = (max - min || Math.abs(max) || 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= rough) ?? 10 * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const fmtDate = (d: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00+05:30`));
const fmtTick = (t: number) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(t));

function Delta({ now, before, unit, beforeDate }: { now: number; before: number; unit: string; beforeDate: string }) {
  const diff = Math.round((now - before) * 100) / 100;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : ArrowRight;
  const word = diff > 0 ? "Up" : diff < 0 ? "Down" : "No change";
  return (
    <p className="flex items-center gap-1 text-dense text-ink-2">
      <Icon aria-hidden weight="bold" className="size-4 shrink-0" />
      {word}
      {diff !== 0 ? ` ${Math.abs(diff)} ${unit}` : ""} since {fmtDate(beforeDate)}
    </p>
  );
}

function Dot(props: { cx?: number; cy?: number; payload?: { documentId: string }; color: string; ring: string; onOpen: (id: string) => void; label: string }) {
  const { cx, cy, payload, color, ring, onOpen, label } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <g onClick={() => onOpen(payload.documentId)} style={{ cursor: "pointer" }} role="link" aria-label={label}>
      <circle cx={cx} cy={cy} r={16} fill="transparent" />
      <circle cx={cx} cy={cy} r={5.5} fill={color} stroke={ring} strokeWidth={2} />
    </g>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-control border border-rule bg-sheet px-3 py-2 text-dense shadow-float">{children}</div>;
}

export function TrendCard({ trend }: { trend: Trend }) {
  const palette = usePalette();
  const router = useRouter();
  const open = (id: string) => router.push(`/records/${id}`);
  const pts = trend.points as (TrendPoint | BpPoint)[];
  const last = pts.at(-1);
  // Change is measured against the last earlier date; other labs on the same day are named, not compared.
  const prev = last ? [...pts].reverse().find((p) => p.date < last.date) : undefined;
  const sameDay = last ? pts.filter((p) => p !== last && p.date === last.date) : [];
  const isBp = trend.key === "BP";
  const value = (p: TrendPoint | BpPoint) => ("value" in p ? `${p.value}` : `${p.sys}/${p.dia}`);
  const outOfRange = (p: TrendPoint) => trend.range && ((trend.range.low !== null && p.value < trend.range.low) || (trend.range.high !== null && p.value > trend.range.high));

  const yValues = pts.flatMap((p) => ("value" in p ? [p.value] : [p.sys, p.dia]));
  if (!isBp && trend.range) yValues.push(...[trend.range.low, trend.range.high].filter((v): v is number => v !== null));
  if (isBp) yValues.push(80, 120);
  const ticks = yValues.length ? niceTicks(yValues) : [];

  const summary = last
    ? `${trend.title}: ${pts.length} result${pts.length > 1 ? "s" : ""}${pts.length > 1 ? ` from ${fmtDate(pts[0].date)} to ${fmtDate(last.date)}` : ""}, latest ${value(last)} ${trend.unit}${!isBp && trend.range ? `, normal range ${trend.range.low ?? "below"} to ${trend.range.high ?? "above"}` : ""}.`
    : `${trend.title}: no results yet.`;

  return (
    <section aria-labelledby={`t-${trend.key}`} className="rounded-card border border-rule bg-sheet p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`t-${trend.key}`} className="text-title font-bold">{trend.title}</h2>
          {!isBp && trend.range ? (
            <p className="text-meta text-ink-2">
              Normal range {trend.range.low ?? 0} to {trend.range.high} {trend.unit}
            </p>
          ) : isBp ? (
            <p className="text-meta text-ink-2">Dashed guides at 120 and 80 mmHg</p>
          ) : null}
        </div>
        {last ? (
          <div className="sm:text-right">
            <p className="font-serif text-display font-medium tabular-nums">
              {value(last)} <span className="font-sans text-lead text-ink-2">{trend.unit}</span>
            </p>
            {prev && "value" in last && "value" in prev ? <Delta now={last.value} before={prev.value} unit={trend.unit} beforeDate={prev.date} /> : null}
            {prev && !("value" in last) && !("value" in prev) ? <p className="text-dense text-ink-2">Previous {prev.sys}/{prev.dia} on {fmtDate(prev.date)}</p> : null}
            {sameDay.map((p) => (
              <p key={p.id} className="text-dense text-ink-2">
                Same day: {value(p)} {trend.unit}
                {p.facility ? ` at ${p.facility}` : ""}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {pts.length === 0 ? (
        <p className="mt-5 rounded-control bg-sheet-sunk px-4 py-6 text-center text-ink-2">
          No {trend.title} results yet. They appear here when you add a lab report that includes them.
        </p>
      ) : pts.length === 1 && !isBp && trend.range ? (
        <div className="mt-6">
          <RangeLine value={(last as TrendPoint).value} low={trend.range.low} high={trend.range.high} unit={trend.unit} />
          <p className="mt-3 text-dense text-ink-2">One result so far. A trend line appears after your next test.</p>
        </div>
      ) : (
        <div className="mt-5" role="img" aria-label={summary}>
          {isBp ? (
            <div aria-hidden className="mb-2 flex gap-5 text-meta font-semibold text-ink-2">
              <span className="flex items-center gap-2"><span className="h-0.5 w-6 bg-chart-1" /> Systolic</span>
              <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-chart-2" /> Diastolic</span>
            </div>
          ) : null}
          <div className="h-56">
            {palette ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pts} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid vertical={false} stroke={palette["--rule"]} />
                  {!isBp && trend.range ? (
                    <ReferenceArea
                      y1={trend.range.low ?? 0}
                      y2={trend.range.high ?? undefined}
                      fill={palette["--verified-soft"]}
                      fillOpacity={1}
                      stroke="none"
                      label={{ value: "Normal range", position: "insideBottomLeft", fill: palette["--ink-2"], fontSize: 12 }}
                    />
                  ) : null}
                  {isBp ? (
                    <>
                      <ReferenceLine y={120} stroke={palette["--ink-3"]} strokeDasharray="4 4" />
                      <ReferenceLine y={80} stroke={palette["--ink-3"]} strokeDasharray="4 4" />
                    </>
                  ) : null}
                  <XAxis dataKey="t" type="number" scale="time" domain={["dataMin - 1500000000", "dataMax + 1500000000"]} tickFormatter={fmtTick} tick={{ fill: palette["--ink-2"], fontSize: 13 }} stroke={palette["--rule"]} minTickGap={24} />
                  <YAxis tick={{ fill: palette["--ink-2"], fontSize: 13 }} stroke="none" width={44} domain={[ticks[0], ticks.at(-1) ?? "auto"]} ticks={ticks} interval={0} />
                  <Tooltip
                    cursor={{ stroke: palette["--ink-3"], strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      const p = active && payload?.[0]?.payload as (TrendPoint | BpPoint) | undefined;
                      if (!p) return null;
                      return (
                        <TipBox>
                          <p className="font-bold">{fmtDate(p.date)}</p>
                          <p className="font-serif text-lead tabular-nums">
                            {"value" in p ? `${p.value} ${trend.unit}` : `${p.sys}/${p.dia} ${trend.unit}`}
                          </p>
                          {"original" in p && p.original ? <p className="text-meta text-ink-2">Printed as {p.original}</p> : null}
                          {p.facility ? <p className="text-meta text-ink-2">{p.facility}</p> : null}
                          <p className="text-meta font-semibold text-primary">Tap the point to open the report</p>
                        </TipBox>
                      );
                    }}
                  />
                  {isBp ? (
                    <>
                      <Line dataKey="sys" stroke={palette["--chart-1"]} strokeWidth={2} isAnimationActive={false} dot={<Dot color={palette["--chart-1"]} ring={palette["--sheet"]} onOpen={open} label="Open this blood pressure reading's source" />} activeDot={false} />
                      <Line dataKey="dia" stroke={palette["--chart-2"]} strokeWidth={2} strokeDasharray="6 4" isAnimationActive={false} dot={<Dot color={palette["--chart-2"]} ring={palette["--sheet"]} onOpen={open} label="Open this blood pressure reading's source" />} activeDot={false} />
                    </>
                  ) : (
                    <Line dataKey="value" stroke={palette["--chart-1"]} strokeWidth={2} isAnimationActive={false} dot={<Dot color={palette["--chart-1"]} ring={palette["--sheet"]} onOpen={open} label={`Open this ${trend.title} result's source`} />} activeDot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full animate-pulse rounded-control bg-sheet-sunk" />
            )}
          </div>
        </div>
      )}

      {pts.length ? (
        <details className="group mt-4 border-t border-rule pt-3">
          <summary className="cursor-pointer list-none font-semibold text-primary">
            <span className="group-open:hidden">Show all values</span>
            <span className="hidden group-open:inline">Hide values</span>
          </summary>
          <table className="mt-3 w-full text-left text-dense">
            <thead>
              <tr className="text-meta text-ink-2">
                <th scope="col" className="py-1.5 font-semibold">Date</th>
                <th scope="col" className="py-1.5 font-semibold">Result</th>
                <th scope="col" className="hidden py-1.5 font-semibold sm:table-cell">From</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {[...pts].reverse().map((p) => (
                <tr key={p.id}>
                  <td className="py-2 tabular-nums">{fmtDate(p.date)}</td>
                  <td className="py-2 font-semibold tabular-nums">
                    {value(p)} {trend.unit}
                    {"value" in p && outOfRange(p) ? <span className="ml-2 text-meta font-semibold text-ink-2">outside normal range</span> : null}
                  </td>
                  <td className="hidden py-2 text-ink-2 sm:table-cell">{p.facility}</td>
                  <td className="py-2 text-right">
                    <Link href={`/records/${p.documentId}`} className={cn("inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline")}>
                      Open <ArrowSquareOut aria-hidden className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </section>
  );
}
