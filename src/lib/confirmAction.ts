import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, message: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: '取消', style: 'cancel' },
    { text: '確定', style: 'destructive', onPress: onConfirm },
  ]);
}