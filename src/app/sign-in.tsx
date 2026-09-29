import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';

export default function SignInScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const sendLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('請輸入有效的電子郵件地址。');
      return;
    }

    setError('');
    setIsSending(true);
    try {
      await signInWithEmail(normalizedEmail);
      setSentTo(normalizedEmail);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '寄送登入連結失敗，請稍後再試。');
    } finally {
      setIsSending(false);
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
          <Text style={styles.eyebrow}>家庭共同記帳</Text>
          <Text style={styles.title}>{sentTo ? '查看你的信箱' : '一起把家用記清楚'}</Text>
          <Text style={styles.subtitle}>
            {sentTo
              ? `登入連結已寄至 ${sentTo}。請在此裝置開啟信件中的連結。`
              : '輸入電子郵件，我們會寄送安全登入連結。'}
          </Text>

          {!sentTo ? (
            <>
              <Text style={styles.fieldLabel}>電子郵件</Text>
              <TextInput
                accessibilityLabel="電子郵件"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => void sendLink()}
                placeholder="name@example.com"
                placeholderTextColor="#82908a"
                style={styles.input}
              />
              {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
              <Pressable accessibilityRole="button" disabled={isSending} onPress={() => void sendLink()} style={[styles.submitButton, isSending && styles.submitDisabled]}>
                <Text style={styles.submitText}>{isSending ? '寄送中…' : '寄送登入連結'}</Text>
                <Text style={styles.submitArrow}>→</Text>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => { setSentTo(''); setError(''); }} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>改用其他電子郵件</Text>
            </Pressable>
          )}

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>⌁</Text>
            <Text style={styles.privacyText}>只有帳本成員能查看家庭收支。</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>收支與家庭成員由你掌握</Text>
          <View style={styles.footerRule} />
          <Text style={styles.footerText}>TWD · 家庭帳本</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.canvas },
  shell: { width: '100%', maxWidth: 920, alignSelf: 'center', flex: 1, paddingHorizontal: 26, paddingVertical: 24, justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: theme.forest, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: theme.lime, fontSize: 18, fontWeight: '900' },
  brandName: { color: theme.ink, fontSize: 16, fontWeight: '800' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingVertical: 42 },
  eyebrow: { color: theme.coral, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: theme.ink, fontSize: 34, lineHeight: 42, fontWeight: '800', marginTop: 11 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 30 },
  fieldLabel: { color: theme.ink, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { height: 51, paddingHorizontal: 14, borderRadius: 13, backgroundColor: theme.paper, color: theme.ink, borderWidth: 1, borderColor: theme.line, fontSize: 14 },
  errorText: { color: theme.coral, fontSize: 12, lineHeight: 18, marginTop: 8 },
  submitButton: { height: 53, borderRadius: 14, backgroundColor: theme.coral, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 15 },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  submitArrow: { color: '#ffffff', fontSize: 18 },
  secondaryButton: { alignSelf: 'flex-start', paddingVertical: 12 },
  secondaryText: { color: theme.forest, fontSize: 12, fontWeight: '800' },
  privacyNote: { marginTop: 24, paddingTop: 15, borderTopWidth: 1, borderColor: theme.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  privacyIcon: { color: theme.forest, fontSize: 18, fontWeight: '800' },
  privacyText: { color: theme.muted, fontSize: 11 },
  footer: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footerText: { color: theme.muted, fontSize: 10, fontWeight: '700' },
  footerRule: { height: 1, backgroundColor: theme.line, flex: 1 },
});