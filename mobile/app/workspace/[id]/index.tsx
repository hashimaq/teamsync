import { Redirect, useLocalSearchParams } from "expo-router";

/** Web opens workspace on Chat by default — mirror that. */
export default function WorkspaceIndex() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Redirect href="/(tabs)/home" />;
  return <Redirect href={`/workspace/${id}/chat`} />;
}
