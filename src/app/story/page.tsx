import type { Metadata } from "next";
import { FeedEditor } from "@/components/feed/FeedEditor";

export const metadata: Metadata = { title: "Story · Design Mantora" };

export default function StoryPage() {
  return <FeedEditor mode="story" />;
}
