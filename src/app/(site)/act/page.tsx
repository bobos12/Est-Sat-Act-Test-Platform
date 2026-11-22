import { TrackPage, trackMetadata } from "@/components/site/track-page";

export const generateMetadata = () => trackMetadata("act");

export default function Page() {
  return <TrackPage track="act" />;
}
