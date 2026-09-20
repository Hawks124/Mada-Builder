import { redirect } from "next/navigation";

// Édition = le formulaire submit pré-rempli (?edit=). Cette route
// n'existe que pour rediriger les anciens liens vers le form unique.
export default async function DashboardProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/products/submit?edit=${id}`);
}
