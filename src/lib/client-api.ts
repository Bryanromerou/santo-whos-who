/** fetch wrapper for the local API: returns JSON or throws an Error with the server's message (interface language). */
export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

// Set by <ClientMessages /> from messages/*.json (common.serverOffline) in the interface language.
const messages = { offline: "Couldn't connect to the local server. Is “npm run dev” running?" };
export function setClientApiMessages(m: typeof messages) {
  Object.assign(messages, m);
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(messages.offline, 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const d = data as { error?: string; details?: unknown } | null;
    throw new ApiError(d?.error || `Error ${res.status}`, res.status, d?.details);
  }
  return data as T;
}

/** Triggers a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function filenameFromResponse(res: Response, fallback: string): string {
  const cd = res.headers.get("content-disposition") || "";
  return /filename="([^"]+)"/.exec(cd)?.[1] ?? fallback;
}
