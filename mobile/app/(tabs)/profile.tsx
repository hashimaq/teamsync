import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Avatar,
  Button,
  Card,
  FieldError,
  Header,
  Input,
  Screen,
  SectionLabel,
  Subtitle,
} from "@/components/ui";
import { space, useTheme } from "@/constants/theme";
import { profileSchema, type ProfileInput } from "@/lib/validations";
import { useAuth } from "@/providers/AuthProvider";

export default function ProfileScreen() {
  const { c, isDark, setMode } = useTheme();
  const { profile, user, updateProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? "",
      avatar_url: profile?.avatar_url ?? "",
    },
  });

  const onSave = form.handleSubmit(async (values) => {
    try {
      setSaving(true);
      await updateProfile({
        full_name: values.full_name,
        avatar_url: values.avatar_url || null,
      });
      Alert.alert("Saved", "Profile updated.");
    } catch (error) {
      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Try again"
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <Screen>
      <Header title="Profile" subtitle="Same account as web & extension" />
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          gap: space.lg,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xl }}>
          <Avatar name={profile?.full_name} uri={profile?.avatar_url} size="lg" />
          <Text style={{ fontSize: 18, fontWeight: "700", color: c.foreground }}>
            {profile?.full_name ?? "Your name"}
          </Text>
          <Subtitle>{user?.email}</Subtitle>
        </Card>

        <View style={{ gap: space.md }}>
          <SectionLabel>Appearance</SectionLabel>
          <Card>
            <Pressable
              onPress={() => setMode(isDark ? "light" : "dark")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
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
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={20}
                  color={c.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>
                  Dark mode
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: c.mutedForeground }}>
                  {isDark ? "On — easier on the eyes at night" : "Off — default light theme"}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={(value) => setMode(value ? "dark" : "light")}
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor="#fff"
              />
            </Pressable>
          </Card>

          <SectionLabel>Account</SectionLabel>
          <Controller
            control={form.control}
            name="full_name"
            render={({ field: { onChange, value } }) => (
              <Input placeholder="Full name" value={value} onChangeText={onChange} />
            )}
          />
          <FieldError message={form.formState.errors.full_name?.message} />

          <Controller
            control={form.control}
            name="avatar_url"
            render={({ field: { onChange, value } }) => (
              <Input
                placeholder="Avatar URL (optional)"
                autoCapitalize="none"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          <FieldError message={form.formState.errors.avatar_url?.message} />

          <Button label="Save profile" loading={saving} onPress={onSave} />
          <Button
            label="Log out"
            variant="danger"
            loading={loggingOut}
            onPress={async () => {
              try {
                setLoggingOut(true);
                await signOut();
              } catch (error) {
                Alert.alert(
                  "Logout failed",
                  error instanceof Error ? error.message : "Try again"
                );
              } finally {
                setLoggingOut(false);
              }
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
