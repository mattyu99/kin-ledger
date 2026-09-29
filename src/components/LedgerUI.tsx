import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCurrency, formatShortDate, type HouseholdMember, type LedgerCategory, type LedgerTransaction } from '@/src/domain/ledger';
import { theme } from '@/src/constants/theme';

export function Page({ children, contentStyle }: React.PropsWithChildren<{ contentStyle?: ViewStyle }>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.pageContent, contentStyle]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: React.PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function MemberAvatar({ member, size = 40 }: { member: HouseholdMember; size?: number }) {
  return (
    <View style={[styles.avatar, { backgroundColor: member.color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.29 }]}>{member.initials}</Text>
    </View>
  );
}

export function TransactionRow({
  transaction,
  members,
  categories,
  onDelete,
}: {
  transaction: LedgerTransaction;
  members: HouseholdMember[];
  categories: LedgerCategory[];
  onDelete?: (id: string) => void;
}) {
  const category = categories.find(item => item.id === transaction.categoryId);
  const payer = members.find(member => member.id === transaction.payerId);
  const isExpense = transaction.kind === 'expense';

  return (
    <View style={styles.transactionRow}>
      <View style={[styles.categoryMark, { backgroundColor: category?.color ?? theme.blue }]}>
        <Text style={styles.categoryMarkText}>{category?.icon ?? '•'}</Text>
      </View>
      <View style={styles.transactionDetails}>
        <View style={styles.transactionTopLine}>
          <Text style={styles.transactionTitle} numberOfLines={1}>{transaction.title}</Text>
          <Text style={[styles.transactionAmount, { color: isExpense ? theme.ink : '#3c7965' }]}>
            {isExpense ? '−' : '+'}{formatCurrency(transaction.amountMinor)}
          </Text>
        </View>
        <View style={styles.transactionBottomLine}>
          <Text style={styles.transactionMeta} numberOfLines={1}>
            {category?.name ?? 'Other'} · {payer?.name ?? 'Unknown'} · {formatShortDate(transaction.occurredAt)}
          </Text>
          {onDelete ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${transaction.title}`} onPress={() => onDelete(transaction.id)} hitSlop={8}>
              <Text style={styles.deleteText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.canvas },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  pageContent: { width: '100%', maxWidth: 900, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34 },
  eyebrow: { color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '800' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.line },
  categoryMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  categoryMarkText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  transactionDetails: { flex: 1, minWidth: 0 },
  transactionTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  transactionTitle: { color: theme.ink, fontSize: 15, fontWeight: '700', flex: 1 },
  transactionAmount: { fontFamily: 'SpaceMono', fontSize: 13, fontWeight: '700' },
  transactionBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, gap: 8 },
  transactionMeta: { color: theme.muted, fontSize: 12, flex: 1 },
  deleteText: { color: theme.coral, fontSize: 11, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: theme.ink, fontSize: 17, fontWeight: '800' },
});