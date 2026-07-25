import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Name is required").max(80),
  description: z.string().max(280).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(160),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "done"]),
  due_date: z.string().optional(),
  assignee_id: z.string().uuid().optional().or(z.literal("")),
});

export const profileSchema = z.object({
  full_name: z.string().min(2).max(80),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
