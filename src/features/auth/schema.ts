import { z } from "zod";
import {
  MAX_BCRYPT_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  getUtf8ByteLength,
  isCommonOrTrivialPassword,
} from "@/features/auth/rules";

export const signInSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z
    .string()
    .min(1, "Informe sua senha.")
    .refine(
      (val) => getUtf8ByteLength(val) <= MAX_BCRYPT_PASSWORD_BYTES,
      "E-mail ou senha incorretos."
    ),
  rememberMe: z.boolean().optional(),
  captchaToken: z.string().max(4096).optional(),
});

export const strongPasswordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
  )
  .refine(
    (val) => getUtf8ByteLength(val) <= MAX_BCRYPT_PASSWORD_BYTES,
    `A senha excede o limite de ${MAX_BCRYPT_PASSWORD_BYTES} bytes UTF-8 (caracteres acentuados ou emojis ocupam mais bytes).`
  )
  .refine(
    (val) => !isCommonOrTrivialPassword(val),
    "Escolha uma senha menos comum (dica: use uma frase com espaços)."
  );

export const signUpSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: strongPasswordSchema,
  displayName: z.string().optional(),
  captchaToken: z.string().max(4096).optional(),
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
  captchaToken: z.string().max(4096).optional(),
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual.").optional(),
  newPassword: strongPasswordSchema,
});

export const requestMagicLinkSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  captchaToken: z.string().max(4096).optional(),
});

export const verifyMagicLinkSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  code: z
    .string()
    .trim()
    .min(16, "Código inválido ou expirado.")
    .max(128, "Código inválido ou expirado."),
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

export const fxPreferenceSchema = z.enum(["full", "min"]);

export const ambientSoundIdSchema = z.enum([
  "chuva-suave",
  "tempestade",
  "lareira",
  "biblioteca",
  "cafeteria",
  "floresta",
  "ondas-mar",
  "vento",
  "noite-grilos",
  "ruido-branco",
  "ruido-rosa",
  "ruido-marrom",
]);

export const ambientPreferencesSchema = z.object({
  selectedIds: z.array(ambientSoundIdSchema).max(3),
  volumes: z.record(z.string(), z.number().min(0).max(1)).default({}),
  masterVolume: z.number().min(0).max(1),
  continueAcrossPages: z.boolean().default(false),
});

export const updateThemePreferencesSchema = z.object({
  theme: themePreferenceSchema.optional(),
  density: densityPreferenceSchema.optional(),
  motion: motionPreferenceSchema.optional(),
  fx: fxPreferenceSchema.optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  timezone: z.string().min(3).max(64).optional(),
  defaultCurrency: z.enum(["BRL", "USD", "EUR"]).optional(),
  theme: themePreferenceSchema.optional(),
  density: densityPreferenceSchema.optional(),
  motion: motionPreferenceSchema.optional(),
  fx: fxPreferenceSchema.optional(),
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
