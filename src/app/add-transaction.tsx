import { router } from 'expo-router';
import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemberAvatar } from '@/src/components/LedgerUI';
import { theme } from '@/src/constants/theme';
import { useLedger } from '@/src/context/LedgerProvider';
import { allocateEqualShares, type TransactionKind } from '@/src/domain/ledger';
import { showMessage } from '@/src/lib/showMessage';
import { CloudRouteGate } from '@/src/components/CloudRouteGate';

export default function AddTransactionScreen() {
  const { members, categories, addTransaction } = useLedger();
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('groceries');
  const [payerId, setPayerId] = useState(members[0]?.id ?? '');
  const [shareMemberIds, setShareMemberIds] = useState(members.map(member => member.id));
  const [clientId] = useState(() => Crypto.randomUUID());
  const [isSaving, setIsSaving] = useState(false);
  const availableCategories = categories.filter(category => category.kind === kind);

  const chooseKind = (nextKind: TransactionKind) => {
    setKind(nextKind);
    const firstCategory = categories.find(category => category.kind === nextKind);
    if (firstCategory) setCategoryId(firstCategory.id);
  };

  const toggleShareMember = (memberId: string) => {
    setShareMemberIds(current => current.includes(memberId)
      ? current.filter(id => id !== memberId)
      : [...current, memberId]);
  };

  const saveTransaction = async () => {
    const amountValue = Number(amount.replace(/,/g, '').trim());
    const amountMinor = amountValue;
    const category = availableCategories.find(item => item.id === categoryId);

    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      showMessage('請確認金額', '新台幣以整數元記帳，請輸入大於零的整數。');
      return;
    }
    if (!payerId || !category) {
      showMessage('資料尚未填妥', '儲存前請選擇付款人與分類。');
      return;
    }
    if (kind === 'expense' && shareMemberIds.length === 0) {
      showMessage('請選擇分攤成員', '至少選擇一位家庭成員。');
      return;
    }

    setIsSaving(true);
    try {
      await addTransaction({
        clientId,
        kind,
        amountMinor,
        title: title.trim() || category.name,
        categoryId: category.id,
        payerId,
        occurredAt: new Date().toISOString(),
        shares: kind === 'expense' ? allocateEqualShares(amountMinor, shareMemberIds) : [],
      });
      router.back();
    } catch (saveError) {
      showMessage('儲存失敗', saveError instanceof Error ? saveError.message : '請檢查連線與帳本權限後重試。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CloudRouteGate>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>家庭共同帳本</Text>
              <Text style={styles.heading}>新增收支</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.closeButton} onPress={() => router.back()}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.kindSwitch}>
            {(['expense', 'income'] as const).map(option => (
              <Pressable key={option} onPress={() => chooseKind(option)} style={[styles.kindOption, kind === option && styles.kindOptionActive]}>
                <Text style={[styles.kindLabel, kind === option && styles.kindLabelActive]}>{option === 'expense' ? '支出' : '收入'}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>金額</Text>
          <View style={styles.amountField}>
            <Text style={styles.currency}>NT$</Text>
            <TextInput
              accessibilityLabel="新台幣金額"
              value={amount}
              onChangeText={value => setAmount(value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              placeholderTextColor="#aeb9b4"
              keyboardType="number-pad"
              autoFocus
              style={styles.amountInput}
            />
          </View>

          <Text style={styles.label}>用途備註</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="例如：晚餐、日用品" placeholderTextColor={theme.muted} style={styles.textField} maxLength={100} />

          <Text style={styles.label}>分類</Text>
          <View style={styles.chipGroup}>
            {availableCategories.map(category => {
              const selected = category.id === categoryId;
              return (
                <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.chip, selected && { backgroundColor: category.color, borderColor: category.color }]}>
                  <Text style={[styles.chipIcon, selected && styles.chipTextActive]}>{category.icon}</Text>
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{category.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>付款人</Text>
          <View style={styles.memberGroup}>
            {members.map(member => {
              const selected = member.id === payerId;
              return (
                <Pressable key={member.id} onPress={() => setPayerId(member.id)} style={[styles.memberOption, selected && styles.memberOptionActive]}>
                  <MemberAvatar member={member} size={33} />
                  <Text style={[styles.memberOptionText, selected && styles.memberOptionTextActive]} numberOfLines={1}>{member.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {kind === 'expense' ? (
            <>
              <View style={styles.splitHeading}>
                <Text style={styles.label}>共同分攤</Text>
                <Text style={styles.splitCount}>{shareMemberIds.length} / {members.length} 位</Text>
              </View>
              <Text style={styles.helper}>選擇分攤成員，系統會平均分配；無法整除的餘額會依成員順序分配到分。</Text>
              <View style={styles.memberGroup}>
                {members.map(member => {
                  const selected = shareMemberIds.includes(member.id);
                  return (
                    <Pressable key={member.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleShareMember(member.id)} style={[styles.memberOption, selected && styles.memberOptionActive]}>
                      <MemberAvatar member={member} size={33} />
                      <Text style={[styles.memberOptionText, selected && styles.memberOptionTextActive]} numberOfLines={1}>{member.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Pressable style={styles.saveButton} disabled={isSaving} onPress={() => void saveTransaction()}>
            <Text style={styles.saveButtonText}>{isSaving ? '儲存中…' : '儲存紀錄'}</Text>
            <Text style={styles.saveArrow}>→</Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </CloudRouteGate>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.canvas },
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', boxSizing: 'border-box', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 19 },
  eyebrow: { color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { color: theme.ink, fontSize: 27, fontWeight: '800', marginTop: 4 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: theme.ink, fontSize: 28, lineHeight: 31 },
  kindSwitch: { flexDirection: 'row', backgroundColor: '#e7ebe6', padding: 4, borderRadius: 14, marginBottom: 22 },
  kindOption: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 11 },
  kindOptionActive: { backgroundColor: theme.forest },
  kindLabel: { color: theme.muted, fontSize: 13, fontWeight: '700' },
  kindLabelActive: { color: '#ffffff' },
  label: { color: theme.ink, fontSize: 13, fontWeight: '800', marginBottom: 9 },
  amountField: { height: 73, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: theme.paper, borderRadius: 15, marginBottom: 20 },
  currency: { color: theme.muted, fontSize: 17, fontWeight: '700', marginRight: 11 },
  amountInput: { flex: 1, color: theme.ink, fontFamily: 'SpaceMono', fontSize: 29, fontWeight: '700', paddingVertical: 4 },
  textField: { height: 48, borderRadius: 13, paddingHorizontal: 14, backgroundColor: theme.paper, color: theme.ink, fontSize: 14, marginBottom: 20 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 12, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line },
  chipIcon: { fontSize: 13, color: theme.ink },
  chipText: { color: theme.ink, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#ffffff' },
  memberGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 19 },
  memberOption: { minHeight: 45, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 13, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper },
  memberOptionActive: { borderColor: theme.forest, backgroundColor: theme.paleGreen },
  memberOptionText: { color: theme.muted, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  memberOptionTextActive: { color: theme.forest },
  splitHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  splitCount: { color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginBottom: 9 },
  helper: { color: theme.muted, fontSize: 11, lineHeight: 16, marginTop: -5, marginBottom: 12 },
  saveButton: { minHeight: 54, borderRadius: 15, backgroundColor: theme.coral, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 4 },
  saveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  saveArrow: { color: '#ffffff', fontSize: 19 },
});