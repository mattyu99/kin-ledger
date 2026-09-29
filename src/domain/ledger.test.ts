import { describe, expect, it } from 'vitest';

import {
  INITIAL_LEDGER,
  allocateEqualShares,
  calculateBalances,
  formatCurrency,
  isLedgerState,
  suggestSettlements,
  toCsv,
  type LedgerState,
} from './ledger';

describe('ledger accounting', () => {
  it('allocates every cent when an amount does not divide evenly', () => {
    const shares = allocateEqualShares(100, ['mei', 'jun', 'an']);

    expect(shares.map(share => share.amountMinor)).toEqual([34, 33, 33]);
    expect(shares.reduce((sum, share) => sum + share.amountMinor, 0)).toBe(100);
  });

  it('rejects invalid amounts and empty split groups', () => {
    expect(() => allocateEqualShares(-1, ['mei'])).toThrow();
    expect(() => allocateEqualShares(100, [])).toThrow();
  });

  it('nets payer, shares, and recorded settlements in integer cents', () => {
    const state: LedgerState = {
      householdName: 'Test home',
      members: [
        { id: 'mei', name: 'Mei', initials: 'M', color: '#000000' },
        { id: 'jun', name: 'Jun', initials: 'J', color: '#000000' },
      ],
      categories: [],
      transactions: [{
        id: 'tx', kind: 'expense', amountMinor: 101, title: 'Tea', categoryId: 'food',
        payerId: 'mei', occurredAt: new Date().toISOString(),
        shares: [{ memberId: 'mei', amountMinor: 51 }, { memberId: 'jun', amountMinor: 50 }],
      }],
      settlements: [{
        id: 'settlement', fromMemberId: 'jun', toMemberId: 'mei', amountMinor: 50,
        occurredAt: new Date().toISOString(),
      }],
    };

    expect(calculateBalances(state)).toEqual([
      { memberId: 'mei', balanceMinor: 0 },
      { memberId: 'jun', balanceMinor: 0 },
    ]);
  });

  it('suggests transfers that settle a balanced ledger', () => {
    const suggestions = suggestSettlements([
      { memberId: 'mei', balanceMinor: 75 },
      { memberId: 'jun', balanceMinor: -45 },
      { memberId: 'an', balanceMinor: -30 },
    ]);

    expect(suggestions.map(item => [item.fromMemberId, item.toMemberId, item.amountMinor])).toEqual([
      ['jun', 'mei', 45],
      ['an', 'mei', 30],
    ]);
  });

  it('quotes CSV values and escapes embedded quotes', () => {
    const csv = toCsv({
      members: [{ id: 'mei', name: 'Mei', initials: 'M', color: '#000000' }],
      categories: [{ id: 'food', name: 'Food', icon: '◈', color: '#000000', kind: 'expense' }],
      transactions: [{
        id: 'tx', kind: 'expense', amountMinor: 1234, title: 'Tea "large"', categoryId: 'food',
        payerId: 'mei', occurredAt: '2026-09-01T00:00:00.000Z',
        shares: [{ memberId: 'mei', amountMinor: 1234 }],
      }],
    });

    expect(csv).toContain('"Tea ""large"""');
    expect(csv.startsWith('\uFEFF日期,類型')).toBe(true);
  });

  it('stores and displays TWD as whole integer dollars', () => {
    expect(formatCurrency(100)).toBe('NT$ 100');
    expect(formatCurrency(10050)).toBe('NT$ 10,050');
  });

  it('rejects persisted entries from the previous amount schema', () => {
    const legacy = JSON.parse(JSON.stringify(INITIAL_LEDGER)) as {
      transactions: Record<string, unknown>[];
    };
    legacy.transactions[0].amountCents = legacy.transactions[0].amountMinor;
    delete legacy.transactions[0].amountMinor;

    expect(isLedgerState(legacy)).toBe(false);
    expect(isLedgerState(INITIAL_LEDGER)).toBe(true);
  });
});