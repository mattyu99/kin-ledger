import { Platform } from 'react-native';

export async function exportCsvFile(contents: string): Promise<void> {
  const filename = `family-ledger-${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    const file = new Blob([contents], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export family ledger',
    UTI: 'public.comma-separated-values-text',
  });
}