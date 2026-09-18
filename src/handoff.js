export function isHumanTakeoverActive(conversation, takeoverDurationMs, now = Date.now()) {
  if (!conversation?.awaitingHuman) return false;

  const handoffTime = new Date(conversation.humanHandoffAt).getTime();
  if (!Number.isFinite(handoffTime)) return true;

  const elapsed = now - handoffTime;
  if (elapsed < 0) return true;
  return elapsed < takeoverDurationMs;
}
