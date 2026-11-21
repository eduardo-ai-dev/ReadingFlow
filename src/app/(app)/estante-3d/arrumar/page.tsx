import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getAllEnrichedItems } from "@/features/shelves/queries";
import {
  mapEnrichedItemToVirtualBook,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";

const ArrangeShelfStudio = dynamic(
  () =>
    import("@/components/ArrangeShelfStudio").then(
      (mod) => mod.ArrangeShelfStudio
    ),
  {
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        className="rf-card h-96 animate-pulse bg-[var(--rf-surface-subtle)]/60"
      />
    ),
  }
);

export const metadata: Metadata = {
  title: "Arrumar estante — ReadingFlow",
  description:
    "Organize suas prateleiras, cores predominantes e ordem exata dos seus livros.",
};

export default async function ArrumarEstantePage() {
  const allItems = await getAllEnrichedItems();
  const sortedItems = [...allItems].sort(
    (a, b) => a.item.shelfPosition - b.item.shelfPosition
  );

  const virtualBooks: VirtualBookItem[] = sortedItems.map((entry) =>
    mapEnrichedItemToVirtualBook(entry)
  );

  return (
    <div className="w-full py-1 sm:py-2">
      <ArrangeShelfStudio initialBooks={virtualBooks} backHref="/estante-3d" />
    </div>
  );
}
