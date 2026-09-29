import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import { useLedger } from '@/src/context/LedgerProvider';

type JoinMode = 'create' | 'join';

function getSetupErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST202') {
    return 'Supabase 尚未安裝家庭流程。請先執行 supabase/migrations/202609290002_authenticated_workflows.sql，再重試。';
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '無法完成家庭設定，請稍後再試。';
}

export default function HouseholdSetupScreen() {
  const { isConfigured, isReady, session } = useAuth();
  const { cloudStatus, createHousehold, joinHousehold } = useLedger();
  const [mode, setMode] = useState<JoinMode>('create');
  const [name, setName] = useState('我們的家庭帳本');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isConfigured) return <Redirect href="/(tabs)" />;
  if (!isReady) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (cloudStatus === 'loading') return <Loading />;
  if (cloudStatus === 'cloud') return <Redirect href="/(tabs)" />;
  if (cloudStatus === 'error') return <Redirect href="/" />;

  const submit = async () => {
    setError('');
    setIsSaving(true);
    try {
      if (mode === 'create') await createHousehold(name.trim());
      else await joinHousehold(inviteCode.trim());
      router.replace('/');
    } catch (setupError) {
      setError(getSetupErrorMessage(setupError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>家</Text></View>
          <Text style={styles.brandName}>家帳</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>開始共用</Text>
          <Text style={styles.title}>你的家庭，第一本帳</Text>
          <Text style={styles.subtitle}>建立新的家庭帳本，或輸入家人提供的邀請碼加入。</Text>

          <View style={styles.segment}>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'create' }} onPress={() => setMode('create')} style={[styles.segmentOption, mode === 'create' && styles.segmentActive]}>
              <Text style={[styles.segmentText, mode === 'create' && styles.segmentTextActive]}>建立帳本</Text>
            </Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'join' }} onPress={() => setMode('join')} style={[styles.segmentOption, mode === 'join' && styles.segmentActive]}>
              <Text style={[styles.segmentText, mode === 'join' && styles.segmentTextActive]}>輸入邀請碼</Text>
            </Pressable>
          </View>

          {mode === 'create' ? (
            <>
              <Text style={styles.label}>家庭帳本名稱</Text>
              <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="例如：陳家共享帳本" placeholderTextColor="#82908a" style={styles.input} />
            </>
          ) : (
            <>
              <Text style={styles.label}>家庭邀請碼</Text>
              <TextInput value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" autoCorrect={false} maxLength={64} placeholder="貼上家人分享的邀請碼" placeholderTextColor="#82908a" style={styles.input} />
            </>
          )}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void submit()} style={[styles.submitButton, isSaving && styles.submitDisabled]}>
            <Text style={styles.submitText}>{isSaving ? '處理中…' : mode === 'create' ? '建立家庭帳本' : '加入家庭帳本'}</Text>
            <Text style={styles.submitArrow}>→</Text>
          </Pressable>
          <Text style={styles.accountEmail}>{session.user.email}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Loading() {
  return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><Text style={styles.subtitle}>正在載入家庭資訊…</Text></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.canvas },
  shell: { width: '100%', maxWidth: 920, alignSelf: 'center', flex: 1, paddingHorizontal: 26, paddingVertical: 24, justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: theme.forest, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: theme.lime, fontSize: 18, fontWeight: '900' },
  brandName: { color: theme.ink, fontSize: 16, fontWeight: '800' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingVertical: 38 },
  eyebrow: { color: theme.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: theme.ink, fontSize: 32, fontWeight: '800', marginTop: 9 },
  subtitle: { color: theme.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 13, backgroundColor: '#e7ebe6', marginTop: 25, marginBottom: 23 },
  segmentOption: { flex: 1, minHeight: 41, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: theme.forest },
  segmentText: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#ffffff' },
  label: { color: theme.ink, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { height: 51, paddingHorizontal: 14, borderRadius: 13, backgroundColor: theme.paper, color: theme.ink, borderWidth: 1, borderColor: theme.line, fontSize: 14 },
  error: { color: theme.coral, fontSize: 12, lineHeight: 18, marginTop: 9 },
  submitButton: { height: 53, borderRadius: 14, backgroundColor: theme.coral, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 15 },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  submitArrow: { color: '#ffffff', fontSize: 18 },
  accountEmail: { color: theme.muted, fontSize: 11, marginTop: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
});