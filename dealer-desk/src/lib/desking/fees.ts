import { ZERO, add, sub, type Cents } from "./money";
import type { DealInput, Fee, FeeBreakdown, StateRule } from "./types";

/**
 * Fee handling, including the state doc fee cap.
 *
 * A doc fee over the statutory cap isn't a rounding problem, it's a compliance
 * problem — so the engine trims it AND reports the trim so the UI can surface it
 * rather than silently changing a number the desk typed in.
 */

/** Applies the state doc fee cap, returning the adjusted fee list and the trim amount. */
export function applyDocFeeCap(
  fees: Fee[],
  rule: StateRule,
): { fees: Fee[]; adjustment: Cents } {
  if (rule.docFeeCap === null) return { fees, adjustment: ZERO };

  let adjustment = ZERO;
  const capped = fees.map((fee) => {
    if (!fee.subjectToDocCap) return fee;
    if (fee.amount <= rule.docFeeCap!) return fee;
    adjustment = add(adjustment, sub(fee.amount, rule.docFeeCap!));
    return { ...fee, amount: rule.docFeeCap! };
  });

  return { fees: capped, adjustment };
}

export function summarizeFees(input: DealInput, rule: StateRule): FeeBreakdown {
  const { fees, adjustment } = applyDocFeeCap(input.fees, rule);

  let capitalized = ZERO;
  let dueAtSigning = ZERO;
  for (const fee of fees) {
    if (fee.capitalized) capitalized = add(capitalized, fee.amount);
    else dueAtSigning = add(dueAtSigning, fee.amount);
  }

  return {
    capitalized,
    dueAtSigning,
    total: add(capitalized, dueAtSigning),
    docFeeAdjustment: adjustment,
  };
}

/** Default fee set for a state, used when starting a fresh deal. */
export function defaultFees(rule: StateRule): Fee[] {
  return [
    {
      id: "doc",
      label: "Documentation fee",
      kind: "doc",
      amount: rule.docFeeCap === null ? rule.typicalDocFee : rule.docFeeCap,
      taxable: rule.docFeeTaxable,
      capitalized: true,
      subjectToDocCap: true,
    },
    {
      id: "title",
      label: "Title fee",
      kind: "title",
      amount: rule.titleFee,
      taxable: false,
      capitalized: true,
      subjectToDocCap: false,
    },
    {
      id: "registration",
      label: "Registration",
      kind: "registration",
      amount: rule.registrationFee,
      taxable: false,
      capitalized: true,
      subjectToDocCap: false,
    },
    {
      id: "plate",
      label: "Plate / transfer",
      kind: "plate",
      amount: rule.plateFee,
      taxable: false,
      capitalized: true,
      subjectToDocCap: false,
    },
  ];
}
