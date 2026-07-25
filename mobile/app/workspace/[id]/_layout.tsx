import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LoadingState } from "@/components/ui";
import { useTheme } from "@/constants/theme";
import { useNotificationsFeed } from "@/hooks/useNotifications";
import { setActiveWorkspaceId } from "@/lib/active-workspace";
import { queryKeys } from "@/lib/query-client";
import { getWorkspace } from "@/services/workspaces";

export default function WorkspaceLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspaceId = id ?? "";
  const { unreadCount } = useNotificationsFeed();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspace(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (workspaceId) void setActiveWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!workspaceId) return <Redirect href="/(tabs)/home" />;
  if (workspaceQuery.isLoading) return <LoadingState label="Opening workspace…" />;

  const bottom = Math.max(insets.bottom, 8);
  const tabBarHeight = 52 + bottom;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: c.background,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.replace("/(tabs)/home")}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.muted,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 16, fontWeight: "700", color: c.foreground }}
          >
            {workspaceQuery.data?.name ?? "Workspace"}
          </Text>
          <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 1 }}>
            Same live workspace as web
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/workspace/${workspaceId}/activity`)}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Ionicons name="pulse" size={20} color={c.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push(`/workspace/${workspaceId}/settings`)}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Ionicons name="settings-outline" size={20} color={c.mutedForeground} />
        </Pressable>
      </View>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.mutedForeground,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
          tabBarStyle: keyboardOpen
            ? { display: "none" }
            : {
                height: tabBarHeight,
                paddingTop: 6,
                paddingBottom: bottom,
                borderTopColor: c.border,
                backgroundColor: c.tabBar,
              },
        }}
      >
        <Tabs.Screen
          name="chat"
          options={{
            title: "Chat",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size - 2} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="checkbox" size={size - 2} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="board"
          options={{
            title: "Board",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="brush" size={size - 2} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: "Members",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size - 2} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: "Alerts",
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: c.destructive,
              fontSize: 9,
              fontWeight: "700",
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size - 2} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="activity" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
