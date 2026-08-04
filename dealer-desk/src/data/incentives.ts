import { dollars } from "@/lib/desking/money";
import type { Incentive } from "@/lib/desking/types";

/**
 * Seed incentives. Manually entered placeholders, not live OEM programs.
 *
 * The `source` field exists so that once a real feed is connected, a desk can
 * tell at a glance which offers came from the manufacturer bulletin and which
 * someone typed in.
 */
export const SEED_INCENTIVES: Incentive[] = [
  {
    id: "customer-cash-1500",
    name: "Customer cash",
    kind: "customer_cash",
    amount: dollars(1500),
    subventedRate: null,
    eligibleTerms: [],
    dealTypes: ["finance", "cash", "balloon"],
    stackable: true,
    customerFacing: true,
    expiresOn: null,
    source: "Manual entry",
  },
  {
    id: "subvented-apr-39",
    name: "3.9% APR for 60 months",
    kind: "subvented_apr",
    amount: dollars(0),
    subventedRate: 0.039,
    eligibleTerms: [36, 48, 60],
    dealTypes: ["finance"],
    stackable: false,
    customerFacing: true,
    expiresOn: null,
    source: "Manual entry",
  },
  {
    id: "lease-cash-1000",
    name: "Lease cash",
    kind: "lease_cash",
    amount: dollars(1000),
    subventedRate: null,
    eligibleTerms: [24, 36, 39],
    dealTypes: ["lease"],
    stackable: true,
    customerFacing: true,
    expiresOn: null,
    source: "Manual entry",
  },
  {
    id: "loyalty-750",
    name: "Loyalty bonus",
    kind: "loyalty",
    amount: dollars(750),
    subventedRate: null,
    eligibleTerms: [],
    dealTypes: ["finance", "lease", "cash", "balloon"],
    stackable: true,
    customerFacing: true,
    expiresOn: null,
    source: "Manual entry",
  },
  {
    id: "dealer-cash-1000",
    name: "Dealer cash",
    kind: "dealer_cash",
    amount: dollars(1000),
    subventedRate: null,
    eligibleTerms: [],
    dealTypes: ["finance", "lease", "cash", "balloon"],
    stackable: true,
    // Never reduces the customer's price — it lands in gross.
    customerFacing: false,
    expiresOn: null,
    source: "Manual entry",
  },
];
