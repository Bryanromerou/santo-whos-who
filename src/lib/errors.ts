/** Error with a user-facing Spanish message and an HTTP status. */
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) => new AppError(`${what} no existe o fue eliminado.`, 404);

/** Converts any thrown value into a JSON error response with a Spanish message. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.message, details: err.details ?? null }, { status: err.status });
  }
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  return Response.json({ error: `Error inesperado del servidor: ${msg}` }, { status: 500 });
}
