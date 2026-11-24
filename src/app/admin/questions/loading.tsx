import { PageSkeleton } from "@/components/admin/ui";

export default function Loading() {
  return <PageSkeleton stats={4} rows={10} />;
}
