import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  radius,
  shadow,
  space,
  typography,
  useTheme,
} from "@/constants/theme";

export function Screen({
  children,
  padded = false,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: c.background },
        padded && { paddingHorizontal: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Header({
  title,
  subtitle,
  right,
  large = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  large?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + space.sm,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
        backgroundColor: c.background,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: space.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.brand, { color: c.primary, marginBottom: 4 }]}>
          TeamSync
        </Text>
        <Text
          style={[
            large ? typography.title : typography.heading,
            { color: c.foreground },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: c.mutedForeground, marginTop: 4 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          padding: space.lg,
          ...shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
        {body}
      </Pressable>
    );
  }
  return body;
}

export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return (
    <Text style={[typography.heading, { color: c.foreground }, style]}>
      {children}
    </Text>
  );
}

export function Subtitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return (
    <Text style={[typography.caption, { color: c.mutedForeground, lineHeight: 18 }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  loading,
  variant = "primary",
  style,
  disabled,
  ...props
}: PressableProps & {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const { c } = useTheme();
  const bg =
    variant === "primary"
      ? c.primary
      : variant === "danger"
        ? c.destructive
        : variant === "secondary"
          ? c.muted
          : "transparent";
  const fg =
    variant === "primary"
      ? c.primaryForeground
      : variant === "danger"
        ? "#fff"
        : variant === "ghost"
          ? c.primary
          : c.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          paddingVertical: 14,
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: c.border,
          opacity: disabled || loading ? 0.5 : pressed ? 0.88 : 1,
          minHeight: 48,
        },
        style as StyleProp<ViewStyle>,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ fontSize: 15, fontWeight: "600", color: fg }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Input({ style, ...props }: TextInputProps) {
  const { c } = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.mutedForeground}
      style={[
        {
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          paddingHorizontal: space.lg,
          paddingVertical: 14,
          fontSize: 16,
          color: c.foreground,
          minHeight: 48,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  const { c } = useTheme();
  if (!message) return null;
  return (
    <Text style={{ marginTop: 4, fontSize: 12, color: c.destructive }}>
      {message}
    </Text>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 28, paddingVertical: 48 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: space.lg,
        }}
      >
        <Text style={{ fontSize: 22 }}>✦</Text>
      </View>
      <Text style={[typography.heading, { color: c.foreground, textAlign: "center" }]}>
        {title}
      </Text>
      <Text
        style={[
          typography.caption,
          {
            color: c.mutedForeground,
            textAlign: "center",
            marginTop: space.sm,
            lineHeight: 18,
          },
        ]}
      >
        {description}
      </Text>
      {action ? <View style={{ marginTop: space.lg, width: "100%" }}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: space.md,
        backgroundColor: c.background,
      }}
    >
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={{ fontSize: 14, color: c.mutedForeground }}>{label}</Text>
    </View>
  );
}

export function Avatar({
  name,
  size = "md",
}: {
  name?: string | null;
  uri?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const { c } = useTheme();
  const dim = size === "sm" ? 32 : size === "lg" ? 56 : 42;
  const fontSize = size === "sm" ? 11 : size === "lg" ? 18 : 14;
  const initials =
    (name ?? "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <View
      style={{
        height: dim,
        width: dim,
        borderRadius: dim / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.primarySoft,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Text style={{ fontSize, fontWeight: "700", color: c.primary }}>{initials}</Text>
    </View>
  );
}

export function Badge({ count }: { count: number }) {
  const { c } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: radius.full,
        backgroundColor: c.destructive,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Text
      style={[
        typography.label,
        {
          color: c.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: space.sm,
        },
      ]}
    >
      {children}
    </Text>
  );
}

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          backgroundColor: pressed ? c.muted : "transparent",
        },
      ]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.bodyMedium, { color: c.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.caption, { color: c.mutedForeground, marginTop: 2 }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function chipStyle(
  c: { muted: string; border: string; primary: string },
  active?: boolean
): ViewStyle {
  return {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: active ? c.primary : c.muted,
    borderWidth: 1,
    borderColor: active ? c.primary : c.border,
  };
}
