import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, MemberAvatar, Page, SectionTitle } from '@/src/components/LedgerUI';
import { theme } from '@/src/constants/theme';
import { useAuth } from '@/src/context/AuthProvider';
import { useLedger } from '@/src/context/LedgerProvider';
import { confirmAction } from '@/src/lib/confirmAction';
import { showMessage } from '@/src/lib/showMessage';

export default function FamilyScreen() {
  const { session, signOut } = useAuth();
  const {
    householdName,
    members,
    householdId,
    currentUserRole,
    cloudStatus,
    realtimeStatus,
    createInvite,
  } = useLedger();
  const [inviteCode, setInviteCode] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const makeInvite = async () => {
    if (currentUserRole !== 'owner' && currentUserRole !== 'admin') {
      showMessage('無法建立邀請碼', '只有家庭擁有者或管理員可以建立邀請碼。');
      return;
    }
    setIsWorking(true);
    try {
      setInviteCode(await createInvite());
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : '請稍後再試。';
      showMessage('無法建立邀請碼', message);
    } finally {
      setIsWorking(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteCode) return;
    const copied = await Clipboard.setStringAsync(inviteCode);
    if (copied) showMessage('已複製', '將邀請碼傳給家庭成員即可加入。');
  };

  const confirmSignOut = () => {
    confirmAction('登出家帳？', '登出後需重新驗證電子郵件才能查看雲端家庭帳本。', () => {
      void signOut().catch(error => showMessage('登出失敗', error instanceof Error ? error.message : '請稍後再試。'));
    });
  };

  return (
    <Page>
      <Eyebrow>帳本設定</Eyebrow>
      <Text style={styles.title}>家庭與帳號</Text>
      <Text style={styles.subtitle}>管理成員與家庭共用權限。</Text>

      <View style={styles.accountRow}>
        <View style={styles.accountMark}><Text style={styles.accountMarkText}>{session?.user.email?.slice(0, 1).toUpperCase() ?? '家'}</Text></View>
        <View style={styles.accountCopy}>
          <Text style={styles.accountEmail}>{session?.user.email ?? '本機示範帳本'}</Text>
          <Text style={styles.accountMeta}>{cloudStatus === 'cloud' ? '已登入 · 雲端資料庫' : '本機資料 · 未登入'}</Text>
        </View>
        {session ? (
          <Pressable accessibilityRole="button" onPress={confirmSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>登出</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionTitle title={householdName || '家庭帳本'} action={<Text style={styles.memberCount}>{members.length} 位成員</Text>} />
        {members.map(member => (
          <View key={member.id} style={styles.memberRow}>
            <MemberAvatar member={member} size={40} />
            <Text style={styles.memberName}>{member.name}</Text>
            {member.id === session?.user.id ? <Text style={styles.selfTag}>你</Text> : null}
          </View>
        ))}
        {members.length === 0 ? <Text style={styles.emptyText}>建立家庭帳本後，成員會顯示在這裡。</Text> : null}
      </View>

      {cloudStatus === 'cloud' && householdId ? (
        <View style={styles.inviteSection}>
          <View style={styles.inviteCopy}>
            <Text style={styles.inviteTitle}>邀請家人加入</Text>
            <Text style={styles.inviteSubtitle}>邀請碼 7 天後到期，最多可使用 5 次。</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={isWorking || (currentUserRole !== 'owner' && currentUserRole !== 'admin')} onPress={() => void makeInvite()} style={styles.inviteButton}>
            <Text style={styles.inviteButtonText}>{isWorking ? '建立中…' : '建立邀請碼'}</Text>
          </Pressable>
          {inviteCode ? (
            <View style={styles.codeRow}>
              <Text selectable style={styles.codeText}>{inviteCode}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="複製邀請碼" onPress={() => void copyInvite()} style={styles.copyButton}>
                <Text style={styles.copyIcon}>⧉</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.syncStatus}>
            <View style={[styles.statusDot, realtimeStatus === 'SUBSCRIBED' && styles.statusDotLive]} />
            <Text style={styles.syncText}>{realtimeStatus === 'SUBSCRIBED' ? '即時更新已連線' : '雲端資料已載入'}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.localNote}>
          <Text style={styles.localNoteTitle}>僅本機示範</Text>
          <Text style={styles.localNoteText}>設定 Supabase 並登入後，可建立家庭邀請碼及同步成員資料。</Text>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.ink, fontSize: 32, fontWeight: '800', marginTop: 6 },
  subtitle: { color: theme.muted, fontSize: 13, marginTop: 5, marginBottom: 22 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: theme.paper, borderRadius: 16 },
  accountMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.forest, alignItems: 'center', justifyContent: 'center' },
  accountMarkText: { color: theme.lime, fontSize: 17, fontWeight: '900' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountEmail: { color: theme.ink, fontSize: 13, fontWeight: '800' },
  accountMeta: { color: theme.muted, fontSize: 10, marginTop: 4 },
  signOutButton: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 10, backgroundColor: theme.paleCoral },
  signOutText: { color: theme.coral, fontSize: 11, fontWeight: '800' },
  section: { marginTop: 27 },
  memberCount: { color: theme.muted, fontSize: 10, fontWeight: '800' },
  memberRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderColor: theme.line },
  memberName: { color: theme.ink, fontSize: 13, fontWeight: '700', flex: 1 },
  selfTag: { color: theme.forest, fontSize: 10, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: theme.paleGreen },
  emptyText: { color: theme.muted, fontSize: 12, paddingVertical: 15, borderTopWidth: 1, borderColor: theme.line },
  inviteSection: { marginTop: 26, padding: 17, backgroundColor: theme.forest, borderRadius: 17 },
  inviteCopy: { marginBottom: 14 },
  inviteTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  inviteSubtitle: { color: '#cfddd4', fontSize: 11, marginTop: 5, lineHeight: 16 },
  inviteButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.lime, borderRadius: 12 },
  inviteButtonText: { color: theme.ink, fontSize: 12, fontWeight: '800' },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 11, borderRadius: 11, backgroundColor: '#ffffff' },
  codeText: { color: theme.ink, fontFamily: 'SpaceMono', fontSize: 13, fontWeight: '700', flex: 1, letterSpacing: 0.4 },
  copyButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: theme.paleGreen },
  copyIcon: { color: theme.forest, fontSize: 19, fontWeight: '800' },
  syncStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.lime },
  statusDotLive: { backgroundColor: '#89d7aa' },
  syncText: { color: '#cfddd4', fontSize: 10, fontWeight: '700' },
  localNote: { marginTop: 26, paddingTop: 16, borderTopWidth: 1, borderColor: theme.line },
  localNoteTitle: { color: theme.ink, fontSize: 12, fontWeight: '800' },
  localNoteText: { color: theme.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
});