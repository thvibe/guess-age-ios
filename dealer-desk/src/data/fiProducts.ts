import { dollars } from "@/lib/desking/money";
import type { FiProduct } from "@/lib/desking/types";

/**
 * Default F&I menu. Prices and costs are dealer-configurable; these are a
 * starting point that exercises the back-gross math.
 */
export const DEFAULT_FI_MENU: FiProduct[] = [
  {
    id: "vsc",
    name: "Vehicle service contract",
    category: "vsc",
    price: dollars(2495),
    cost: dollars(1150),
    capitalized: true,
    taxableOverride: null,
    selected: false,
  },
  {
    id: "gap",
    name: "GAP coverage",
    category: "gap",
    price: dollars(895),
    cost: dollars(325),
    capitalized: true,
    taxableOverride: null,
    selected: false,
  },
  {
    id: "maintenance",
    name: "Prepaid maintenance",
    category: "maintenance",
    price: dollars(1195),
    cost: dollars(600),
    capitalized: true,
    taxableOverride: null,
    selected: false,
  },
  {
    id: "tire-wheel",
    name: "Tire & wheel protection",
    category: "tire_wheel",
    price: dollars(795),
    cost: dollars(280),
    capitalized: true,
    taxableOverride: null,
    selected: false,
  },
  {
    id: "appearance",
    name: "Appearance protection",
    category: "appearance",
    price: dollars(695),
    cost: dollars(195),
    capitalized: true,
    taxableOverride: null,
    selected: false,
  },
  {
    id: "key",
    name: "Key replacement",
    category: "key_replacement",
    price: dollars(395),
    cost: dollars(120),
    capitalized: true,
    taxableOverride: null,
    selected: false,
  },
];
