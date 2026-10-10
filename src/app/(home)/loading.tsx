import { HomeSkeleton } from "@/components/home-skeleton";
import { configDoPix } from "@/lib/pix";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col">
      <HomeSkeleton comApoio={configDoPix(process.env) !== null} />
    </div>
  );
}
