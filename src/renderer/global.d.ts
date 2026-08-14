import type { StockEarnApi } from '../shared/types';

declare global { interface Window { stockEarn: StockEarnApi; } }

export {};
