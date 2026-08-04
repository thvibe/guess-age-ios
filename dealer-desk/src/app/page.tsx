"use client";

import { useMemo, useState } from "react";
import {
  FeesPanel,
  FiMenuPanel,
  StateAndVehicle,
  TermsPanel,
  TradePanel,
} from "@/components/DealForm";
import { PaymentGrid } from "@/components/PaymentGrid";
import {
  CustomerSummary,
  GrossPanel,
  TaxPanel,
  WarningList,
} from "@/components/QuoteDetail";
import { MoneyField, Panel, Segmented, ThemeToggle } from "@/components/primitives";
import { allSourcesManual } from "@/adapters";
import { createDefaultDeal } from "@/data/defaultDeal";
import { LENDER_PROGRAMS, programsForScore, tierForScore } from "@/data/lenders";
import { getStateRule } from "@/data/states";
import { calculate } from "@/lib/desking/calculate";
import {
  DEFAULT_LEASE_TERMS,
  DEFAULT_TERMS,
  buildPaymentGrid,
  closestToPayment,
} from "@/lib/desking/grid";
import { ZERO, dollars, formatMoney, type Cents } from "@/lib/desking/money";
import type { DealInput, DealType } from "@/lib/desking/types";

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: "finance", label: "Finance" },
  { value: "lease", label: "Lease" },
  { value: "cash", label: "Cash" },
  { value: "balloon", label: "Balloon" },
];

export default function DeskPage() {
  const [deal, setDeal] = useState<DealInput>(() => createDefaultDeal("TX"));
  const [downStep, setDownStep] = useState<Cents>(dollars(1500));
  const [targetPayment, setTargetPayment] = useState<Cents>(ZERO);
  const [selected, setSelected] = useState({ row: 2, col: 2 });
  const [creditScore, setCreditScore] = useState(730);

  const rule = getStateRule(deal.state);
  const isCash = deal.dealType === "cash";

  const terms = deal.dealType === "lease" ? DEFAULT_LEASE_TERMS : DEFAULT_TERMS;
  const downPayments = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => (downStep * i) as Cents),
    [downStep],
  );

  // The lender drives guideline warnings only — it never silently rewrites rates.
  const lender = useMemo(() => {
    const eligible = programsForScore(creditScore).filter((p) =>
      p.dealTypes.includes(deal.dealType),
    );
    return eligible[0] ?? LENDER_PROGRAMS.find((p) => p.dealTypes.includes(deal.dealType));
  }, [creditScore, deal.dealType]);

  const grid = useMemo(
    () => buildPaymentGrid(deal, { terms, downPayments }, { lender }),
    [deal, terms, downPayments, lender],
  );

  // Clamp the selection whenever the axes change under it (e.g. switching to lease).
  const row = Math.min(selected.row, terms.length - 1);
  const col = Math.min(selected.col, downPayments.length - 1);

  const nearest = useMemo(() => {
    if (targetPayment <= 0 || isCash) return null;
    const match = closestToPayment(grid, targetPayment);
    if (!match) return null;
    const r = terms.indexOf(match.term);
    const c = downPayments.indexOf(match.cashDown);
    return r >= 0 && c >= 0 ? { row: r, col: c } : null;
  }, [grid, targetPayment, terms, downPayments, isCash]);

  // Cash has no grid, so it quotes the deal as typed rather than a cell.
  const quote = isCash
    ? calculate(deal, { lender })
    : grid[row]![col]!.quote;

  const effectiveDown = isCash ? deal.cashDown : downPayments[col]!;

  return (
    <main className="mx-auto max-w-[112rem] px-3 py-4 sm:px-5 lg:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Dealer Desk</h1>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model} {deal.vehicle.trim}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            options={DEAL_TYPES}
            value={deal.dealType}
            onChange={(dealType) => setDeal({ ...deal, dealType })}
          />
          <ThemeToggle />
        </div>
      </header>

      {allSourcesManual() && (
        <p
          className="mb-3 rounded-md px-3 py-2 text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <strong style={{ color: "var(--text)" }}>Manual data.</strong> Rates, incentives, and
          state tax figures are dealer-entered, not fed from a rate service. Every number is
          editable and none has been verified against a live program.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,21rem)]">
        {/* Inputs */}
        <div className="flex flex-col gap-3">
          <StateAndVehicle deal={deal} rule={rule} onChange={setDeal} />
          <TradePanel deal={deal} rule={rule} onChange={setDeal} />
          <TermsPanel deal={deal} rule={rule} onChange={setDeal} />
        </div>

        {/* Grid — the centre of the product */}
        <div className="flex flex-col gap-3">
          <Panel
            title={isCash ? "Cash deal" : "Payment grid"}
            action={
              lender && (
                <span className="text-[0.6875rem] font-normal normal-case tracking-normal" style={{ color: "var(--text-faint)" }}>
                  {lender.lenderName} · Tier {tierForScore(creditScore)}
                </span>
              )
            }
          >
            <div
              className="grid grid-cols-1 gap-x-4 px-2 py-1 sm:grid-cols-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <MoneyField
                label="Down step"
                value={downStep}
                onChange={(v) => setDownStep(v > 0 ? v : dollars(500))}
                hint="Spacing between the grid's cash-down columns."
              />
              <MoneyField
                label="Customer's payment"
                value={targetPayment}
                onChange={setTargetPayment}
                disabled={isCash}
                hint="Enter what the customer said and the closest cell is ringed."
              />
              <label className="field">
                <span className="field-label">Credit score</span>
                <input
                  className="input tnum"
                  type="number"
                  min={300}
                  max={900}
                  value={creditScore}
                  onChange={(e) => setCreditScore(Number(e.target.value) || 0)}
                />
              </label>
            </div>

            <PaymentGrid
              grid={grid}
              terms={terms}
              downPayments={downPayments}
              selected={{ row, col }}
              onSelect={(r, c) => setSelected({ row: r, col: c })}
              highlight={nearest}
              isCash={isCash}
            />

            {!isCash && (
              <p
                className="px-3 py-2 text-[0.6875rem]"
                style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}
              >
                Showing {formatMoney(effectiveDown)} down over {quote.term} months.
                {nearest && targetPayment > 0 && " Ringed cell is closest to the customer's number."}
              </p>
            )}
          </Panel>

          <FeesPanel deal={deal} rule={rule} onChange={setDeal} />
          <FiMenuPanel deal={deal} rule={rule} onChange={setDeal} />
        </div>

        {/* Selected quote */}
        <div className="flex flex-col gap-3">
          <CustomerSummary quote={quote} />
          <WarningList warnings={quote.warnings} />
          <TaxPanel quote={quote} rule={rule} />
          <GrossPanel quote={quote} />
        </div>
      </div>
    </main>
  );
}
