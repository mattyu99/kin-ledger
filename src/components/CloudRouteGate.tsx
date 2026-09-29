import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import { useLedger } from '@/src/context/LedgerProvider';

export function CloudRouteGate({ children }: React.PropsWithChildren) {
  const { isConfigured, isReady, session } = useAuth();
  const { cloudStatus } = useLedger();

  if (!isConfigured) return children;
  if (!isReady || cloudStatus === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.forest} />
          <Text style={styles.loadingText}>正在確認家庭帳本…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  if (cloudStatus === 'needs-household') return <Redirect href="/household" />;
  if (cloudStatus !== 'cloud') return <Redirect href="/" />;
  return children;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: theme.muted, fontSize: 12 },
});