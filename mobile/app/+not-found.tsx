import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/ui";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops" }} />
      <View className="flex-1 items-center justify-center bg-background px-6 dark:bg-background-dark">
        <Text className="text-lg font-semibold text-foreground dark:text-foreground-dark">
          Screen not found
        </Text>
        <Link href="/(tabs)/home" asChild>
          <Button label="Go home" className="mt-4" />
        </Link>
      </View>
    </>
  );
}
