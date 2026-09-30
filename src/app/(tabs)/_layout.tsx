import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Platform, Text, type ColorValue } from 'react-native';

import { CloudRouteGate } from '@/src/components/CloudRouteGate';
import { theme } from '@/src/constants/theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function TabIcon({ color, name, glyph }: { color: ColorValue; name: SymbolName; glyph: string }) {
  if (Platform.OS === 'web') {
    return <Text accessibilityElementsHidden style={{ color, fontSize: 22, lineHeight: 22 }}>{glyph}</Text>;
  }
  return <SymbolView name={name} tintColor={color} size={22} />;
}

export default function TabLayout() {
  return (
    <CloudRouteGate>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.forest,
          tabBarInactiveTintColor: theme.muted,
          tabBarStyle: { backgroundColor: theme.paper, borderTopColor: theme.line, height: 66, paddingTop: 7, paddingBottom: 8 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '總覽',
            tabBarIcon: ({ color }) => <TabIcon color={color} name={{ ios: 'house.fill', android: 'home', web: 'home' }} glyph="⌂" />,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: '明細',
            tabBarIcon: ({ color }) => <TabIcon color={color} name={{ ios: 'list.bullet', android: 'list', web: 'list' }} glyph="☷" />,
          }}
        />
        <Tabs.Screen
          name="settlement"
          options={{
            title: '結算',
            tabBarIcon: ({ color }) => <TabIcon color={color} name={{ ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' }} glyph="⇄" />,
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: '家庭',
            tabBarIcon: ({ color }) => <TabIcon color={color} name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} glyph="♧" />,
          }}
        />
      </Tabs>
    </CloudRouteGate>
  );
}
