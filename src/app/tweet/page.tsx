import type { Metadata } from "next";
import { TweetEditor } from "@/components/tweet/TweetEditor";

export const metadata: Metadata = { title: "Carrossel Tweet · Design Mantora" };

export default function TweetPage() {
  return <TweetEditor />;
}
