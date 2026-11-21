import type { Metadata } from "next";
import { getWishlistOverview } from "@/features/wishlist/queries";
import { WishlistClient } from "@/components/WishlistClient";

export const metadata: Metadata = {
  title: "Lista de Desejos",
};

export default async function WishlistPage() {
  const overview = await getWishlistOverview();

  return (
    <div className="space-y-6">
      <header>
        <p className="editorial-kicker">
          Módulo C · Compra atômica para a estante
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Lista de Desejos
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Planeje próximas aquisições por prioridade e transfira para a estante
          correta em um clique quando comprar.
        </p>
      </header>

      <WishlistClient wanted={overview.wanted} purchased={overview.purchased} />
    </div>
  );
}
