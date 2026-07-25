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
import { signUpSchema, type SignUpInput } from "@/lib/validations";
import { useAuth } from "@/providers/AuthProvider";

export default function SignUpScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setLoading(true);
      await signUp(values);
    } catch (error) {
      Alert.alert(
        "Sign up failed",
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
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={[typography.brand, { color: c.primary }]}>TeamSync</Text>
          <Title style={{ marginTop: 8, fontSize: 28 }}>Create account</Title>
          <Subtitle style={{ marginTop: 8 }}>
            Join with email and password — same Supabase project as web.
          </Subtitle>

          <View style={{ marginTop: space.xxl, gap: space.md }}>
            <Controller
              control={control}
              name="full_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="Full name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <FieldError message={errors.full_name?.message} />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  autoCapitalize="none"
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
                  secureTextEntry
                  placeholder="Password (min 8)"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <FieldError message={errors.password?.message} />

            <Button label="Create account" loading={loading} onPress={onSubmit} />

            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={{ textAlign: "center", fontSize: 14, color: c.mutedForeground }}>
                  Already have an account?{" "}
                  <Text style={{ fontWeight: "700", color: c.primary }}>Sign in</Text>
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
});
