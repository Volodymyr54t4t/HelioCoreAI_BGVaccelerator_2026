import { useEffect, useState } from "react"
import { View, Text, StyleSheet } from "react-native"
import { StatusBar } from "expo-status-bar"
import { NavigationContainer, DefaultTheme } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import Svg, { Path, Rect, Circle } from "react-native-svg"

import { theme } from "./src/theme"
import { loadConfig } from "./src/api"
import DashboardScreen from "./src/screens/DashboardScreen"
import GeneratorScreen from "./src/screens/GeneratorScreen"
import SettingsScreen from "./src/screens/SettingsScreen"

const Tab = createBottomTabNavigator()

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
}

// Прості векторні іконки табів (react-native-svg)
function TabIcon({ name, color }) {
  const size = 22
  if (name === "dashboard") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.8" />
        <Rect x="13" y="3" width="8" height="5" rx="1.5" stroke={color} strokeWidth="1.8" />
        <Rect x="13" y="10" width="8" height="11" rx="1.5" stroke={color} strokeWidth="1.8" />
        <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.8" />
      </Svg>
    )
  }
  if (name === "generator") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      </Svg>
    )
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.8" />
      <Path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  )
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.logo}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoIconText}>HC</Text>
        </View>
        <Text style={styles.logoText}>HelioCore AI</Text>
      </View>
      <View style={styles.headerRight}>
        <View style={styles.liveDot} />
        <Text style={styles.liveLabel}>LIVE</Text>
      </View>
    </View>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadConfig().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootText}>HelioCore AI</Text>
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Header />
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: theme.colors.accent,
              tabBarInactiveTintColor: theme.colors.muted,
              tabBarLabelStyle: styles.tabLabel,
              tabBarIcon: ({ color }) => {
                const map = { Дашборд: "dashboard", Генератор: "generator", Налаштування: "settings" }
                return <TabIcon name={map[route.name]} color={color} />
              },
            })}
          >
            <Tab.Screen name="Дашборд" component={DashboardScreen} />
            <Tab.Screen name="Генератор" component={GeneratorScreen} />
            <Tab.Screen name="Налаштування" component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  boot: { flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" },
  bootText: { color: theme.colors.accent, fontFamily: theme.font.mono, fontSize: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoIcon: {
    width: 32,
    height: 32,
    borderColor: theme.colors.accent,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIconText: { color: theme.colors.accent, fontFamily: theme.font.mono, fontSize: 12 },
  logoText: { color: theme.colors.accent, fontFamily: theme.font.mono, fontSize: 17 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent2 },
  liveLabel: { color: theme.colors.accent2, fontFamily: theme.font.mono, fontSize: 12 },
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontFamily: theme.font.mono },
})
