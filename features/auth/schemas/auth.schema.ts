import { z } from "zod";

// Client-side checks are for fast feedback only; the API re-validates everything
// (including the breached/common-password policy, which only the server applies).
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .email("Enter a valid email address.");

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

const name = z.string().trim().min(1, "Name is required.").max(100, "Name is too long.");

function confirmMatches<T extends { newPassword: string; confirmPassword: string }>(value: T, ctx: z.RefinementCtx) {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match." });
  }
}

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required.").max(PASSWORD_MAX_LENGTH, "Password is too long."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ newPassword, confirmPassword: z.string() })
  .superRefine(confirmMatches);

export const acceptInvitationSchema = z
  .object({ name, newPassword, confirmPassword: z.string() })
  .superRefine(confirmMatches);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    confirmMatches(value, ctx);
    if (value.currentPassword && value.newPassword === value.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must differ from the current password.",
      });
    }
  });

export const profileSchema = z.object({ name });

export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
