import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { TaskStatus } from "@teamsync/shared";
import {
  Button,
  Card,
  FieldError,
  Input,
  LoadingState,
  Screen,
  SectionLabel,
  Title,
  chipStyle,
} from "@/components/ui";
import { radius, space, useTheme } from "@/constants/theme";
import { useTasks } from "@/hooks/useTasks";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validations";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  done: "Done",
};

export default function WorkspaceTasksScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspaceId = id ?? "";
  const { data = [], isLoading, create, update, remove } = useTasks(workspaceId);
  const [open, setOpen] = useState(false);

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "todo",
      due_date: "",
      assignee_id: "",
    },
  });

  const grouped = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        tasks: data.filter((task) => task.status === status),
      })),
    [data]
  );

  if (isLoading) return <LoadingState label="Loading tasks…" />;

  return (
    <Screen>
      <View style={{ padding: space.lg, paddingBottom: 0 }}>
        <Button label="New task" onPress={() => setOpen(true)} />
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(item) => item.status}
        contentContainerStyle={{ padding: space.lg, gap: 18, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View>
            <SectionLabel>
              {STATUS_LABEL[item.status]} · {item.tasks.length}
            </SectionLabel>
            {item.tasks.length === 0 ? (
              <Text style={{ fontSize: 12, color: c.mutedForeground }}>No tasks</Text>
            ) : (
              item.tasks.map((task) => (
                <Card key={task.id} style={{ marginBottom: space.sm }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: c.foreground }}>
                    {task.title}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: c.mutedForeground,
                      textTransform: "capitalize",
                    }}
                  >
                    {task.priority} priority
                    {task.due_date ? ` · due ${task.due_date}` : ""}
                  </Text>
                  <View
                    style={{
                      marginTop: space.md,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {STATUS_ORDER.filter((s) => s !== task.status).map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => update.mutate({ id: task.id, patch: { status } })}
                        style={chipStyle(c)}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "600", color: c.foreground }}>
                          → {STATUS_LABEL[status]}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => {
                        Alert.alert("Delete task?", task.title, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => remove.mutate(task.id),
                          },
                        ]);
                      }}
                      style={[chipStyle(c), { backgroundColor: `${c.destructive}18` }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: c.destructive }}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      />

      <Modal visible={open} animationType="slide" transparent>
        <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
          <View
            style={{
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              backgroundColor: c.background,
              padding: space.xl,
              gap: space.md,
            }}
          >
            <Title>Create task</Title>
            <Controller
              control={form.control}
              name="title"
              render={({ field: { onChange, value } }) => (
                <Input placeholder="Title" value={value} onChangeText={onChange} />
              )}
            />
            <FieldError message={form.formState.errors.title?.message} />
            <Controller
              control={form.control}
              name="description"
              render={({ field: { onChange, value } }) => (
                <Input
                  placeholder="Description"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            <Button
              label="Create"
              loading={create.isPending}
              onPress={form.handleSubmit(async (values) => {
                try {
                  await create.mutateAsync({
                    workspace_id: workspaceId,
                    title: values.title,
                    description: values.description,
                    priority: values.priority,
                    status: values.status,
                    due_date: values.due_date || null,
                    assignee_id: values.assignee_id || null,
                  });
                  setOpen(false);
                  form.reset();
                } catch (error) {
                  Alert.alert(
                    "Create failed",
                    error instanceof Error ? error.message : "Try again"
                  );
                }
              })}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
});
