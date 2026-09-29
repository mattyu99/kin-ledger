import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  INITIAL_LEDGER,
  calculateBalances,
  isLedgerState,
  summarizeMonth,
  toCsv,
  type LedgerState,
  type HouseholdRole,
  type NewLedgerTransaction,
  type Settlement,
} from '@/src/domain/ledger';
import { useAuth } from '@/src/context/AuthProvider';
import {
  acceptCloudInvite,
  createCloudHousehold,
  createCloudInvite,
  deleteCloudTransaction,
  insertCloudSettlement,
  insertCloudTransaction,
  loadCloudLedger,
  subscribeToHouseholdChanges,
} from '@/src/lib/cloudLedger';

const STORAGE_KEY = '@family-ledger/state/v2';
const EMPTY_LEDGER: LedgerState = {
  householdName: '',
  members: [],
  categories: [],
  transactions: [],
  settlements: [],
};

export type CloudStatus = 'local' | 'loading' | 'signed-out' | 'needs-household' | 'cloud' | 'error';

interface LedgerContextValue extends LedgerState {
  isHydrated: boolean;
  cloudStatus: CloudStatus;
  cloudError: string;
  realtimeStatus: string;
  householdId: string | null;
  currentUserRole: HouseholdRole | null;
  balances: ReturnType<typeof calculateBalances>;
  monthSummary: ReturnType<typeof summarizeMonth>;
  addTransaction: (transaction: NewLedgerTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  recordSettlement: (settlement: Omit<Settlement, 'id' | 'occurredAt'>, clientId: string) => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (code: string) => Promise<void>;
  createInvite: () => Promise<string>;
  refreshCloud: () => Promise<void>;
  exportCsv: () => string;
  resetDemoData: () => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function LedgerProvider({ children }: React.PropsWithChildren) {
  const { session, isReady: isAuthReady, isConfigured } = useAuth();
  const [state, setState] = useState<LedgerState>(INITIAL_LEDGER);
  const [isHydrated, setIsHydrated] = useState(false);
  const [remoteLoad, setRemoteLoad] = useState<{
    userId: string | null;
    status: Exclude<CloudStatus, 'local' | 'signed-out' | 'loading'> | 'loading';
    error: string;
  }>({ userId: null, status: 'loading', error: '' });
  const [realtimeStatus, setRealtimeStatus] = useState('CLOSED');
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdRole, setHouseholdRole] = useState<HouseholdRole | null>(null);
  const userId = session?.user.id ?? null;
  const cloudStatus: CloudStatus = !isConfigured
    ? 'local'
    : !isAuthReady
      ? 'loading'
      : !userId
        ? 'signed-out'
        : remoteLoad.userId !== userId
          ? 'loading'
          : remoteLoad.status;
  const cloudError = userId && remoteLoad.userId === userId ? remoteLoad.error : '';
  const visibleState = isConfigured && cloudStatus !== 'cloud' ? EMPTY_LEDGER : state;
  const visibleHouseholdId = cloudStatus === 'cloud' ? householdId : null;
  const visibleHouseholdRole = cloudStatus === 'cloud' ? householdRole : null;
  const visibleIsHydrated = isConfigured
    ? isAuthReady && (!userId || (remoteLoad.userId === userId && remoteLoad.status !== 'loading'))
    : isHydrated;

  const loadRemoteLedger = useCallback(async (targetUserId: string) => {
    const snapshot = await loadCloudLedger(targetUserId);
    if (!snapshot) {
      setState(EMPTY_LEDGER);
      setHouseholdId(null);
      setHouseholdRole(null);
      setRemoteLoad({ userId: targetUserId, status: 'needs-household', error: '' });
      return;
    }
    setState(snapshot.state);
    setHouseholdId(snapshot.household.id);
    setHouseholdRole(snapshot.currentRole);
    setRemoteLoad({ userId: targetUserId, status: 'cloud', error: '' });
  }, []);

  useEffect(() => {
    if (!isAuthReady || !isConfigured || !userId) return;
    let active = true;

    void loadCloudLedger(userId)
      .then(snapshot => {
        if (!active) return;
        if (!snapshot) {
          setState(EMPTY_LEDGER);
          setHouseholdId(null);
          setHouseholdRole(null);
          setRemoteLoad({ userId, status: 'needs-household', error: '' });
          return;
        }
        setState(snapshot.state);
        setHouseholdId(snapshot.household.id);
        setHouseholdRole(snapshot.currentRole);
        setRemoteLoad({ userId, status: 'cloud', error: '' });
      })
      .catch(error => {
        if (!active) return;
        setState(EMPTY_LEDGER);
        setHouseholdId(null);
        setHouseholdRole(null);
        setRemoteLoad({
          userId,
          status: 'error',
          error: error instanceof Error ? error.message : '無法載入雲端帳本。',
        });
      });

    return () => { active = false; };
  }, [isAuthReady, isConfigured, userId]);

  useEffect(() => {
    if (isConfigured) return;
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then(async saved => {
        if (!active) return;
        if (saved) {
          try {
            const parsed: unknown = JSON.parse(saved);
            if (isLedgerState(parsed)) {
              setState(parsed);
            } else {
              await AsyncStorage.removeItem(STORAGE_KEY);
            }
          } catch {
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      })
      .catch(error => console.warn('Could not load the local ledger:', error))
      .finally(() => {
        if (active) setIsHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!isHydrated || isConfigured) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(error => {
      console.warn('Could not save the local ledger:', error);
    });
  }, [isConfigured, isHydrated, state]);

  useEffect(() => {
    if (cloudStatus !== 'cloud' || !householdId || !userId) return;
    return subscribeToHouseholdChanges(householdId, () => {
      void loadRemoteLedger(userId).catch(error => {
        setRemoteLoad({
          userId,
          status: 'error',
          error: error instanceof Error ? error.message : '同步家庭資料時發生錯誤。',
        });
      });
    }, setRealtimeStatus);
  }, [cloudStatus, householdId, loadRemoteLedger, userId]);

  const refreshCloud = useCallback(async () => {
    if (!userId) return;
    setRemoteLoad({ userId, status: 'loading', error: '' });
    try {
      await loadRemoteLedger(userId);
    } catch (error) {
      setRemoteLoad({
        userId,
        status: 'error',
        error: error instanceof Error ? error.message : '無法載入雲端帳本。',
      });
      throw error;
    }
  }, [loadRemoteLedger, userId]);

  const createHousehold = useCallback(async (name: string) => {
    await createCloudHousehold(name.trim());
    await refreshCloud();
  }, [refreshCloud]);

  const joinHousehold = useCallback(async (code: string) => {
    await acceptCloudInvite(code);
    await refreshCloud();
  }, [refreshCloud]);

  const value = useMemo<LedgerContextValue>(() => ({
    ...visibleState,
    isHydrated: visibleIsHydrated,
    balances: calculateBalances(visibleState),
    monthSummary: summarizeMonth(visibleState.transactions),
    cloudStatus,
    cloudError,
    realtimeStatus,
    householdId: visibleHouseholdId,
    currentUserRole: visibleHouseholdRole,
    addTransaction: async transaction => {
      if (isConfigured) {
        if (!visibleHouseholdId || !userId) throw new Error('請先登入並加入家庭帳本。');
        await insertCloudTransaction(visibleHouseholdId, transaction);
        await loadRemoteLedger(userId);
        return;
      }
      const { clientId, ...ledgerTransaction } = transaction;
      setState(current => ({
        ...current,
        transactions: [{ ...ledgerTransaction, id: clientId || createId('tx') }, ...current.transactions],
      }));
    },
    deleteTransaction: async id => {
      if (isConfigured) {
        if (!visibleHouseholdId || !userId) throw new Error('請先登入並加入家庭帳本。');
        await deleteCloudTransaction(id);
        await loadRemoteLedger(userId);
        return;
      }
      setState(current => ({
        ...current,
        transactions: current.transactions.filter(transaction => transaction.id !== id),
      }));
    },
    recordSettlement: async (settlement, clientId) => {
      if (isConfigured) {
        if (!visibleHouseholdId || !userId) throw new Error('請先登入並加入家庭帳本。');
        await insertCloudSettlement(visibleHouseholdId, settlement, userId, clientId);
        await loadRemoteLedger(userId);
        return;
      }
      setState(current => ({
        ...current,
        settlements: [{ ...settlement, id: createId('settlement'), occurredAt: new Date().toISOString() }, ...current.settlements],
      }));
    },
    createHousehold,
    joinHousehold,
    createInvite: async () => {
      if (!visibleHouseholdId) throw new Error('尚未載入家庭帳本。');
      return createCloudInvite(visibleHouseholdId);
    },
    refreshCloud,
    exportCsv: () => toCsv(visibleState),
    resetDemoData: () => setState(INITIAL_LEDGER),
  }), [cloudError, cloudStatus, createHousehold, joinHousehold, loadRemoteLedger, realtimeStatus, refreshCloud, visibleHouseholdId, visibleHouseholdRole, visibleIsHydrated, visibleState, isConfigured, userId]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const context = useContext(LedgerContext);
  if (!context) throw new Error('useLedger must be rendered inside LedgerProvider.');
  return context;
}