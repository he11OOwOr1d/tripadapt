export type RecoveryChoice = "finished" | "ongoing" | "missed";
export const recoveryChoices = {
  finished: {
    label: "I finished it",
    action: "Review completion",
    guidance: "Confirm Already completed in the editor, then save. Choosing this answer does not mark it completed.",
    focus: "completed",
  },
  ongoing: {
    label: "I’m still doing it",
    action: "Review duration",
    guidance: "Keep the original start and review the total duration, including time already spent. The rest of your day will need a fresh check.",
    focus: "minutes",
  },
  missed: {
    label: "I didn’t do it",
    action: "Review didn’t happen",
    guidance: "Confirm Didn’t happen in the editor, then save to keep the record and its costs while freeing its time. This does not cancel a booking or record a refund. To do it later instead, change the day or time and leave the outcome unchecked.",
    focus: "skipped",
  },
} as const;
