import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { LoadingState } from "@/components/ui";
import { useTheme } from "@/constants/theme";
import { AppProviders } from "@/providers/AppProviders";
import { useAuth } from "@/providers/AuthProvider";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function NavigationTree() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { c, isDark } = useTheme();

  useEffect(() => {
    if (status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (status === "authenticated" && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [status, segments, router]);

  useEffect(() => {
    if (status !== "loading") {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="workspace/[id]"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      {status === "loading" ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: 50, backgroundColor: c.background },
          ]}
        >
          <LoadingState label="Starting TeamSync…" />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <NavigationTree />
    </AppProviders>
  );
}
