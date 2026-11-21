import { AddBookFormClient } from "@/components/AddBookFormClient";

export default async function AddBookPage({
  searchParams,
}: {
  searchParams: Promise<{ genero?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AddBookFormClient
      key={sp.genero ?? "default"}
      initialGenre={sp.genero ?? ""}
    />
  );
}
