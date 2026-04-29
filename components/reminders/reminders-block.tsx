// Server component that fetches reminders + assignable people, then
// hands off to the client RemindersPanel for rendering. Keeps the
// dashboard page clean and isolates the data dependency.

import {
  listOpenReminders,
  listRecentCompletedReminders,
  listAssignablePeople,
} from "@/services/reminders";
import { getSession } from "@/lib/auth/session";
import { RemindersPanel } from "./reminders-panel";

export async function RemindersBlock() {
  const ctx = await getSession();

  const [open, recent, assignableTo] = await Promise.all([
    listOpenReminders(),
    listRecentCompletedReminders(30),
    listAssignablePeople(),
  ]);

  return (
    <RemindersPanel
      open={open}
      recentlyDoneCount={recent.length}
      assignableTo={assignableTo}
      currentUserId={ctx.userId}
    />
  );
}
