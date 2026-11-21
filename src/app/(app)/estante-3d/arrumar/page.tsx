import type { Metadata } from "next";
import { getAllEnrichedItems } from "@/features/shelves/queries";
import {
  mapEnrichedItemToVirtualBook,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";
import { ArrangeShelfStudio } from "@/components/ArrangeShelfStudio";

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
