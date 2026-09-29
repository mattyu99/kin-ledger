import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import { useLedger } from '@/src/context/LedgerProvider';

export default function EntryScreen() {
  const { isConfigured, isReady, session } = useAuth();
  const { cloudStatus, cloudError, refreshCloud } = useLedger();

  if (!isConfigured) return <Redirect href="/(tabs)" />;
  if (!isReady) return <LoadingScreen label="正在確認登入狀態…" />;
  if (!session) return <Redirect href="/sign-in" />;
  if (cloudStatus === 'needs-household') return <Redirect href="/household" />;
  if (cloudStatus === 'cloud') return <Redirect href="/(tabs)" />;
  if (cloudStatus === 'error') {
    return (
      <MessageScreen
        title="無法載入家庭帳本"
        message={cloudError || '請確認資料庫 migration 已完成，再重試。'}
        action="重試"
        onPress={() => { void refreshCloud().catch(() => undefined); }}
      />
    );
  }

  return <LoadingScreen label="正在載入家庭帳本…" />;
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ActivityIndicator color={theme.forest} size="large" />
        <Text style={styles.body}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

export function MessageScreen({
  title,
  message,
  action,
  onPress,
}: {
  title: string;
  message: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
          <Text style={styles.buttonText}>{action}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.canvas },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  title: { color: theme.ink, fontSize: 23, fontWeight: '800', textAlign: 'center' },
  body: { color: theme.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 480 },
  button: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 24, borderRadius: 13, backgroundColor: theme.forest, marginTop: 5 },
  buttonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});