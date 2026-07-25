import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input, LoadingState, Screen } from "@/components/ui";
import { radius, space, useTheme } from "@/constants/theme";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/providers/AuthProvider";
import { formatTime } from "@/utils/cn";

export default function WorkspaceChatScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const baselineHeight = useRef(windowHeight);
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspaceId = id ?? "";
  const { user } = useAuth();
  const {
    data = [],
    isLoading,
    send,
    onTypingActivity,
    stopTyping,
    typingLabel,
  } = useChat(workspaceId);
  const [draft, setDraft] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (keyboardHeight === 0) {
      baselineHeight.current = windowHeight;
    }
  }, [windowHeight, keyboardHeight]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      stopTyping();
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [stopTyping]);

  useEffect(() => {
    if (data.length > 0 || typingLabel) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
    }
  }, [data.length, typingLabel]);

  if (isLoading) return <LoadingState label="Loading chat…" />;

  const windowAlreadyResized =
    Platform.OS === "android" &&
    keyboardHeight > 0 &&
    baselineHeight.current - windowHeight > 80;

  // Tab bar hides when keyboard is open — pad by keyboard height on Android.
  const composerBottomPad =
    keyboardHeight > 0
      ? windowAlreadyResized
        ? space.sm
        : Platform.OS === "ios"
          ? Math.max(keyboardHeight - insets.bottom, space.sm)
          : keyboardHeight
      : space.md;

  return (
    <Screen>
      <View style={styles.flex}>
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={data}
          keyExtractor={(item) => item.client_id ?? item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.md,
            gap: 10,
            flexGrow: 1,
            justifyContent: data.length === 0 ? "center" : "flex-end",
          }}
          ListEmptyComponent={
            <Text
              style={{
                textAlign: "center",
                color: c.mutedForeground,
                fontSize: 14,
                paddingHorizontal: 24,
              }}
            >
              No messages yet. Say hello to your team.
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                {!mine ? (
                  <Text
                    style={{
                      marginBottom: 4,
                      fontSize: 11,
                      fontWeight: "600",
                      color: c.mutedForeground,
                    }}
                  >
                    {item.sender?.full_name ?? "Member"}
                  </Text>
                ) : null}
                <View
                  style={{
                    maxWidth: "82%",
                    borderRadius: radius.lg,
                    borderBottomRightRadius: mine ? 4 : radius.lg,
                    borderBottomLeftRadius: mine ? radius.lg : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: mine ? c.bubbleMe : c.bubbleThem,
                    borderWidth: mine ? 0 : 1,
                    borderColor: c.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      lineHeight: 21,
                      color: mine ? "#fff" : c.foreground,
                    }}
                  >
                    {item.message}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      color: mine ? "rgba(255,255,255,0.7)" : c.mutedForeground,
                    }}
                  >
                    {formatTime(item.created_at)}
                    {item.pending ? " · sending" : ""}
                    {item.failed ? " · failed" : ""}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.border,
            backgroundColor: c.card,
            paddingBottom: composerBottomPad,
          }}
        >
          <View
            style={{
              minHeight: 28,
              paddingHorizontal: space.lg,
              paddingTop: 6,
              justifyContent: "center",
            }}
          >
            {typingLabel ? (
              <Text style={{ fontSize: 12, fontWeight: "500", color: c.primary }}>
                {typingLabel}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: space.sm,
              paddingHorizontal: space.md,
              paddingBottom: space.sm,
            }}
          >
            <Input
              style={{ flex: 1, maxHeight: 110 }}
              placeholder="Message…"
              value={draft}
              multiline
              blurOnSubmit={false}
              onBlur={stopTyping}
              onFocus={() => {
                setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
              }}
              onChangeText={(value) => {
                setDraft(value);
                if (value.trim()) {
                  onTypingActivity();
                } else {
                  stopTyping();
                }
              }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={send.isPending || !draft.trim()}
              onPress={() => {
                const text = draft.trim();
                if (!text) return;
                setDraft("");
                stopTyping();
                send.mutate(text);
              }}
              style={({ pressed }) => [
                {
                  minWidth: 56,
                  height: 48,
                  borderRadius: radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.primary,
                  opacity: !draft.trim() || send.isPending ? 0.45 : pressed ? 0.85 : 1,
                  paddingHorizontal: 14,
                },
              ]}
            >
              {send.isPending ? (
                <ActivityIndicator color={c.primaryForeground} />
              ) : (
                <Text
                  style={{
                    color: c.primaryForeground,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  Send
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
