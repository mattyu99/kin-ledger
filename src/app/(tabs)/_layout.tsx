import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { theme } from '@/src/constants/theme';
import { CloudRouteGate } from '@/src/components/CloudRouteGate';

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
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: '明細',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'list.bullet', android: 'list', web: 'list' }} tintColor={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="settlement"
          options={{
            title: '結算',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' }} tintColor={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: '家庭',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} tintColor={color} size={22} />
            ),
          }}
        />
      </Tabs>
    </CloudRouteGate>
  );
}
