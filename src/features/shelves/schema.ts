import { z } from "zod";
import { ownershipStatusEnum } from "@/features/catalog/schema";

export const sortModeEnum = z.enum([
  "manual",
  "title",
  "author",
  "acquired",
  "finished",
]);

export const updateShelfSortSchema = z.object({
  shelfId: z.string().min(1),
  sortMode: sortModeEnum,
});

export const removeLibraryItemSchema = z.object({
  itemId: z.string().min(1),
});

export const updateItemOwnershipSchema = z.object({
  itemId: z.string().min(1),
  status: ownershipStatusEnum,
});

export const reorderShelfBooksSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(500),
});

export const updateBookSpineColorSchema = z.object({
  itemId: z.string().min(1),
  spineColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Cor hexadecimal inválida."),
});
