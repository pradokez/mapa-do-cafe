import { notFound } from "next/navigation";

import { getCafe } from "./get-cafe";

// A checagem de existência mora aqui, e não só na página, por causa do status:
// o `loading.tsx` põe a página num Suspense, e o shell sai com 200 antes de ela
// chamar `notFound()` (#72). O layout fica fora desse Suspense, então o 404 vale.
export default async function CafeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  if (!(await getCafe(params.slug))) notFound();
  return children;
}
