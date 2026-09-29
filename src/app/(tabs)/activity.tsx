import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Eyebrow, Page, SectionTitle, TransactionRow } from '@/src/components/LedgerUI';
import { theme } from '@/src/constants/theme';
import { useLedger } from '@/src/context/LedgerProvider';
import { useAuth } from '@/src/context/AuthProvider';
import type { TransactionKind } from '@/src/domain/ledger';
import { confirmAction } from '@/src/lib/confirmAction';
import { exportCsvFile } from '@/src/lib/exportCsv';
import { showMessage } from '@/src/lib/showMessage';

type ActivityFilter = 'all' | TransactionKind;

export default function ActivityScreen() {
  const { session } = useAuth();
  const { transactions, members, categories, deleteTransaction, exportCsv, cloudStatus, currentUserRole } = useLedger();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [query, setQuery] = useState('');
  const filteredTransactions = useMemo(() => [...transactions]
    .filter(transaction => filter === 'all' || transaction.kind === filter)
    .filter(transaction => transaction.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt)), [filter, query, transactions]);

  const confirmDelete = (id: string, title: string) => {
    confirmAction('刪除這筆紀錄？', `「${title}」將從家庭帳本移除。`, () => {
      void deleteTransaction(id).catch(error => {
        showMessage('刪除失敗', error instanceof Error ? error.message : '請檢查連線與帳本權限後重試。');
      });
    });
  };

  const downloadCsv = async () => {
    try {
      await exportCsvFile(exportCsv());
    } catch (error) {
      console.warn('CSV export failed:', error);
      showMessage('匯出失敗', '無法在此裝置建立 CSV 檔案。');
    }
  };

  return (
    <Page>
      <Eyebrow>家庭共同帳本</Eyebrow>
      <Text style={styles.title}>收支明細</Text>
      <Text style={styles.subtitle}>所有收入與支出都在這裡。</Text>

      <TextInput
        accessibilityLabel="Search transactions"
        value={query}
        onChangeText={setQuery}
        placeholder="搜尋備註"
        placeholderTextColor={theme.muted}
        style={styles.searchInput}
      />

      <View style={styles.filterRow}>
        {([
          ['all', '全部'],
          ['expense', '支出'],
          ['income', '收入'],
        ] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterButton, filter === key && styles.filterButtonActive]}>
            <Text style={[styles.filterLabel, filter === key && styles.filterLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle
        title="所有紀錄"
        action={(
          <Pressable accessibilityRole="button" onPress={downloadCsv} style={styles.exportButton}>
            <Text style={styles.exportIcon}>↓</Text>
            <Text style={styles.exportLabel}>匯出 CSV</Text>
          </Pressable>
        )}
      />
      <Text style={styles.count}>顯示 {filteredTransactions.length} 筆</Text>
      <View>
        {filteredTransactions.map(transaction => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            members={members}
            categories={categories}
            onDelete={cloudStatus === 'local'
              || currentUserRole === 'owner'
              || currentUserRole === 'admin'
              || transaction.creatorId === session?.user.id
              ? id => confirmDelete(id, transaction.title)
              : undefined}
          />
        ))}
        {filteredTransactions.length === 0 ? <Text style={styles.empty}>沒有符合條件的紀錄。</Text> : null}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.ink, fontSize: 34, fontWeight: '800', marginTop: 6 },
  subtitle: { color: theme.muted, fontSize: 14, marginTop: 4, marginBottom: 22 },
  searchInput: { height: 48, borderRadius: 14, paddingHorizontal: 15, backgroundColor: theme.paper, color: theme.ink, fontSize: 14, marginBottom: 13 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 23 },
  filterButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.canvas },
  filterButtonActive: { backgroundColor: theme.forest, borderColor: theme.forest },
  filterLabel: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  filterLabelActive: { color: '#ffffff' },
  count: { color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  exportButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: theme.paleGreen },
  exportIcon: { color: theme.forest, fontSize: 16, fontWeight: '800' },
  exportLabel: { color: theme.forest, fontSize: 10, fontWeight: '800' },
  empty: { paddingVertical: 26, color: theme.muted, fontSize: 13 },
});