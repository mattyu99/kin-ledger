import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';

export default function AuthCallbackScreen() {
  const { code, error_description: errorDescription } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [message, setMessage] = useState('正在確認登入連結…');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const finishSignIn = async () => {
      if (!supabase) {
        setMessage('Supabase 尚未設定，請返回登入頁。');
        return;
      }
      if (errorDescription) {
        setMessage('登入連結無效或已過期，請重新寄送。');
        return;
      }
      if (!code) {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          router.replace('/');
          return;
        }
        setMessage('找不到登入驗證碼，請重新寄送登入連結。');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage('登入連結無效或已過期，請重新寄送。');
        return;
      }
      router.replace('/');
    };

    void finishSignIn().catch(error => {
      console.warn('Could not complete Supabase sign-in:', error);
      setMessage('登入時發生錯誤，請重新寄送登入連結。');
    });
  }, [code, errorDescription]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ActivityIndicator color={theme.forest} size="large" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.canvas },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 17 },
  message: { color: theme.ink, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});