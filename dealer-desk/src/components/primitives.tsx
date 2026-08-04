"use client";

import { useEffect, useState } from "react";
import {
  formatMoney,
  formatMoneyWhole,
  parseMoney,
  toDollars,
  type Cents,
} from "@/lib/desking/money";

/**
 * Small shared building blocks. Kept together because each is a few lines and
 * splitting them across files buys nothing.
 */

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-head">
          <span>{title}</span>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Money input that only commits on blur or Enter.
 *
 * Reformatting mid-keystroke fights the user — type "1" into a formatted field
 * and it becomes "$1.00", and the next keystroke lands in the wrong place. The
 * raw string is held while focused and parsed on the way out.
 */
export function MoneyField({
  label,
  value,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: Cents;
  onChange: (next: Cents) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <label className="field" title={hint}>
      <span className="field-label">{label}</span>
      <input
        className="input tnum"
        inputMode="decimal"
        disabled={disabled}
        value={draft ?? formatMoney(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft(String(toDollars(value)))}
        onBlur={() => {
          if (draft !== null) onChange(parseMoney(draft));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** Percentage input stored as a decimal (0.0699) but edited as a percent (6.99). */
export function RateField({
  label,
  value,
  onChange,
  step = 0.01,
  digits = 3,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  digits?: number;
  hint?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <label className="field" title={hint}>
      <span className="field-label">{label}</span>
      <span className="flex items-center gap-1">
        <input
          className="input tnum"
          inputMode="decimal"
          step={step}
          value={draft ?? (value * 100).toFixed(digits)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setDraft((value * 100).toFixed(digits))}
          onBlur={() => {
            if (draft !== null) {
              const parsed = Number.parseFloat(draft);
              onChange(Number.isFinite(parsed) ? parsed / 100 : 0);
            }
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          %
        </span>
      </span>
    </label>
  );
}

/** Raw numeric field for money factor, which is conventionally shown as-is. */
export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  digits = 0,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  digits?: number;
  hint?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <label className="field" title={hint}>
      <span className="field-label">{label}</span>
      <input
        className="input tnum"
        inputMode="decimal"
        step={step}
        value={draft ?? value.toFixed(digits)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft(String(value))}
        onBlur={() => {
          if (draft !== null) {
            const parsed = Number.parseFloat(draft);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** A read-only label/value row. `tone` colours the value where sign has meaning. */
export function Readout({
  label,
  value,
  tone = "neutral",
  emphasis = false,
  hint,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "muted";
  emphasis?: boolean;
  hint?: string;
}) {
  const color =
    tone === "positive"
      ? "var(--positive)"
      : tone === "negative"
        ? "var(--negative)"
        : tone === "muted"
          ? "var(--text-faint)"
          : "var(--text)";

  return (
    <div className="field" title={hint}>
      <span className="field-label">{label}</span>
      <span
        className="tnum"
        style={{
          color,
          fontSize: emphasis ? "1rem" : "0.8125rem",
          fontWeight: emphasis ? 650 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function MoneyReadout({
  label,
  value,
  signed = false,
  emphasis = false,
  hint,
}: {
  label: string;
  value: Cents;
  signed?: boolean;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <Readout
      label={label}
      value={signed && value !== 0 ? `${value < 0 ? "−" : ""}${formatMoney(Math.abs(value) as Cents)}` : formatMoney(value)}
      tone={signed ? (value < 0 ? "negative" : value > 0 ? "positive" : "muted") : "neutral"}
      emphasis={emphasis}
      hint={hint}
    />
  );
}

export { formatMoneyWhole };

/** Segmented control. Used for deal type, which is the highest-level switch. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: "var(--surface-3)" }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="rounded-md px-3 py-1 text-[0.8125rem] font-medium transition-colors"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 2px rgb(0 0 0 / 0.12)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Theme toggle. Defaults to the OS preference until the user overrides it. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className="rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      aria-label="Toggle colour theme"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
