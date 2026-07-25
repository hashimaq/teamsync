import { Link } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, Text, View } from "react-native";
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
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations";
import { resetPassword } from "@/services/auth";

export default function ForgotPasswordScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setLoading(true);
      await resetPassword(values.email);
      Alert.alert(
        "Check your email",
        "If an account exists, a reset link was sent. Open it on the web app to set a new password."
      );
    } catch (error) {
      Alert.alert(
        "Reset failed",
        error instanceof Error ? error.message : "Try again"
      );
    } finally {
      setLoading(false);
    }
  });

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 24,
          gap: space.md,
        }}
      >
        <Text style={[typography.brand, { color: c.primary }]}>TeamSync</Text>
        <Title style={{ fontSize: 28 }}>Forgot password</Title>
        <Subtitle>
          We will email a reset link that opens on the TeamSync website.
        </Subtitle>
        <View style={{ marginTop: space.lg, gap: space.md }}>
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
          <Button label="Send reset link" loading={loading} onPress={onSubmit} />
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: "600",
                  color: c.primary,
                }}
              >
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
