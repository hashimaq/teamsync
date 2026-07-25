import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACTIVE_WORKSPACE_KEY } from "@/constants/theme";

export async function getActiveWorkspaceId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export async function setActiveWorkspaceId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
}
