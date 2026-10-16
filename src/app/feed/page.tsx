import type { Metadata } from "next";
import { FeedEditor } from "@/components/feed/FeedEditor";

export const metadata: Metadata = { title: "Post de Feed · Design Mantora" };

export default function FeedPage() {
  return <FeedEditor />;
}
