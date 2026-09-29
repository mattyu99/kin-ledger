import {
  calculateBalances,
  type HouseholdMember,
  type HouseholdRole,
  type LedgerCategory,
  type NewLedgerTransaction,
  type LedgerState,
  type LedgerTransaction,
  type Settlement,
} from '@/src/domain/ledger';
import { supabase } from '@/src/lib/supabase';

export interface CloudHousehold {
  id: string;
  name: string;
  currency: string;
}

export interface CloudLedgerSnapshot {
  household: CloudHousehold;
  currentRole: HouseholdRole;
  state: LedgerState;
}

const EMPTY_LEDGER: LedgerState = {
  householdName: '',
  members: [],
  categories: [],
  transactions: [],
  settlements: [],
};

const MEMBER_COLORS = ['#cf5c3b', '#3d7568', '#d09835', '#6375a4', '#aa6480'];

function getClient() {
  if (!supabase) throw new Error('Supabase 尚未設定。');
  return supabase;
}

function getInitials(name: string): string {
  return Array.from(name.trim()).slice(0, 2).join('') || '家人';
}

function colorForMember(id: string): string {
  const hash = Array.from(id).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}

export async function loadCloudLedger(userId: string): Promise<CloudLedgerSnapshot | null> {
  const client = getClient();
  const { data: membership, error: membershipError } = await client
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const householdId = membership.household_id as string;
  const [householdResult, membershipResult, categoryResult, transactionResult, settlementResult] = await Promise.all([
    client.from('households').select('id, name, currency').eq('id', householdId).single(),
    client.from('household_members').select('user_id, role').eq('household_id', householdId),
    client.from('categories').select('id, name, kind, color, icon').eq('household_id', householdId).order('name'),
    client.from('transactions')
      .select('id, creator_id, kind, amount_minor, note, category_id, payer_id, occurred_at, transaction_splits(user_id, amount_minor)')
      .eq('household_id', householdId)
      .order('occurred_at', { ascending: false }),
    client.from('settlements')
      .select('id, from_user_id, to_user_id, amount_minor, occurred_at')
      .eq('household_id', householdId)
      .order('occurred_at', { ascending: false }),
  ]);

  const firstError = householdResult.error
    ?? membershipResult.error
    ?? categoryResult.error
    ?? transactionResult.error
    ?? settlementResult.error;
  if (firstError) throw firstError;

  const memberIds = (membershipResult.data ?? []).map((row: { user_id: string }) => row.user_id);
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('id, display_name')
    .in('id', memberIds);
  if (profilesError) throw profilesError;

  const profileById = new Map((profiles ?? []).map((profile: { id: string; display_name: string }) => [profile.id, profile]));
  const members: HouseholdMember[] = (membershipResult.data ?? []).map((row: { user_id: string; role: HouseholdRole }) => {
    const profile = profileById.get(row.user_id);
    const name = profile?.display_name ?? '家庭成員';
    return { id: row.user_id, name, initials: getInitials(name), color: colorForMember(row.user_id), role: row.role };
  });

  const categories: LedgerCategory[] = (categoryResult.data ?? []).map((category: {
    id: string;
    name: string;
    kind: 'expense' | 'income';
    color: string;
    icon: string;
  }) => ({
    id: category.id,
    name: category.name,
    kind: category.kind,
    color: category.color,
    icon: category.icon,
  }));

  const transactions: LedgerTransaction[] = (transactionResult.data ?? []).map((row: {
    id: string;
    creator_id: string;
    kind: 'expense' | 'income';
    amount_minor: number;
    note: string;
    category_id: string | null;
    payer_id: string;
    occurred_at: string;
    transaction_splits: { user_id: string; amount_minor: number }[];
  }) => ({
    id: row.id,
    creatorId: row.creator_id,
    kind: row.kind,
    amountMinor: Number(row.amount_minor),
    title: row.note,
    categoryId: row.category_id ?? '',
    payerId: row.payer_id,
    occurredAt: row.occurred_at,
    shares: (row.transaction_splits ?? []).map(split => ({
      memberId: split.user_id,
      amountMinor: Number(split.amount_minor),
    })),
  }));

  const settlements: Settlement[] = (settlementResult.data ?? []).map((row: {
    id: string;
    from_user_id: string;
    to_user_id: string;
    amount_minor: number;
    occurred_at: string;
  }) => ({
    id: row.id,
    fromMemberId: row.from_user_id,
    toMemberId: row.to_user_id,
    amountMinor: Number(row.amount_minor),
    occurredAt: row.occurred_at,
  }));

  const household = householdResult.data as CloudHousehold;
  return {
    household,
    currentRole: membership.role as HouseholdRole,
    state: {
      ...EMPTY_LEDGER,
      householdName: household.name,
      members,
      categories,
      transactions,
      settlements,
    },
  };
}

export async function createCloudHousehold(name: string): Promise<void> {
  const { error } = await getClient().rpc('create_household_for_current_user', { p_name: name });
  if (error) throw error;
}

export async function acceptCloudInvite(code: string): Promise<void> {
  const { error } = await getClient().rpc('accept_household_invite', { p_code: code.trim() });
  if (error) throw error;
}

export async function createCloudInvite(householdId: string): Promise<string> {
  const { data, error } = await getClient().rpc('create_household_invite', {
    p_household_id: householdId,
    p_max_uses: 5,
    p_expires_in_days: 7,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('無法建立家庭邀請碼。');
  return data;
}

export async function insertCloudTransaction(
  householdId: string,
  transaction: NewLedgerTransaction,
): Promise<void> {
  const { data, error: sessionError } = await getClient().auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session) throw new Error('登入狀態已失效，請重新登入。');

  const { error } = await getClient().rpc('add_household_transaction', {
    p_household_id: householdId,
    p_client_id: transaction.clientId,
    p_kind: transaction.kind,
    p_amount_minor: transaction.amountMinor,
    p_note: transaction.title,
    p_category_id: transaction.categoryId || null,
    p_payer_id: transaction.payerId,
    p_occurred_at: transaction.occurredAt,
    p_splits: transaction.shares.map(share => ({ user_id: share.memberId, amount_minor: share.amountMinor })),
  });
  if (error) throw error;
}

export async function deleteCloudTransaction(transactionId: string): Promise<void> {
  const { error } = await getClient().from('transactions').delete().eq('id', transactionId);
  if (error) throw error;
}

export async function insertCloudSettlement(
  householdId: string,
  settlement: Omit<Settlement, 'id' | 'occurredAt'>,
  createdBy: string,
  clientId: string,
): Promise<void> {
  const { error } = await getClient().rpc('record_household_settlement', {
    p_household_id: householdId,
    p_client_id: clientId,
    p_from_user_id: settlement.fromMemberId,
    p_to_user_id: settlement.toMemberId,
    p_amount_minor: settlement.amountMinor,
  });
  if (error) throw error;
}

export function calculateCloudBalances(state: LedgerState) {
  return calculateBalances(state);
}

export function subscribeToHouseholdChanges(householdId: string, onChange: () => void, onStatus: (status: string) => void) {
  const client = getClient();
  const channel = client
    .channel(`household:${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, onChange)
    .subscribe(status => onStatus(status));

  return () => { void client.removeChannel(channel); };
}