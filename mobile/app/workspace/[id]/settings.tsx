import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  FieldError,
  Input,
  LoadingState,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";
import { radius, space, useTheme } from "@/constants/theme";
import { queryKeys } from "@/lib/query-client";
import { WEB_URL } from "@/lib/supabase";
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from "@/lib/validations";
import { useAuth } from "@/providers/AuthProvider";
import {
  getWorkspace,
  leaveWorkspace,
  updateWorkspace,
} from "@/services/workspaces";
import { useWorkspaceMembers } from "@/hooks/useWorkspaces";

export default function WorkspaceSettingsScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspaceId = id ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspace(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const membersQuery = useWorkspaceMembers(workspaceId);
  const me = membersQuery.data?.find((m) => m.user_id === user?.id);
  const isOwner = me?.role === "owner";

  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    values: {
      name: workspaceQuery.data?.name ?? "",
      description: workspaceQuery.data?.description ?? "",
    },
  });

  if (workspaceQuery.isLoading) return <LoadingState />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 40 }}>
        <Title style={{ fontSize: 22 }}>Settings</Title>
        <Subtitle>Manage this workspace — same controls as web</Subtitle>

        <Card style={{ gap: space.sm, marginTop: space.sm }}>
          <Text style={{ fontSize: 12, color: c.mutedForeground }}>Workspace details</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: c.foreground }}>
            {workspaceQuery.data?.name}
          </Text>
          <Text style={{ fontSize: 14, color: c.mutedForeground, lineHeight: 20 }}>
            {workspaceQuery.data?.description || "No description"}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: "600",
              color: c.foreground,
              textTransform: "capitalize",
            }}
          >
            Your role · {me?.role ?? "member"}
          </Text>
          {isOwner ? (
            <Button
              label="Edit workspace"
              variant="secondary"
              style={{ marginTop: space.sm }}
              onPress={() => setEditOpen(true)}
            />
          ) : null}
        </Card>

        <Card style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, color: c.mutedForeground }}>Whiteboard</Text>
          <Text style={{ fontSize: 13, color: c.mutedForeground, lineHeight: 18 }}>
            Full collaborative canvas runs on web: {WEB_URL}
          </Text>
        </Card>

        {!isOwner ? (
          <Button
            label="Leave workspace"
            variant="danger"
            onPress={() => {
              Alert.alert("Leave workspace?", "You can rejoin via invite.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Leave",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await leaveWorkspace(workspaceId);
                      router.replace("/(tabs)/home");
                    } catch (error) {
                      Alert.alert(
                        "Leave failed",
                        error instanceof Error ? error.message : "Try again"
                      );
                    }
                  },
                },
              ]);
            }}
          />
        ) : (
          <Subtitle>
            Owners manage membership here. Transfer ownership on web before leaving.
          </Subtitle>
        )}
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: c.overlay,
          }}
        >
          <View
            style={{
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              backgroundColor: c.background,
              padding: space.xl,
              gap: space.md,
            }}
          >
            <Title>Edit workspace</Title>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <Input placeholder="Name" value={value} onChangeText={onChange} />
              )}
            />
            <FieldError message={form.formState.errors.name?.message} />
            <Controller
              control={form.control}
              name="description"
              render={({ field: { onChange, value } }) => (
                <Input
                  placeholder="Description"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            <Button
              label="Save"
              loading={saving}
              onPress={form.handleSubmit(async (values) => {
                try {
                  setSaving(true);
                  await updateWorkspace(workspaceId, values);
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.workspace(workspaceId),
                  });
                  if (user?.id) {
                    await queryClient.invalidateQueries({
                      queryKey: queryKeys.workspaces(user.id),
                    });
                  }
                  setEditOpen(false);
                } catch (error) {
                  Alert.alert(
                    "Update failed",
                    error instanceof Error ? error.message : "Try again"
                  );
                } finally {
                  setSaving(false);
                }
              })}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setEditOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
