import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import {
  Card,
  EmptyState,
  Header,
  LoadingState,
  Screen,
} from "@/components/ui";
import { ACTIVE_WORKSPACE_KEY, space, useTheme } from "@/constants/theme";
import { setActiveWorkspaceId } from "@/lib/active-workspace";
import { useWorkspaces } from "@/hooks/useWorkspaces";

/** Mirrors web: jump into last workspace chat, or pick one. */
export default function ChatTabScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void AsyncStorage.getItem(ACTIVE_WORKSPACE_KEY).then(setActiveId);
  }, []);

  if (isLoading || activeId === undefined) return <LoadingState />;

  if (activeId && workspaces.some((w) => w.id === activeId)) {
    return <Redirect href={`/workspace/${activeId}/chat`} />;
  }

  if (workspaces.length === 1) {
    return <Redirect href={`/workspace/${workspaces[0].id}/chat`} />;
  }

  return (
    <Screen>
      <Header
        title="Chat"
        subtitle="Choose a workspace — same channels as the web app"
      />
      <FlatList
        data={workspaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: space.lg,
          gap: 12,
          paddingBottom: 28,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <EmptyState
            title="No chats yet"
            description="Create or join a workspace from Home first."
          />
        }
        renderItem={({ item }) => (
          <Card
            onPress={async () => {
              await setActiveWorkspaceId(item.id);
              router.push(`/workspace/${item.id}/chat`);
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: c.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.foreground }}>
                  {item.name}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 13, color: c.mutedForeground }}>
                  Open live chat
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
