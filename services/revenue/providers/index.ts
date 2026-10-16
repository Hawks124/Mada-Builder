import type { AdapterMap } from "../adapters";
import { stripeAdapter } from "./stripe";
import { revenueCatAdapter } from "./revenuecat";
import { paddleAdapter } from "./paddle";
import { polarAdapter } from "./polar";
import { lemonSqueezyAdapter } from "./lemon-squeezy";

export const REVENUE_ADAPTERS: AdapterMap = {
  stripe: stripeAdapter,
  revenuecat: revenueCatAdapter,
  paddle: paddleAdapter,
  polar: polarAdapter,
  lemon_squeezy: lemonSqueezyAdapter,
};
