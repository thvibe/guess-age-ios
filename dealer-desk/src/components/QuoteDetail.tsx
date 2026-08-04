"use client";

import { useState } from "react";
import { Panel, MoneyReadout, Readout } from "./primitives";
import { formatMoney, formatPercent, type Cents } from "@/lib/desking/money";
import type { DealWarning, Quote, StateRule } from "@/lib/desking/types";

/**
 * Right-hand column: what the selected grid cell actually means.
 *
 * Deliberately split into customer-facing numbers (payment, due at signing) and
 * dealer-only numbers (gross), with a visual break between them. Someone will
 * eventually turn this screen toward a customer.
 */

export function WarningList({ warnings }: { warnings: DealWarning[] }) {
  if (warnings.length === 0) return null;

  const order = { block: 0, warn: 1, info: 2 } as const;
  const sorted = [...warnings].sort((a, b) => order[a.level] - order[b.level]);

  return (
    <Panel title={`Flags (${warnings.length})`}>
      <ul className="flex flex-col gap-1.5 p-2.5">
        {sorted.map((w, i) => {
          const tone =
            w.level === "block"
              ? { bg: "var(--negative-soft)", fg: "var(--negative)", label: "Blocked" }
              : w.level === "warn"
                ? { bg: "var(--warning-soft)", fg: "var(--warning)", label: "Check" }
                : { bg: "var(--surface-2)", fg: "var(--text-muted)", label: "Note" };

          return (
            <li
              key={`${w.code}-${i}`}
              className="rounded-md px-2.5 py-2 text-xs leading-relaxed"
              style={{ background: tone.bg, color: tone.fg }}
            >
              <span className="mr-1.5 font-semibold uppercase tracking-wide">{tone.label}</span>
              {w.message}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function GrossPanel({ quote }: { quote: Quote }) {
  const { profit } = quote;
  return (
    <Panel
      title="Gross — dealer only"
      action={
        <span
          className="rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide"
          style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
        >
          Do not show
        </span>
      }
    >
      <div className="py-1">
        <MoneyReadout
          label="Front gross"
          value={profit.frontGross}
          signed
          hint="Selling price less vehicle cost, pack, and any over-allowance on the trade."
        />
        {quote.trade.overAllowance > 0 && (
          <MoneyReadout
            label="…of which over-allowance"
            value={-quote.trade.overAllowance as Cents}
            signed
            hint="Money shown to the customer above the trade's actual cash value."
          />
        )}
        <MoneyReadout label="F&I product gross" value={profit.fiProductGross} signed />
        <MoneyReadout
          label="Finance reserve"
          value={profit.reserve}
          signed
          hint="Present value of the rate spread at the buy rate, times the dealer's share."
        />
        <MoneyReadout label="Back gross" value={profit.backGross} signed />
        {profit.dealerCash > 0 && (
          <MoneyReadout label="Dealer cash" value={profit.dealerCash} signed />
        )}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
          <MoneyReadout label="Total gross" value={profit.totalGross} signed emphasis />
        </div>
      </div>
    </Panel>
  );
}

export function TaxPanel({ quote, rule }: { quote: Quote; rule: StateRule }) {
  const [open, setOpen] = useState(false);

  return (
    <Panel
      title="Tax & fees"
      action={
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[0.6875rem] font-medium normal-case tracking-normal"
          style={{ color: "var(--accent)" }}
        >
          {open ? "Hide math" : "Show math"}
        </button>
      }
    >
      <div className="py-1">
        <Readout
          label={`${rule.name} rate`}
          value={formatPercent(quote.taxes.effectiveRate, 3)}
        />
        <MoneyReadout label="Taxable base" value={quote.taxes.taxableBase} />
        {quote.taxes.monthlyTax > 0 ? (
          <MoneyReadout
            label="Tax per payment"
            value={quote.taxes.monthlyTax}
            hint="This state taxes each lease payment rather than the vehicle."
          />
        ) : (
          <MoneyReadout label="Sales tax" value={quote.taxes.total} />
        )}
        <MoneyReadout label="Fees financed" value={quote.fees.capitalized} />
        <MoneyReadout label="Fees due at signing" value={quote.fees.dueAtSigning} />
      </div>

      {open && (
        <div
          className="px-3 py-2.5 text-xs leading-relaxed"
          style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
        >
          <p className="mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
            How the taxable base was derived
          </p>
          <ol className="flex flex-col gap-1">
            {quote.taxes.explanation.map((line, i) => (
              <li key={i} className="tnum" style={{ color: "var(--text-muted)" }}>
                {line}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}

export function CustomerSummary({ quote }: { quote: Quote }) {
  const isCash = quote.dealType === "cash";
  const isLease = quote.dealType === "lease";

  return (
    <Panel title="Customer numbers">
      <div className="px-3.5 pb-2 pt-3">
        <p className="text-[0.6875rem] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          {isCash ? "Due at delivery" : `${quote.term} months`}
        </p>
        <p className="tnum" style={{ fontSize: "2rem", fontWeight: 680, lineHeight: 1.1 }}>
          {formatMoney(isCash ? quote.dueAtSigning : quote.monthlyPayment)}
          {!isCash && (
            <span className="ml-1 text-sm font-medium" style={{ color: "var(--text-faint)" }}>
              /mo
            </span>
          )}
        </p>
      </div>

      <div className="py-1" style={{ borderTop: "1px solid var(--border)" }}>
        {!isCash && (
          <>
            {isLease && <MoneyReadout label="Base payment" value={quote.basePayment} />}
            <Readout
              label={isLease ? "Money factor (as APR)" : "APR"}
              value={formatPercent(quote.apr, isLease ? 2 : 3)}
            />
            <MoneyReadout
              label={isLease ? "Adjusted cap cost" : "Amount financed"}
              value={quote.amountFinanced}
            />
            <MoneyReadout label="Total of payments" value={quote.totalOfPayments} />
            {quote.dealType !== "lease" && (
              <MoneyReadout label="Finance charge" value={quote.financeCharge} />
            )}
            {quote.residual > 0 && (
              <MoneyReadout
                label={isLease ? "Residual value" : "Balloon due at end"}
                value={quote.residual}
              />
            )}
          </>
        )}
        <MoneyReadout
          label={isCash ? "Total due" : "Due at signing"}
          value={quote.dueAtSigning}
          emphasis
        />
        {quote.trade.allowance > 0 && (
          <MoneyReadout
            label="Trade equity"
            value={quote.trade.equity}
            signed
            hint="Allowance less payoff. Negative equity is rolled into the deal."
          />
        )}
      </div>
    </Panel>
  );
}
