import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Linking, Text, View } from "react-native";
import { Button, Card, LoadingState, Screen, Subtitle, Title } from "@/components/ui";
import { space, useTheme } from "@/constants/theme";
import { WEB_URL } from "@/lib/supabase";
import { getWhiteboardStatus } from "@/services/workspaces";
import { formatRelative } from "@/utils/cn";

/**
 * Full collaborative whiteboard needs native canvas (not Expo Go–safe).
 * Match web's Board panel with status + deep link into the web whiteboard.
 */
export default function WorkspaceBoardScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspaceId = id ?? "";

  const boardQuery = useQuery({
    queryKey: ["whiteboard", workspaceId],
    queryFn: () => getWhiteboardStatus(workspaceId),
    enabled: Boolean(workspaceId),
  });

  if (boardQuery.isLoading) return <LoadingState label="Loading board…" />;

  const boardUrl = `${WEB_URL}/workspace/${workspaceId}?panel=whiteboard`;

  return (
    <Screen>
      <View style={{ flex: 1, padding: space.lg, justifyContent: "center", gap: space.lg }}>
        <View style={{ alignItems: "center", gap: space.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: c.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="brush" size={32} color={c.primary} />
          </View>
          <Title style={{ textAlign: "center" }}>Whiteboard</Title>
          <Subtitle style={{ textAlign: "center" }}>
            Same realtime board as the web app. Open it in the browser for full
            collaborative drawing.
          </Subtitle>
        </View>

        <Card style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, color: c.mutedForeground }}>Status</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: c.foreground }}>
            {boardQuery.data
              ? `Last updated ${formatRelative(boardQuery.data.updated_at)}`
              : "Not started yet — create strokes on web to begin"}
          </Text>
        </Card>

        <Button
          label="Open whiteboard on web"
          onPress={() => void Linking.openURL(boardUrl)}
        />
      </View>
    </Screen>
  );
}
