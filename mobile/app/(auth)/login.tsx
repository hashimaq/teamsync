import { Link } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  FieldError,
  Input,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";
import { space, typography, useTheme } from "@/constants/theme";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setLoading(true);
      await signIn(values);
    } catch (error) {
      Alert.alert(
        "Sign in failed",
        error instanceof Error ? error.message : "Try again"
      );
    } finally {
      setLoading(false);
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: c.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: space.lg,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: c.primary }}>TS</Text>
          </View>
          <Text style={[typography.brand, { color: c.primary }]}>TeamSync</Text>
          <Title style={{ marginTop: 8, fontSize: 28 }}>Welcome back</Title>
          <Subtitle style={{ marginTop: 8 }}>
            Use the same account as the web app and Chrome extension.
          </Subtitle>

          <View style={{ marginTop: space.xxl, gap: space.md }}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="Email"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <FieldError message={errors.email?.message} />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  autoCapitalize="none"
                  autoComplete="password"
                  placeholder="Password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <FieldError message={errors.password?.message} />

            <Button label="Sign in" loading={loading} onPress={onSubmit} />

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable>
                <Text style={[styles.link, { color: c.primary }]}>Forgot password?</Text>
              </Pressable>
            </Link>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text style={[styles.muted, { color: c.mutedForeground }]}>
                  New here?{" "}
                  <Text style={{ fontWeight: "700", color: c.primary }}>Create account</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  link: { marginTop: 4, textAlign: "center", fontSize: 14, fontWeight: "600" },
  muted: { textAlign: "center", fontSize: 14 },
});
