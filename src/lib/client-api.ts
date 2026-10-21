/** fetch wrapper for the local API: returns JSON or throws an Error with the server's Spanish message. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
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
    throw new ApiError("No se pudo conectar con el servidor local. ¿Está corriendo «npm run dev»?", 0);
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
