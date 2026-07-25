import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FieldError,
  Header,
  Input,
  LoadingState,
  Screen,
  SectionLabel,
  Subtitle,
  Title,
} from "@/components/ui";
import { ACTIVE_WORKSPACE_KEY, radius, space, useTheme } from "@/constants/theme";
import { useInvitations, useWorkspaces } from "@/hooks/useWorkspaces";
import { queryKeys } from "@/lib/query-client";
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from "@/lib/validations";
import { useAuth } from "@/providers/AuthProvider";
import {
  acceptInvitation,
  createWorkspace,
  declineInvitation,
} from "@/services/workspaces";
import { formatRelative } from "@/utils/cn";

export default function HomeScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: workspaces = [], isLoading, refetch, isRefetching } =
    useWorkspaces();
  const { data: invitations = [], refetch: refetchInvites } = useInvitations();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "", description: "" },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.description ?? "").toLowerCase().includes(q)
    );
  }, [workspaces, query]);

  const openWorkspace = async (id: string) => {
    await AsyncStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    router.push(`/workspace/${id}/chat`);
  };

  const onCreate = form.handleSubmit(async (values) => {
    try {
      setCreating(true);
      const id = await createWorkspace(values);
      setCreateOpen(false);
      form.reset();
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.workspaces(user.id),
        });
      }
      await openWorkspace(id);
    } catch (error) {
      Alert.alert(
        "Could not create workspace",
        error instanceof Error ? error.message : "Try again"
      );
    } finally {
      setCreating(false);
    }
  });

  if (isLoading) return <LoadingState label="Loading workspaces…" />;

  return (
    <Screen>
      <Header
        large
        title={`Hi, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
        subtitle="Collaborate. Chat. Stay in Sync."
        right={<Avatar name={profile?.full_name} uri={profile?.avatar_url} size="lg" />}
      />

      <View style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Input
          placeholder="Search workspaces…"
          value={query}
          onChangeText={setQuery}
          style={{ marginBottom: space.md }}
        />

        <Button
          label="Create workspace"
          onPress={() => setCreateOpen(true)}
          style={{ marginBottom: space.lg }}
        />

        {invitations.length > 0 ? (
          <View style={{ marginBottom: space.lg }}>
            <SectionLabel>Pending invites</SectionLabel>
            {invitations.map((invite) => (
              <Card key={invite.id} style={{ marginBottom: space.sm, gap: space.sm }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.foreground }}>
                  {invite.workspace?.name ?? "Workspace"}
                </Text>
                <Subtitle>
                  From {invite.inviter?.full_name ?? "a teammate"}
                </Subtitle>
                <View style={{ flexDirection: "row", gap: space.sm, marginTop: 4 }}>
                  <Button
                    label="Accept"
                    style={{ flex: 1 }}
                    onPress={async () => {
                      try {
                        await acceptInvitation(invite.id);
                        await Promise.all([refetch(), refetchInvites()]);
                      } catch (error) {
                        Alert.alert(
                          "Accept failed",
                          error instanceof Error ? error.message : "Try again"
                        );
                      }
                    }}
                  />
                  <Button
                    label="Decline"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={async () => {
                      try {
                        await declineInvitation(invite.id);
                        await refetchInvites();
                      } catch (error) {
                        Alert.alert(
                          "Decline failed",
                          error instanceof Error ? error.message : "Try again"
                        );
                      }
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        <SectionLabel>Your workspaces</SectionLabel>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              tintColor={c.primary}
              onRefresh={() => {
                void refetch();
                void refetchInvites();
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No workspaces yet"
              description="Create a workspace or accept an invite to get started."
            />
          }
          contentContainerStyle={{ paddingBottom: 28, gap: 12 }}
          renderItem={({ item }) => (
            <Card onPress={() => void openWorkspace(item.id)}>
              <View style={styles.rowBetween}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: c.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="people" size={18} color={c.primary} />
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
              </View>
              <Text
                style={{
                  marginTop: space.md,
                  fontSize: 17,
                  fontWeight: "700",
                  color: c.foreground,
                }}
              >
                {item.name}
              </Text>
              {item.description ? (
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: c.mutedForeground,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              ) : null}
              <Text style={{ marginTop: space.md, fontSize: 12, color: c.mutedForeground }}>
                {item.member_count ?? 0} members · {item.task_count ?? 0} tasks ·{" "}
                {formatRelative(item.created_at)}
              </Text>
            </Card>
          )}
        />
      </View>

      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={[styles.modalBackdrop, { backgroundColor: c.overlay }]}>
          <View
            style={{
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              backgroundColor: c.background,
              padding: space.xl,
              paddingBottom: space.xxl,
              gap: space.md,
            }}
          >
            <Title>New workspace</Title>
            <Subtitle>Give your team a place to chat, plan, and ship.</Subtitle>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <Input
                  placeholder="Workspace name"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            <FieldError message={form.formState.errors.name?.message} />
            <Controller
              control={form.control}
              name="description"
              render={({ field: { onChange, value } }) => (
                <Input
                  placeholder="Description (optional)"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            <Button label="Create" loading={creating} onPress={onCreate} />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => setCreateOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
