import { z } from "zod";
import { evaluatePasswordStrength } from "@/features/auth/rules";

export const signInSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export const strongPasswordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .refine(
    (val) => evaluatePasswordStrength(val).isValid,
    "A senha deve conter no mínimo 8 caracteres, letra maiúscula, letra minúscula, número e caractere especial."
  );

export const signUpSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: strongPasswordSchema,
  displayName: z.string().optional(),
  confirmMinimumAge16: z
    .boolean()
    .refine(
      (val) => val === true,
      "É necessário confirmar ter pelo menos 16 anos."
    ),
  acceptTerms: z
    .boolean()
    .refine(
      (val) => val === true,
      "É obrigatório aceitar os Termos de Uso e Política de Privacidade."
    ),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  token: z
    .string()
    .trim()
    .min(16, "Informe o código de verificação enviado ao seu e-mail.")
    .max(128, "Código de verificação inválido."),
  password: strongPasswordSchema,
});

export const onboardingSchema = z.object({
  goal: z.enum(["organize", "read_more", "track_formats"]),
  preferredFormats: z
    .array(z.enum(["physical", "digital", "audio"]))
    .min(1, "Selecione pelo menos um formato."),
  annualTargetBooks: z.coerce.number().int().min(1).max(500).optional(),
});

export const themePreferenceSchema = z.enum([
  "system",
  "caderno",
  "dark-academia",
  "escandinavo",
  "gotico",
  "light",
  "dark",
  "editorial-light",
  "editorial-dark",
]);

export const densityPreferenceSchema = z.enum([
  "compact",
  "comfortable",
  "spacious",
]);

export const motionPreferenceSchema = z.enum(["system", "reduced", "full"]);

export const updateThemePreferencesSchema = z.object({
  theme: themePreferenceSchema.optional(),
  density: densityPreferenceSchema.optional(),
  motion: motionPreferenceSchema.optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  timezone: z.string().min(3).max(64).optional(),
  defaultCurrency: z.enum(["BRL", "USD", "EUR"]).optional(),
  theme: themePreferenceSchema.optional(),
  density: densityPreferenceSchema.optional(),
  motion: motionPreferenceSchema.optional(),
  threeD: z.enum(["auto", "on", "off"]).optional(),
  goalsCountRereads: z.boolean().optional(),
  maxSimultaneousReadings: z.coerce.number().int().min(1).max(20).optional(),
  telemetryOptOut: z.boolean().optional(),
});

export const deleteAccountSchema = z.object({
  confirmationPhrase: z.literal("EXCLUIR MINHA CONTA", {
    error: 'Digite exatamente "EXCLUIR MINHA CONTA" para confirmar.',
  }),
});
