import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import {
  Button,
  Card,
  EmptyState,
  Header,
  LoadingState,
  Screen,
} from "@/components/ui";
import { space, useTheme } from "@/constants/theme";
import { useNotificationsFeed } from "@/hooks/useNotifications";
import { formatRelative } from "@/utils/cn";

export default function NotificationsScreen() {
  const { c } = useTheme();
  const { data = [], isLoading, refetch, isRefetching, markRead, markAll, unreadCount } =
    useNotificationsFeed();

  if (isLoading) return <LoadingState label="Loading alerts…" />;

  return (
    <Screen>
      <Header
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread`
            : "Invites, tasks, and team updates"
        }
        right={
          unreadCount > 0 ? (
            <Button
              label="Mark all"
              variant="ghost"
              onPress={() => markAll.mutate()}
              style={{ paddingHorizontal: 8, minHeight: 36, paddingVertical: 8 }}
            />
          ) : null
        }
      />

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
                borderWidth: item.is_read ? 1 : 1.5,
              }}
            >
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                {!item.is_read ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: c.primary,
                      marginTop: 6,
                    }}
                  />
                ) : (
                  <View style={{ width: 8 }} />
                )}
                <View style={{ flex: 1 }}>
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
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
