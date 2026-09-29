import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, MemberAvatar, Page, SectionTitle, TransactionRow } from '@/src/components/LedgerUI';
import { theme } from '@/src/constants/theme';
import { useLedger } from '@/src/context/LedgerProvider';
import { formatCurrency } from '@/src/domain/ledger';

export default function OverviewScreen() {
  const { householdName, members, transactions, categories, balances, monthSummary, cloudStatus } = useLedger();
  const currentDate = new Date();
  const monthLabel = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
  const recentTransactions = [...transactions]
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))
    .slice(0, 4);
  const unsettledCount = balances.filter(item => item.balanceMinor !== 0).length;

  return (
    <Page>
      <View style={styles.topLine}>
        <View>
          <Eyebrow>家庭共同帳本 · {monthLabel}</Eyebrow>
          <Text style={styles.householdName}>{householdName}</Text>
        </View>
        <View style={styles.localBadge}>
          <View style={styles.localDot} />
          <Text style={styles.localBadgeText}>{cloudStatus === 'cloud' ? '雲端家庭帳本' : '僅儲存於本機'}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroLabel}>本月總支出</Text>
          <View style={styles.heroMark}><Text style={styles.heroMarkText}>KL</Text></View>
        </View>
        <Text style={styles.heroAmount}>{formatCurrency(monthSummary.expensesMinor)}</Text>
        <View style={styles.heroFooter}>
          <Text style={styles.heroCaption}>共 {transactions.length} 筆家庭收支</Text>
          <Text style={styles.heroMonth}>{monthLabel}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Eyebrow>本月收入</Eyebrow>
          <Text style={[styles.metricAmount, { color: '#3c7965' }]}>{formatCurrency(monthSummary.incomeMinor)}</Text>
        </View>
        <View style={styles.metricRule} />
        <View style={styles.metric}>
          <Eyebrow>收支結餘</Eyebrow>
          <Text style={[styles.metricAmount, { color: monthSummary.netMinor < 0 ? theme.coral : theme.ink }]}>
            {formatCurrency(monthSummary.netMinor)}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <SectionTitle title="家庭成員結算" action={<Text style={styles.memberCount}>{members.length} 位成員</Text>} />
        <Text style={styles.sectionHint}>正數代表應收，負數代表應付</Text>
      </View>
      <View style={styles.memberList}>
        {members.map(member => {
          const balance = balances.find(item => item.memberId === member.id)?.balanceMinor ?? 0;
          return (
            <View key={member.id} style={styles.memberRow}>
              <MemberAvatar member={member} size={38} />
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={[styles.memberBalance, { color: balance < 0 ? theme.coral : balance > 0 ? '#3c7965' : theme.muted }]}>
                {balance === 0 ? '已結清' : `${balance > 0 ? '+' : '−'}${formatCurrency(Math.abs(balance))}`}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.settleCallout}>
        <View style={styles.calloutCopy}>
          <Text style={styles.calloutTitle}>{unsettledCount ? '待處理的家庭帳款' : '目前帳目已結清'}</Text>
          <Text style={styles.calloutText}>
            {unsettledCount ? `${unsettledCount} 位成員尚有應收付金額。` : '目前沒有未結清款項。'}
          </Text>
        </View>
        <Pressable style={styles.calloutButton} onPress={() => router.push('/(tabs)/settlement')}>
          <Text style={styles.calloutButtonText}>查看</Text>
          <Text style={styles.calloutArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHead}>
        <SectionTitle title="近期收支" action={<Text style={styles.memberCount}>共 {transactions.length} 筆</Text>} />
      </View>
      <View style={styles.transactionList}>
        {recentTransactions.map(transaction => (
          <TransactionRow key={transaction.id} transaction={transaction} members={members} categories={categories} />
        ))}
        {recentTransactions.length === 0 ? <Text style={styles.emptyText}>還沒有記帳紀錄，新增第一筆收支吧。</Text> : null}
      </View>

      <Pressable style={styles.addButton} onPress={() => router.push('/add-transaction')}>
        <Text style={styles.addIcon}>＋</Text>
        <Text style={styles.addButtonText}>新增一筆收支</Text>
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 },
  householdName: { color: theme.ink, fontSize: 22, fontWeight: '800', marginTop: 4 },
  localBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.paper, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, gap: 6 },
  localDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d09835' },
  localBadgeText: { color: theme.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  hero: { backgroundColor: theme.forest, borderRadius: 22, padding: 22, minHeight: 185, justifyContent: 'space-between' },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: '#cbdad1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: theme.lime, alignItems: 'center', justifyContent: 'center' },
  heroMarkText: { color: theme.forest, fontSize: 12, fontWeight: '900' },
  heroAmount: { color: '#ffffff', fontFamily: 'SpaceMono', fontSize: 34, fontWeight: '700', marginTop: 16 },
  heroFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  heroCaption: { color: '#d3dfd8', fontSize: 12 },
  heroMonth: { color: theme.lime, fontSize: 11, fontWeight: '800' },
  metricsRow: { flexDirection: 'row', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: theme.line, marginBottom: 23 },
  metric: { flex: 1, gap: 6 },
  metricRule: { width: 1, backgroundColor: theme.line, marginHorizontal: 16 },
  metricAmount: { fontFamily: 'SpaceMono', fontSize: 17, fontWeight: '700' },
  sectionHead: { marginBottom: 7 },
  memberCount: { color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  sectionHint: { color: theme.muted, fontSize: 11, marginTop: -3, marginBottom: 8 },
  memberList: { borderTopWidth: 1, borderTopColor: theme.line, borderBottomWidth: 1, borderBottomColor: theme.line, marginBottom: 17 },
  memberRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: theme.line },
  memberName: { color: theme.ink, fontSize: 14, fontWeight: '700', flex: 1 },
  memberBalance: { fontFamily: 'SpaceMono', fontSize: 12, fontWeight: '700' },
  settleCallout: { backgroundColor: theme.lime, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 26 },
  calloutCopy: { flex: 1 },
  calloutTitle: { color: theme.ink, fontSize: 14, fontWeight: '800' },
  calloutText: { color: '#4e5c4c', fontSize: 12, marginTop: 4 },
  calloutButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#ffffff' },
  calloutButtonText: { color: theme.ink, fontSize: 12, fontWeight: '800' },
  calloutArrow: { color: theme.ink, fontSize: 16 },
  transactionList: { marginTop: 1 },
  emptyText: { color: theme.muted, paddingVertical: 16, fontSize: 13 },
  addButton: { minHeight: 54, borderRadius: 16, backgroundColor: theme.coral, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 22 },
  addIcon: { color: '#ffffff', fontSize: 22, fontWeight: '500' },
  addButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
