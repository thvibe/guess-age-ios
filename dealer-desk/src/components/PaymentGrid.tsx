"use client";

import { formatMoneyWhole, type Cents } from "@/lib/desking/money";
import type { GridCell } from "@/lib/desking/grid";

/**
 * The payment grid.
 *
 * Terms down the side, cash down across the top, a payment in every cell. This
 * is the whole reason a desk manager opens the tool: not "what is the payment"
 * but "what is the shape of this deal, and where does the customer's number sit
 * on it".
 *
 * Two signals are carried by colour and nothing else is:
 *   - the selected cell (accent)
 *   - cells that break a lender guideline (negative), because quoting one is
 *     worse than not quoting at all.
 * A ring marks the cell nearest the customer's stated payment.
 */

export interface PaymentGridProps {
  grid: GridCell[][];
  terms: number[];
  downPayments: Cents[];
  selected: { row: number; col: number };
  onSelect: (row: number, col: number) => void;
  /** Cell nearest the target payment, if a target has been entered. */
  highlight: { row: number; col: number } | null;
  isCash: boolean;
}

export function PaymentGrid({
  grid,
  terms,
  downPayments,
  selected,
  onSelect,
  highlight,
  isCash,
}: PaymentGridProps) {
  if (isCash) {
    return (
      <div
        className="flex h-full min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        A cash deal has no payment grid. The delivery total is on the right.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              className="sticky left-0 z-10 px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ background: "var(--surface)", color: "var(--text-faint)" }}
            >
              Term
            </th>
            {downPayments.map((down, col) => (
              <th
                key={col}
                className="px-3 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-wider tnum"
                style={{ color: "var(--text-faint)" }}
              >
                {formatMoneyWhole(down)}
                <span className="ml-1 font-normal normal-case tracking-normal">down</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, rowIdx) => (
            <tr key={terms[rowIdx]}>
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 text-left text-[0.8125rem] font-medium tnum"
                style={{
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                {terms[rowIdx]} mo
              </th>
              {row.map((cell, colIdx) => {
                const isSelected = selected.row === rowIdx && selected.col === colIdx;
                const isNearest = highlight?.row === rowIdx && highlight?.col === colIdx;
                const blocked = cell.quote.warnings.some((w) => w.level === "block");

                return (
                  <td
                    key={colIdx}
                    style={{ borderTop: "1px solid var(--border)", padding: 0 }}
                  >
                    <button
                      onClick={() => onSelect(rowIdx, colIdx)}
                      aria-pressed={isSelected}
                      title={
                        blocked
                          ? cell.quote.warnings.find((w) => w.level === "block")?.message
                          : `${terms[rowIdx]} months at ${formatMoneyWhole(cell.cashDown)} down`
                      }
                      className="w-full px-3 py-1.5 text-right tnum transition-colors"
                      style={{
                        background: isSelected
                          ? "var(--accent)"
                          : blocked
                            ? "var(--negative-soft)"
                            : "transparent",
                        color: isSelected
                          ? "var(--accent-text)"
                          : blocked
                            ? "var(--negative)"
                            : "var(--text)",
                        fontWeight: isSelected ? 650 : 500,
                        outline: isNearest && !isSelected ? "2px solid var(--accent)" : "none",
                        outlineOffset: "-2px",
                      }}
                    >
                      {formatMoneyWhole(cell.quote.monthlyPayment)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
