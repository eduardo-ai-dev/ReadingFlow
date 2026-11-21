import { AddBookFormClient } from "@/components/AddBookFormClient";

export default async function AddBookPage({
  searchParams,
}: {
  searchParams: Promise<{ genero?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const initialGenre = sp.genero ?? "";
  const initialTitle = sp.q ?? "";
  return (
    <AddBookFormClient
      key={`${initialGenre}:${initialTitle}`}
      initialGenre={initialGenre}
      initialTitle={initialTitle}
    />
  );
}
