"use client";

import { MoneyField, NumberField, Panel, RateField, Readout } from "./primitives";
import { STATE_LIST } from "@/data/states";
import { defaultFees } from "@/lib/desking/fees";
import { ZERO, dollars, formatMoney, type Cents } from "@/lib/desking/money";
import type { DealInput, StateCode, StateRule, Trade } from "@/lib/desking/types";

/**
 * Left column: everything the desk types in.
 *
 * Ordered the way a deal is actually built — car, then customer's trade, then
 * money, then the back end — rather than grouped by data type.
 */

export interface DealFormProps {
  deal: DealInput;
  rule: StateRule;
  onChange: (next: DealInput) => void;
}

export function StateAndVehicle({ deal, rule, onChange }: DealFormProps) {
  return (
    <Panel
      title="Vehicle & price"
      action={
        !rule.verified && (
          <span
            className="rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide"
            style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
            title="Tax and fee figures for this state have not been human-verified."
          >
            Unverified
          </span>
        )
      }
    >
      <div className="py-1">
        <label className="field">
          <span className="field-label">State</span>
          <select
            className="select"
            value={deal.state}
            onChange={(e) => {
              const state = e.target.value as StateCode;
              const nextRule = STATE_LIST.find((s) => s.code === state)!;
              // Fee defaults are state-specific — swap them with the state so the
              // desk isn't quoting Texas fees on a California deal.
              onChange({
                ...deal,
                state,
                localTaxRateOverride: null,
                fees: defaultFees(nextRule),
              });
            }}
          >
            {STATE_LIST.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <RateField
          label="Local tax rate"
          value={deal.localTaxRateOverride ?? rule.typicalLocalTaxRate}
          onChange={(v) => onChange({ ...deal, localTaxRateOverride: v })}
          hint="Defaults to a typical rate for the state. Set the actual district rate for the customer's ZIP."
        />
        <Readout
          label="Combined rate"
          value={`${((rule.stateTaxRate + (deal.localTaxRateOverride ?? rule.typicalLocalTaxRate)) * 100).toFixed(3)}%`}
          tone="muted"
        />

        <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <MoneyField
          label="MSRP"
          value={deal.vehicle.msrp}
          onChange={(msrp) => onChange({ ...deal, vehicle: { ...deal.vehicle, msrp } })}
        />
        <MoneyField
          label="Selling price"
          value={deal.sellingPrice}
          onChange={(sellingPrice) => onChange({ ...deal, sellingPrice })}
        />
        <MoneyField
          label="Vehicle cost"
          value={deal.vehicle.cost}
          onChange={(cost) => onChange({ ...deal, vehicle: { ...deal.vehicle, cost } })}
          hint="Dealer cost. Drives front gross — never shown to the customer."
        />
        <MoneyField
          label="Pack"
          value={deal.vehicle.pack}
          onChange={(pack) => onChange({ ...deal, vehicle: { ...deal.vehicle, pack } })}
        />
        <MoneyField
          label="Rebates"
          value={deal.rebates}
          onChange={(rebates) => onChange({ ...deal, rebates })}
          hint={
            rule.rebateReducesTaxableBase
              ? "Reduces the taxable base in this state."
              : `${rule.name} taxes the pre-rebate price.`
          }
        />
        <MoneyField
          label="Dealer cash"
          value={deal.dealerCash}
          onChange={(dealerCash) => onChange({ ...deal, dealerCash })}
          hint="Manufacturer money to the dealer. Lands in gross; never touches the customer's numbers."
        />
      </div>
    </Panel>
  );
}

const EMPTY_TRADE: Trade = { allowance: ZERO, actualCashValue: ZERO, payoff: ZERO };

export function TradePanel({ deal, rule, onChange }: DealFormProps) {
  const trade = deal.trade;
  const creditNote =
    rule.tradeInCredit.kind === "none"
      ? `No trade tax credit in ${rule.code}`
      : rule.tradeInCredit.kind === "capped"
        ? `Trade credit capped at ${formatMoney(rule.tradeInCredit.max)}`
        : "Full trade tax credit";

  return (
    <Panel
      title="Trade"
      action={
        <button
          className="text-[0.6875rem] font-medium normal-case tracking-normal"
          style={{ color: "var(--accent)" }}
          onClick={() => onChange({ ...deal, trade: trade ? null : { ...EMPTY_TRADE } })}
        >
          {trade ? "Remove" : "Add trade"}
        </button>
      }
    >
      {trade ? (
        <div className="py-1">
          <MoneyField
            label="Allowance"
            value={trade.allowance}
            onChange={(allowance) => onChange({ ...deal, trade: { ...trade, allowance } })}
            hint="What the customer is shown for their trade."
          />
          <MoneyField
            label="Actual cash value"
            value={trade.actualCashValue}
            onChange={(actualCashValue) =>
              onChange({ ...deal, trade: { ...trade, actualCashValue } })
            }
            hint="What the trade is really worth. Allowance above ACV comes straight out of front gross."
          />
          <MoneyField
            label="Payoff"
            value={trade.payoff}
            onChange={(payoff) => onChange({ ...deal, trade: { ...trade, payoff } })}
          />
          <p className="px-3.5 pb-1.5 pt-1 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            {creditNote}
          </p>
        </div>
      ) : (
        <p className="px-3.5 py-3 text-xs" style={{ color: "var(--text-faint)" }}>
          No trade on this deal. {creditNote} in {rule.code}.
        </p>
      )}
    </Panel>
  );
}

export function TermsPanel({ deal, onChange }: DealFormProps) {
  const isLease = deal.dealType === "lease";
  const lease = deal.lease;

  return (
    <Panel title={isLease ? "Lease program" : "Rate & term"}>
      <div className="py-1">
        {isLease && lease ? (
          <>
            <NumberField
              label="Money factor"
              value={lease.moneyFactor}
              digits={5}
              step={0.00005}
              onChange={(moneyFactor) => onChange({ ...deal, lease: { ...lease, moneyFactor } })}
              hint="Multiply by 2400 for the equivalent APR."
            />
            <NumberField
              label="Base money factor"
              value={lease.baseMoneyFactor}
              digits={5}
              step={0.00005}
              onChange={(baseMoneyFactor) =>
                onChange({ ...deal, lease: { ...lease, baseMoneyFactor } })
              }
              hint="The lender's buy rate. Markup over this is dealer reserve."
            />
            <RateField
              label="Residual"
              value={lease.residualPercent}
              digits={1}
              onChange={(residualPercent) =>
                onChange({ ...deal, lease: { ...lease, residualPercent } })
              }
              hint="Percentage of MSRP the vehicle is worth at lease end."
            />
            <NumberField
              label="Annual mileage"
              value={lease.annualMileage}
              step={1000}
              onChange={(annualMileage) =>
                onChange({ ...deal, lease: { ...lease, annualMileage } })
              }
            />
            <MoneyField
              label="Acquisition fee"
              value={lease.acquisitionFee}
              onChange={(acquisitionFee) =>
                onChange({ ...deal, lease: { ...lease, acquisitionFee } })
              }
            />
            <label className="field">
              <span className="field-label">Capitalize acq. fee</span>
              <input
                type="checkbox"
                checked={lease.capitalizeAcquisitionFee}
                onChange={(e) =>
                  onChange({
                    ...deal,
                    lease: { ...lease, capitalizeAcquisitionFee: e.target.checked },
                  })
                }
              />
            </label>
          </>
        ) : (
          <>
            <RateField
              label="Sell rate (APR)"
              value={deal.sellRate}
              onChange={(sellRate) => onChange({ ...deal, sellRate })}
            />
            <RateField
              label="Buy rate (APR)"
              value={deal.buyRate}
              onChange={(buyRate) => onChange({ ...deal, buyRate })}
              hint="The lender's rate. The spread to the sell rate is dealer reserve."
            />
            {deal.dealType === "balloon" && (
              <RateField
                label="Balloon residual"
                value={deal.balloonResidualPercent}
                digits={1}
                onChange={(balloonResidualPercent) =>
                  onChange({ ...deal, balloonResidualPercent })
                }
                hint="Final balance as a percentage of MSRP."
              />
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

export function FeesPanel({ deal, rule, onChange }: DealFormProps) {
  return (
    <Panel
      title="Fees"
      action={
        rule.docFeeCap !== null && (
          <span className="text-[0.6875rem] font-normal normal-case tracking-normal" style={{ color: "var(--text-faint)" }}>
            Doc cap {formatMoney(rule.docFeeCap)}
          </span>
        )
      }
    >
      <div className="py-1">
        {deal.fees.map((fee) => (
          <MoneyField
            key={fee.id}
            label={fee.label}
            value={fee.amount}
            onChange={(amount) =>
              onChange({
                ...deal,
                fees: deal.fees.map((f) => (f.id === fee.id ? { ...f, amount } : f)),
              })
            }
            hint={fee.taxable ? "Taxable in this state." : "Not taxable."}
          />
        ))}
      </div>
    </Panel>
  );
}

export function FiMenuPanel({ deal, onChange }: DealFormProps) {
  const selectedCount = deal.fiProducts.filter((p) => p.selected).length;
  const backEnd = deal.fiProducts
    .filter((p) => p.selected)
    .reduce((sum, p) => sum + p.price, 0) as Cents;

  return (
    <Panel
      title="F&I menu"
      action={
        <span className="text-[0.6875rem] font-normal normal-case tracking-normal tnum" style={{ color: "var(--text-faint)" }}>
          {selectedCount} selected · {formatMoney(backEnd)}
        </span>
      }
    >
      <ul className="py-1">
        {deal.fiProducts.map((product) => (
          <li key={product.id} className="field">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={product.selected}
                onChange={(e) =>
                  onChange({
                    ...deal,
                    fiProducts: deal.fiProducts.map((p) =>
                      p.id === product.id ? { ...p, selected: e.target.checked } : p,
                    ),
                  })
                }
              />
              <span className="field-label" style={{ color: product.selected ? "var(--text)" : undefined }}>
                {product.name}
              </span>
            </label>
            <span className="flex items-center gap-2">
              <span
                className="tnum text-[0.6875rem]"
                style={{ color: "var(--text-faint)" }}
                title="Dealer cost"
              >
                {formatMoney(product.cost)}
              </span>
              <input
                className="input tnum"
                style={{ maxWidth: "6rem" }}
                inputMode="decimal"
                defaultValue={(product.price / 100).toFixed(0)}
                onBlur={(e) => {
                  const parsed = Number.parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                  onChange({
                    ...deal,
                    fiProducts: deal.fiProducts.map((p) =>
                      p.id === product.id
                        ? { ...p, price: dollars(Number.isFinite(parsed) ? parsed : 0) }
                        : p,
                    ),
                  });
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
