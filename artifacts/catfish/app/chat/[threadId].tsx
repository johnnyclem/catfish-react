/**
 * Pass 2 — per-thread chat route.
 *
 * Routes like `/chat/<threadId>` and is pushed from the Matches tab.
 * All non-trivial logic lives in the ThreadView component so this file
 * stays a thin route shell.
 */

import { useLocalSearchParams } from "expo-router";

import { ThreadView } from "@/features/chat/ThreadView";
import { ThreadId } from "@/core/models";

export default function ChatThreadRoute() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  return <ThreadView threadId={threadId as ThreadId} />;
}
