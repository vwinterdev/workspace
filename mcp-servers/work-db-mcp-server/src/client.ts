import { API_BASE_URL } from "./constants.js";

export class WorkDbApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export async function workDbRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new Error(
      `Could not reach work-db at ${API_BASE_URL}. Is it running? (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new WorkDbApiError(
      `work-db request to ${path} failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  return body as T;
}

export function handleWorkDbError(error: unknown): string {
  if (error instanceof WorkDbApiError) {
    if (error.status === 404) {
      return "Error: ticket not found. Check the id is correct.";
    }
    if (error.status === 400) {
      return `Error: invalid input. ${JSON.stringify(error.body)}`;
    }
    return `Error: work-db request failed with status ${error.status}. ${JSON.stringify(error.body)}`;
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
