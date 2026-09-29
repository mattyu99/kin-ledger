import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRef } from 'react';

import { Eyebrow, MemberAvatar, Page, SectionTitle } from '@/src/components/LedgerUI';
import { theme } from '@/src/constants/theme';
import { useLedger } from '@/src/context/LedgerProvider';
import { formatCurrency, formatShortDate, suggestSettlements } from '@/src/domain/ledger';
import { confirmAction } from '@/src/lib/confirmAction';
import { showMessage } from '@/src/lib/showMessage';
import * as Crypto from 'expo-crypto';

export default function SettlementScreen() {
  const { members, balances, settlements, recordSettlement, cloudStatus, currentUserRole } = useLedger();
  const pendingSettlementIds = useRef(new Map<string, string>());
  const canRecordSettlement = cloudStatus === 'local' || currentUserRole !== 'viewer';
  const suggestions = suggestSettlements(balances);
  const totalOwed = balances.filter(item => item.balanceMinor < 0).reduce((sum, item) => sum + Math.abs(item.balanceMinor), 0);

  const confirmSettlement = (suggestion: (typeof suggestions)[number]) => {
    const payer = members.find(member => member.id === suggestion.fromMemberId);
    const receiver = members.find(member => member.id === suggestion.toMemberId);
    if (!payer || !receiver) return;
    const settlementKey = `${suggestion.fromMemberId}:${suggestion.toMemberId}:${suggestion.amountMinor}`;
    const clientId = pendingSettlementIds.current.get(settlementKey) ?? Crypto.randomUUID();
    pendingSettlementIds.current.set(settlementKey, clientId);

    confirmAction('記錄這筆結清？', `${payer.name} 支付 ${receiver.name} ${formatCurrency(suggestion.amountMinor)}。`, () => {
      void recordSettlement({
        fromMemberId: suggestion.fromMemberId,
        toMemberId: suggestion.toMemberId,
        amountMinor: suggestion.amountMinor,
      }, clientId).then(() => {
        pendingSettlementIds.current.delete(settlementKey);
      }).catch(error => {
        showMessage('結清紀錄失敗', error instanceof Error ? error.message : '請檢查連線與帳本權限後重試。');
      });
    });
  };

  return (
    <Page>
      <Eyebrow>家庭共同帳本</Eyebrow>
      <Text style={styles.title}>家庭結算</Text>
      <Text style={styles.subtitle}>清楚掌握每位成員代墊與應付的金額。</Text>

      <View style={styles.totalBand}>
        <Text style={styles.totalLabel}>成員間尚未結清</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalOwed)}</Text>
        <Text style={styles.totalFootnote}>收入紀錄不納入成員間的代墊結算。</Text>
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle title="成員餘額" />
        {members.map(member => {
          const balance = balances.find(item => item.memberId === member.id)?.balanceMinor ?? 0;
          const status = balance > 0 ? '應收' : balance < 0 ? '應付' : '已結清';
          return (
            <View key={member.id} style={styles.balanceRow}>
              <MemberAvatar member={member} size={42} />
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberStatus}>{status}</Text>
              </View>
              <Text style={[styles.balanceAmount, { color: balance < 0 ? theme.coral : balance > 0 ? '#3c7965' : theme.muted }]}>
                {balance === 0 ? formatCurrency(0) : `${balance > 0 ? '+' : '−'}${formatCurrency(Math.abs(balance))}`}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle title="建議結清方式" action={<Text style={styles.count}>{suggestions.length} 筆</Text>} />
        {suggestions.length === 0 ? (
          <View style={styles.clearState}>
            <Text style={styles.clearTitle}>目前帳目已結清</Text>
            <Text style={styles.clearHint}>新增共同支出後，結清建議會顯示在這裡。</Text>
          </View>
        ) : suggestions.map(suggestion => {
          const payer = members.find(member => member.id === suggestion.fromMemberId);
          const receiver = members.find(member => member.id === suggestion.toMemberId);
          if (!payer || !receiver) return null;
          return (
            <View key={`${suggestion.fromMemberId}-${suggestion.toMemberId}`} style={styles.transferRow}>
              <View style={styles.transferPeople}>
                <MemberAvatar member={payer} size={34} />
                <Text style={styles.transferArrow}>→</Text>
                <MemberAvatar member={receiver} size={34} />
                <View style={styles.transferCopy}>
                  <Text style={styles.transferTitle}>{payer.name} 支付給 {receiver.name}</Text>
                  <Text style={styles.transferAmount}>{formatCurrency(suggestion.amountMinor)}</Text>
                </View>
              </View>
              {canRecordSettlement ? (
                <Pressable accessibilityRole="button" style={styles.recordButton} onPress={() => confirmSettlement(suggestion)}>
                  <Text style={styles.recordButtonText}>記錄結清</Text>
                </Pressable>
              ) : <Text style={styles.readOnlyTag}>唯讀</Text>}
            </View>
          );
        })}
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle title="結清紀錄" action={<Text style={styles.count}>已記錄 {settlements.length} 筆</Text>} />
        {settlements.length === 0 ? (
          <Text style={styles.historyEmpty}>還沒有結清紀錄。</Text>
        ) : settlements.map(settlement => {
          const payer = members.find(member => member.id === settlement.fromMemberId);
          const receiver = members.find(member => member.id === settlement.toMemberId);
          return (
            <View key={settlement.id} style={styles.historyRow}>
              <Text style={styles.historyText}>{payer?.name ?? '成員'} 支付給 {receiver?.name ?? '成員'}</Text>
              <Text style={styles.historyAmount}>{formatCurrency(settlement.amountMinor)}</Text>
              <Text style={styles.historyDate}>{formatShortDate(settlement.occurredAt)}</Text>
            </View>
          );
        })}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.ink, fontSize: 34, fontWeight: '800', marginTop: 6 },
  subtitle: { color: theme.muted, fontSize: 14, marginTop: 4, marginBottom: 22, maxWidth: 440 },
  totalBand: { backgroundColor: theme.forest, padding: 20, borderRadius: 19 },
  totalLabel: { color: '#cfddd4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  totalAmount: { color: '#ffffff', fontFamily: 'SpaceMono', fontSize: 29, fontWeight: '700', marginTop: 10 },
  totalFootnote: { color: '#cfddd4', fontSize: 11, marginTop: 10 },
  sectionGap: { marginTop: 27 },
  balanceRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.line, gap: 11 },
  memberCopy: { flex: 1 },
  memberName: { color: theme.ink, fontSize: 14, fontWeight: '700' },
  memberStatus: { color: theme.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 3 },
  balanceAmount: { fontFamily: 'SpaceMono', fontSize: 12, fontWeight: '700' },
  count: { color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  clearState: { paddingVertical: 19, borderTopWidth: 1, borderColor: theme.line },
  clearTitle: { color: theme.ink, fontSize: 15, fontWeight: '800' },
  clearHint: { color: theme.muted, fontSize: 12, marginTop: 4 },
  transferRow: { paddingVertical: 14, borderTopWidth: 1, borderColor: theme.line, gap: 12 },
  transferPeople: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transferArrow: { color: theme.muted, fontSize: 17 },
  transferCopy: { marginLeft: 2, flex: 1, minWidth: 0 },
  transferTitle: { color: theme.ink, fontSize: 12, fontWeight: '700' },
  transferAmount: { color: theme.forest, fontSize: 12, fontFamily: 'SpaceMono', fontWeight: '700', marginTop: 3 },
  recordButton: { alignSelf: 'flex-end', paddingHorizontal: 15, paddingVertical: 9, backgroundColor: theme.lime, borderRadius: 10 },
  recordButtonText: { color: theme.ink, fontSize: 11, fontWeight: '800' },
  readOnlyTag: { color: theme.muted, fontSize: 10, alignSelf: 'flex-end', fontWeight: '700' },
  historyEmpty: { color: theme.muted, fontSize: 12, paddingVertical: 15, borderTopWidth: 1, borderColor: theme.line },
  historyRow: { paddingVertical: 13, borderTopWidth: 1, borderColor: theme.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyText: { flex: 1, color: theme.ink, fontSize: 12 },
  historyAmount: { color: theme.ink, fontFamily: 'SpaceMono', fontSize: 11, fontWeight: '700' },
  historyDate: { color: theme.muted, fontSize: 10 },
});