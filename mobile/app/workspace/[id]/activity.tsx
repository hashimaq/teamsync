import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, Text } from "react-native";
import { Card, EmptyState, LoadingState, Screen } from "@/components/ui";
import { space, useTheme } from "@/constants/theme";
import { useWorkspaceActivity } from "@/hooks/useWorkspaces";
import { formatRelative } from "@/utils/cn";

export default function WorkspaceActivityScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data = [], isLoading, refetch, isRefetching } = useWorkspaceActivity(
    id ?? ""
  );

  if (isLoading) return <LoadingState />;

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            tintColor={c.primary}
            onRefresh={() => void refetch()}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No activity yet"
            description="Workspace events appear here in realtime."
          />
        }
        contentContainerStyle={{
          padding: space.lg,
          gap: 10,
          paddingBottom: 28,
          flexGrow: 1,
        }}
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontSize: 14, color: c.foreground, lineHeight: 20 }}>
              {item.message}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 11, color: c.mutedForeground }}>
              {item.event_type} · {formatRelative(item.created_at)}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}
