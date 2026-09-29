export type TransactionKind = 'expense' | 'income';
export type HouseholdRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface HouseholdMember {
  id: string;
  name: string;
  initials: string;
  color: string;
  role?: HouseholdRole;
}

export interface LedgerCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: TransactionKind;
}

export interface TransactionShare {
  memberId: string;
  amountMinor: number;
}

export interface LedgerTransaction {
  id: string;
  creatorId?: string;
  kind: TransactionKind;
  amountMinor: number;
  title: string;
  categoryId: string;
  payerId: string;
  occurredAt: string;
  shares: TransactionShare[];
}

export type NewLedgerTransaction = Omit<LedgerTransaction, 'id'> & { clientId: string };

export interface Settlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  occurredAt: string;
}

export interface LedgerState {
  householdName: string;
  members: HouseholdMember[];
  categories: LedgerCategory[];
  transactions: LedgerTransaction[];
  settlements: Settlement[];
}

export interface MemberBalance {
  memberId: string;
  balanceMinor: number;
}

export interface LedgerSummary {
  expensesMinor: number;
  incomeMinor: number;
  netMinor: number;
}

const dayOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export const INITIAL_LEDGER: LedgerState = {
  householdName: '林家共享帳本',
  members: [
    { id: 'mei', name: '美玲', initials: '美', color: '#cf5c3b' },
    { id: 'jun', name: '俊豪', initials: '俊', color: '#3d7568' },
    { id: 'an', name: '安安', initials: '安', color: '#d09835' },
  ],
  categories: [
    { id: 'groceries', name: '日常採買', icon: '◈', color: '#d09835', kind: 'expense' },
    { id: 'dining', name: '外食聚餐', icon: '◉', color: '#cf5c3b', kind: 'expense' },
    { id: 'home', name: '居家生活', icon: '⌂', color: '#3d7568', kind: 'expense' },
    { id: 'transport', name: '交通出行', icon: '↗', color: '#6375a4', kind: 'expense' },
    { id: 'care', name: '醫療照護', icon: '✳', color: '#aa6480', kind: 'expense' },
    { id: 'income', name: '家庭收入', icon: '↙', color: '#3d7568', kind: 'income' },
  ],
  transactions: [
    {
      id: 'demo-market', kind: 'expense', amountMinor: 48600,
      title: '週末市場採買', categoryId: 'groceries', payerId: 'mei',
      occurredAt: dayOffset(0), shares: [
        { memberId: 'mei', amountMinor: 16200 },
        { memberId: 'jun', amountMinor: 16200 },
        { memberId: 'an', amountMinor: 16200 },
      ],
    },
    {
      id: 'demo-dinner', kind: 'expense', amountMinor: 3300,
      title: '麵店晚餐', categoryId: 'dining', payerId: 'jun',
      occurredAt: dayOffset(1), shares: [
        { memberId: 'mei', amountMinor: 1100 },
        { memberId: 'jun', amountMinor: 1100 },
        { memberId: 'an', amountMinor: 1100 },
      ],
    },
    {
      id: 'demo-home', kind: 'expense', amountMinor: 7800,
      title: '本月電費', categoryId: 'home', payerId: 'mei',
      occurredAt: dayOffset(4), shares: [
        { memberId: 'mei', amountMinor: 2600 },
        { memberId: 'jun', amountMinor: 2600 },
        { memberId: 'an', amountMinor: 2600 },
      ],
    },
    {
      id: 'demo-income', kind: 'income', amountMinor: 420000,
      title: '家庭收入', categoryId: 'income', payerId: 'jun',
      occurredAt: dayOffset(5), shares: [],
    },
  ],
  settlements: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isLedgerState(value: unknown): value is LedgerState {
  if (!isRecord(value) || typeof value.householdName !== 'string') return false;
  if (!Array.isArray(value.members) || !Array.isArray(value.categories)) return false;
  if (!Array.isArray(value.transactions) || !Array.isArray(value.settlements)) return false;

  const validMembers = value.members.every(member =>
    isRecord(member) && typeof member.id === 'string' && typeof member.name === 'string'
  );
  const validCategories = value.categories.every(category =>
    isRecord(category) && typeof category.id === 'string' && typeof category.name === 'string'
  );
  const validTransactions = value.transactions.every(transaction =>
    isRecord(transaction)
    && typeof transaction.id === 'string'
    && (transaction.creatorId === undefined || typeof transaction.creatorId === 'string')
    && Number.isSafeInteger(transaction.amountMinor)
    && Number(transaction.amountMinor) > 0
    && Array.isArray(transaction.shares)
    && transaction.shares.every(share =>
      isRecord(share) && Number.isSafeInteger(share.amountMinor) && Number(share.amountMinor) >= 0
    )
  );
  const validSettlements = value.settlements.every(settlement =>
    isRecord(settlement)
    && typeof settlement.id === 'string'
    && Number.isSafeInteger(settlement.amountMinor)
    && Number(settlement.amountMinor) > 0
  );

  return validMembers && validCategories && validTransactions && validSettlements;
}

export function allocateEqualShares(amountMinor: number, memberIds: string[]): TransactionShare[] {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error('Amount must be a non-negative integer number of TWD.');
  }
  if (memberIds.length === 0) {
    throw new Error('At least one member is required to split an expense.');
  }

  const baseShare = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor % memberIds.length;

  return memberIds.map((memberId, index) => ({
    memberId,
    amountMinor: baseShare + (index < remainder ? 1 : 0),
  }));
}

