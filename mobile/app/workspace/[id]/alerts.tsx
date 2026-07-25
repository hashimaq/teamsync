import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
} from "@/components/ui";
import { space, useTheme } from "@/constants/theme";
import { useNotificationsFeed } from "@/hooks/useNotifications";
import { formatRelative } from "@/utils/cn";

/** In-workspace Alerts panel — same feed as web workspace notifications. */
export default function WorkspaceAlertsScreen() {
  const { c } = useTheme();
  const { data = [], isLoading, refetch, isRefetching, markRead, markAll, unreadCount } =
    useNotificationsFeed();

  if (isLoading) return <LoadingState label="Loading alerts…" />;

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: space.sm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", color: c.foreground }}>
          Alerts
        </Text>
        {unreadCount > 0 ? (
          <Button
            label="Mark all read"
            variant="ghost"
            onPress={() => markAll.mutate()}
            style={{ minHeight: 36, paddingVertical: 6 }}
          />
        ) : null}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: space.lg,
          gap: 10,
          paddingBottom: 28,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            tintColor={c.primary}
            onRefresh={() => void refetch()}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="You're all caught up"
            description="Invites, tasks, and team updates appear here in realtime."
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => markRead.mutate(item.id)}>
            <Card
              style={{
                opacity: item.is_read ? 0.72 : 1,
                borderColor: item.is_read ? c.border : c.primary,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>
                {item.title}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  color: c.mutedForeground,
                  lineHeight: 20,
                }}
              >
                {item.message}
              </Text>
              <Text style={{ marginTop: 8, fontSize: 11, color: c.mutedForeground }}>
                {formatRelative(item.created_at)}
                {!item.is_read ? " · unread" : ""}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
