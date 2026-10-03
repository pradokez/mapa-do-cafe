import { HomeSkeleton } from "@/components/home-skeleton";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col">
      <HomeSkeleton />
    </div>
  );
}