export function calculateBalances(state: Pick<LedgerState, 'members' | 'transactions' | 'settlements'>): MemberBalance[] {
  const balances = new Map(state.members.map(member => [member.id, 0]));

  for (const transaction of state.transactions) {
    if (transaction.kind !== 'expense') continue;
    balances.set(transaction.payerId, (balances.get(transaction.payerId) ?? 0) + transaction.amountMinor);
    for (const share of transaction.shares) {
      balances.set(share.memberId, (balances.get(share.memberId) ?? 0) - share.amountMinor);
    }
  }

  for (const settlement of state.settlements) {
    balances.set(settlement.fromMemberId, (balances.get(settlement.fromMemberId) ?? 0) + settlement.amountMinor);
    balances.set(settlement.toMemberId, (balances.get(settlement.toMemberId) ?? 0) - settlement.amountMinor);
  }

  return state.members.map(member => ({ memberId: member.id, balanceMinor: balances.get(member.id) ?? 0 }));
}

export function suggestSettlements(balances: MemberBalance[]): Settlement[] {
  const debtors = balances
    .filter(item => item.balanceMinor < 0)
    .map(item => ({ memberId: item.memberId, remaining: -item.balanceMinor }));
  const creditors = balances
    .filter(item => item.balanceMinor > 0)
    .map(item => ({ memberId: item.memberId, remaining: item.balanceMinor }));
  const suggestions: Settlement[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.remaining, creditor.remaining);

    suggestions.push({
      id: `suggested-${suggestions.length}`,
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountMinor,
      occurredAt: new Date().toISOString(),
    });

    debtor.remaining -= amountMinor;
    creditor.remaining -= amountMinor;
    if (debtor.remaining === 0) debtorIndex += 1;
    if (creditor.remaining === 0) creditorIndex += 1;
  }

  return suggestions;
}

export function summarizeMonth(transactions: LedgerTransaction[], now = new Date()): LedgerSummary {
  const monthTransactions = transactions.filter(transaction => {
    const occurredAt = new Date(transaction.occurredAt);
    return occurredAt.getFullYear() === now.getFullYear() && occurredAt.getMonth() === now.getMonth();
  });

  const expensesMinor = monthTransactions
    .filter(transaction => transaction.kind === 'expense')
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const incomeMinor = monthTransactions
    .filter(transaction => transaction.kind === 'income')
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);

  return { expensesMinor, incomeMinor, netMinor: incomeMinor - expensesMinor };
}

export function toCsv(state: Pick<LedgerState, 'members' | 'categories' | 'transactions'>): string {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = state.transactions.map(transaction => {
    const category = state.categories.find(item => item.id === transaction.categoryId)?.name ?? '未分類';
    const payer = state.members.find(member => member.id === transaction.payerId)?.name ?? '未知成員';
    const shares = transaction.shares
      .map(share => `${state.members.find(member => member.id === share.memberId)?.name ?? '未知成員'}:${share.amountMinor}`)
      .join('; ');
    return [
      new Date(transaction.occurredAt).toISOString(),
      transaction.kind === 'expense' ? '支出' : '收入',
      category,
      String(transaction.amountMinor),
      payer,
      shares,
      transaction.title,
    ].map(value => quote(String(value))).join(',');
  });

  return `\uFEFF${['日期,類型,分類,金額(TWD),付款人,分攤,備註', ...rows].join('\r\n')}`;
}

export function formatCurrency(amountMinor: number): string {
  const formatted = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(amountMinor);
  return `NT$ ${formatted}`;
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('zh-TW', { month: 'short', day: 'numeric' }).format(new Date(value));
}