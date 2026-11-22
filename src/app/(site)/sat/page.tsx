import { TrackPage, trackMetadata } from "@/components/site/track-page";

export const generateMetadata = () => trackMetadata("sat");

export default function Page() {
  return <TrackPage track="sat" />;
}
