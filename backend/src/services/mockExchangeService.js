export const SYMBOLS = [
  'RELIANCE',
  'TCS',
  'INFY',
  'HDFCBANK',
  'ICICIBANK',
  'SBIN',
  'ITC',
  'WIPRO',
  'LT',
  'TATAMOTORS',
  'BHARTIARTL',
  'AXISBANK',
];

const CLIENT_POOL = [
  'CLT',
  'HHI',
  'SBI',
  'MIR',
  'VIK',
  'NAT',
  'ABR',
  'TIA',
  'JAI',
  'RAN',
  'KAL',
  'NXT',
  'PRA',
  'ZEN',
  'VAY',
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let tradeSequence = 0;

function getNextTradeSequenceOffset() {
  const baseOffset = Date.now() % 1000000000;
  const offset = tradeSequence * 10000;
  tradeSequence += 1;
  return baseOffset + offset;
}

export function generateSeedTrades(recordCount = 3000, startOffset = 0) {
  const rand = mulberry32(20240611 + startOffset);
  const anchorDate = Date.UTC(2024, 0, 2, 9, 15, 0);
  const trades = [];

  for (let index = 0; index < recordCount; index += 1) {
    const symbol = SYMBOLS[(index + startOffset) % SYMBOLS.length];
    const clientBase = CLIENT_POOL[(index * 3 + startOffset) % CLIENT_POOL.length];
    const clientSuffix = 1000 + ((index + startOffset * 7) % 9000);
    const price = Number((42 + rand() * 168 + (index % 11) * 2.75).toFixed(2));
    const quantity = Math.floor(180 + rand() * 5400 + (index % 13) * 72);
    const timestamp = new Date(anchorDate + index * 42000 + ((index % 7) * 130000)).toISOString();
    const tradeId = `BSE-${String(10000000 + index + startOffset).padStart(10, '0')}`;

    trades.push({
      tradeId,
      client: `${clientBase}${clientSuffix}`,
      symbol,
      quantity,
      price,
      timestamp,
    });
  }

  return trades;
}

export async function fetchTrades({ count = 3000, delayMs = 0 } = {}) {
  const normalizedCount = Number.isFinite(Number(count)) ? Math.max(1, Number(count)) : 3000;
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const offset = getNextTradeSequenceOffset();

  return {
    source: 'mock-bse-exchange',
    requestedCount: normalizedCount,
    total: normalizedCount,
    trades: generateSeedTrades(normalizedCount, offset),
  };
}
