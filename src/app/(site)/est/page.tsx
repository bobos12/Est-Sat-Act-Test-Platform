import { TrackPage, trackMetadata } from "@/components/site/track-page";

export const generateMetadata = () => trackMetadata("est");

export default function Page() {
  return <TrackPage track="est" />;
}
