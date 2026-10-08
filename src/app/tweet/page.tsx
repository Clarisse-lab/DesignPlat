import type { Metadata } from "next";
import { TweetEditor } from "@/components/tweet/TweetEditor";

export const metadata: Metadata = { title: "Carrossel Tweet · DesignPlat" };

export default function TweetPage() {
  return <TweetEditor />;
}
