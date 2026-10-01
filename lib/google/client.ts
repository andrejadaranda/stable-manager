// Thin Google Calendar API v3 client — pure request helpers that take an
// already-valid access token. Token lifecycle (refresh/persist) lives in
// services/googleCalendar.ts. Everything here is server-only.

const API = "https://www.googleapis.com/calendar/v3";

export type GoogleEventDate = { dateTime?: string; date?: string; timeZone?: string };

export type GoogleEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  updated?: string;
  recurringEventId?: string;
  iCalUID?: string;
  start?: GoogleEventDate;
  end?: GoogleEventDate;
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
};

export type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  accessRole?: string;
  primary?: boolean;
  deleted?: boolean;
};

async function gfetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** A tagged error so the sync layer can react (410 → full resync, 401 → reauth). */
export class GoogleApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GoogleApiError";
  }
}

async function ok(res: Response): Promise<unknown> {
  if (res.ok) return res.status === 204 ? null : res.json();
  const text = await res.text();
  throw new GoogleApiError(res.status, `Google API ${res.status}: ${text}`);
}

export async function listCalendarList(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const out: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const p = new URLSearchParams({ maxResults: "250", showHidden: "true" });
    if (pageToken) p.set("pageToken", pageToken);
    const data = (await ok(await gfetch(accessToken, `/users/me/calendarList?${p}`))) as {
      items?: GoogleCalendarListEntry[];
      nextPageToken?: string;
    };
    out.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

export type ListEventsResult = { items: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };

/** One page of events. Pass either syncToken (incremental) or timeMin/timeMax
 *  (initial). singleEvents=true expands recurrence into instances. */
export async function listEventsPage(
  accessToken: string,
  calendarId: string,
  opts: { syncToken?: string; timeMin?: string; timeMax?: string; pageToken?: string },
): Promise<ListEventsResult> {
  const p = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
  if (opts.syncToken) {
    p.set("syncToken", opts.syncToken);
  } else {
    if (opts.timeMin) p.set("timeMin", opts.timeMin);
    if (opts.timeMax) p.set("timeMax", opts.timeMax);
  }
  if (opts.pageToken) p.set("pageToken", opts.pageToken);
  const data = (await ok(
    await gfetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${p}`),
  )) as ListEventsResult;
  return { items: data.items ?? [], nextPageToken: data.nextPageToken, nextSyncToken: data.nextSyncToken };
}

export type EventWrite = {
  summary: string;
  description?: string | null;
  location?: string | null;
  start: GoogleEventDate;
  end: GoogleEventDate;
  recurrence?: string[] | null;
  extendedPrivate?: Record<string, string>;
};

function toBody(e: EventWrite) {
  return {
    summary: e.summary,
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    start: e.start,
    end: e.end,
    recurrence: e.recurrence ?? undefined,
    extendedProperties: e.extendedPrivate ? { private: e.extendedPrivate } : undefined,
  };
}

export async function insertEvent(accessToken: string, calendarId: string, e: EventWrite): Promise<GoogleEvent> {
  return (await ok(
    await gfetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(toBody(e)),
    }),
  )) as GoogleEvent;
}

export async function patchEvent(accessToken: string, calendarId: string, eventId: string, e: Partial<EventWrite>): Promise<GoogleEvent> {
  const body: Record<string, unknown> = {};
  if (e.summary !== undefined) body.summary = e.summary;
  if (e.description !== undefined) body.description = e.description ?? "";
  if (e.location !== undefined) body.location = e.location ?? "";
  if (e.start !== undefined) body.start = e.start;
  if (e.end !== undefined) body.end = e.end;
  if (e.extendedPrivate !== undefined) body.extendedProperties = { private: e.extendedPrivate };
  return (await ok(
    await gfetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  )) as GoogleEvent;
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await gfetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
  // 410 Gone / 404 → already deleted; treat as success (idempotent delete).
  if (res.ok || res.status === 410 || res.status === 404) return;
  throw new GoogleApiError(res.status, `Google delete ${res.status}: ${await res.text()}`);
}

export type WatchResult = { id: string; resourceId: string; expiration?: string };

/** Start a push channel on a calendar's events collection. */
export async function watchEvents(
  accessToken: string,
  calendarId: string,
  channelId: string,
  address: string,
  token: string,
): Promise<WatchResult> {
  const data = (await ok(
    await gfetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
      method: "POST",
      body: JSON.stringify({ id: channelId, type: "web_hook", address, token }),
    }),
  )) as WatchResult;
  return data;
}

export async function stopChannel(accessToken: string, channelId: string, resourceId: string): Promise<void> {
  const res = await gfetch(accessToken, `/channels/stop`, {
    method: "POST",
    body: JSON.stringify({ id: channelId, resourceId }),
  });
  if (res.ok || res.status === 404) return;
  // Non-fatal — the channel will expire on its own anyway.
}
