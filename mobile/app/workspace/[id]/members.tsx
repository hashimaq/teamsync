import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Screen,
} from "@/components/ui";
import { space, useTheme } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspaceMembers } from "@/hooks/useWorkspaces";
import { inviteMember } from "@/services/workspaces";

export default function WorkspaceMembersScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspaceId = id ?? "";
  const { user } = useAuth();
  const { data = [], isLoading, refetch } = useWorkspaceMembers(workspaceId);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const me = data.find((m) => m.user_id === user?.id);
  const isOwner = me?.role === "owner";

  if (isLoading) return <LoadingState />;

  return (
    <Screen>
      {isOwner ? (
        <View
          style={{
            flexDirection: "row",
            gap: space.sm,
            padding: space.lg,
            paddingBottom: space.sm,
          }}
        >
          <Input
            style={{ flex: 1 }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Invite by registered email"
            value={email}
            onChangeText={setEmail}
          />
          <Button
            label="Invite"
            loading={inviting}
            style={{ paddingHorizontal: 16 }}
            onPress={async () => {
              try {
                setInviting(true);
                await inviteMember(workspaceId, email);
                setEmail("");
                Alert.alert("Invite sent");
                await refetch();
              } catch (error) {
                Alert.alert(
                  "Invite failed",
                  error instanceof Error ? error.message : "Try again"
                );
              } finally {
                setInviting(false);
              }
            }}
          />
        </View>
      ) : null}

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState title="No members" description="Invite teammates to collaborate." />
        }
        contentContainerStyle={{
          padding: space.lg,
          gap: 10,
          paddingBottom: 28,
          flexGrow: 1,
        }}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar
                name={item.profile?.full_name}
                uri={item.profile?.avatar_url}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>
                  {item.profile?.full_name ?? "Member"}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: c.mutedForeground,
                    textTransform: "capitalize",
                  }}
                >
                  {item.role}
                  {item.profile?.email ? ` · ${item.profile.email}` : ""}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
