import { PageSkeleton } from "@/components/admin/ui";

export default function Loading() {
  return <PageSkeleton stats={0} rows={8} side />;
}
