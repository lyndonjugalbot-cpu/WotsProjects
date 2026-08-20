import { z } from "zod";

// Shared between the Server Action (always re-validates, never trusts the
// client) and any client-side form validation for immediate feedback.

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  // Only 'CLIENT' or 'VA' are selectable at signup — 'ADMIN' is not a valid
  // value here, and the DB trigger independently enforces this regardless
  // of what a modified request sends (see the profiles_and_vas migration).
  role: z.enum(["CLIENT", "VA"]),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
