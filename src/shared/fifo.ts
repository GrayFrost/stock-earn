import Decimal from 'decimal.js';
import type { InferredAction, Trade, TradeResult } from './types';

interface Lot {
  tradeId: string;
  direction: 'LONG' | 'SHORT';
  quantity: Decimal;
  price: Decimal;
  feeRemaining: Decimal;
}

export interface FifoComputation {
  trades: TradeResult[];
  direction: 'LONG' | 'SHORT' | 'FLAT';
  longQuantity: string;
  shortQuantity: string;
  averageOpenPrice: string;
  realizedPnl: string;
  unrealizedPnl: string;
  fees: string;
  exposure: string;
}

export class PositionRuleError extends Error {
  constructor(public readonly tradeId: string, message: string) {
    super(message);
    this.name = 'PositionRuleError';
  }
}

const d = (value: Decimal.Value) => new Decimal(value);
const out = (value: Decimal) => value.toDecimalPlaces(12).toString();

export function computeFifo(inputTrades: Trade[], quotePrice?: string | null): FifoComputation {
  const trades = [...inputTrades].sort((a, b) => a.executedAt.localeCompare(b.executedAt) || a.sequence - b.sequence);
  const lots: Lot[] = [];
  const results: TradeResult[] = [];
  let realized = d(0);
  let totalFees = d(0);

  for (const trade of trades) {
    const quantity = d(trade.quantity);
    const price = d(trade.unitPrice);
    const fee = d(trade.fee);
    totalFees = totalFees.plus(fee);
    const direction = lots[0]?.direction;
    let action: InferredAction;
    let tradeRealized = d(0);

    const opensLong = trade.side === 'BUY' && direction !== 'SHORT';
    const opensShort = trade.side === 'SELL' && direction !== 'LONG';
    if (opensLong || opensShort) {
      const lotDirection = opensLong ? 'LONG' : 'SHORT';
      action = lots.length === 0 ? (opensLong ? 'OPEN_LONG' : 'OPEN_SHORT') : (opensLong ? 'ADD_LONG' : 'ADD_SHORT');
      lots.push({ tradeId: trade.id, direction: lotDirection, quantity, price, feeRemaining: fee });
    } else {
      const openQuantity = lots.reduce((sum, lot) => sum.plus(lot.quantity), d(0));
      if (quantity.gt(openQuantity)) {
        throw new PositionRuleError(trade.id, `交易数量 ${quantity} 超过可平仓数量 ${openQuantity}，一笔交易不能穿过零仓位`);
      }
      action = direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
      let remaining = quantity;
      while (remaining.gt(0)) {
        const lot = lots[0];
        const matched = Decimal.min(remaining, lot.quantity);
        const openFee = lot.feeRemaining.mul(matched).div(lot.quantity);
        const closeFee = fee.mul(matched).div(quantity);
        const pricePnl = lot.direction === 'LONG'
          ? price.minus(lot.price).mul(matched)
          : lot.price.minus(price).mul(matched);
        tradeRealized = tradeRealized.plus(pricePnl).minus(openFee).minus(closeFee);
        lot.quantity = lot.quantity.minus(matched);
        lot.feeRemaining = lot.feeRemaining.minus(openFee);
        remaining = remaining.minus(matched);
        if (lot.quantity.isZero()) lots.shift();
      }
      realized = realized.plus(tradeRealized);
    }
    results.push({ ...trade, action, realizedPnl: out(tradeRealized) });
  }

  const quote = quotePrice ? d(quotePrice) : null;
  let unrealized = d(0);
  let exposure = d(0);
  let weightedOpen = d(0);
  let openQuantity = d(0);
  for (const lot of lots) {
    openQuantity = openQuantity.plus(lot.quantity);
    weightedOpen = weightedOpen.plus(lot.price.mul(lot.quantity));
    if (quote) {
      const pricePnl = lot.direction === 'LONG'
        ? quote.minus(lot.price).mul(lot.quantity)
        : lot.price.minus(quote).mul(lot.quantity);
      unrealized = unrealized.plus(pricePnl).minus(lot.feeRemaining);
      exposure = exposure.plus(quote.mul(lot.quantity));
    }
  }
  const direction = lots[0]?.direction ?? 'FLAT';
  return {
    trades: results,
    direction,
    longQuantity: direction === 'LONG' ? out(openQuantity) : '0',
    shortQuantity: direction === 'SHORT' ? out(openQuantity) : '0',
    averageOpenPrice: openQuantity.gt(0) ? out(weightedOpen.div(openQuantity)) : '0',
    realizedPnl: out(realized),
    unrealizedPnl: quote ? out(unrealized) : '0',
    fees: out(totalFees),
    exposure: quote ? out(exposure) : '0',
  };
}

export function previewTrade(existing: Trade[], trade: Trade): { action: InferredAction; resultingQuantity: string } {
  const result = computeFifo([...existing, trade]);
  const added = result.trades.find((item) => item.id === trade.id);
  const quantity = result.direction === 'SHORT' ? `-${result.shortQuantity}` : result.longQuantity;
  if (!added) throw new Error('无法预览交易');
  return { action: added.action, resultingQuantity: quantity };
}
