import type { Metadata } from "next";
import { FeedEditor } from "@/components/feed/FeedEditor";

export const metadata: Metadata = { title: "Apresentação · Design Mantora" };

export default function PresentationPage() {
  return <FeedEditor mode="apresentacao" />;
}
