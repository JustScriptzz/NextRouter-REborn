export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function jsonOk(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return Response.json(data, { status, headers });
}

export function jsonError(status: number, message: string, type = 'error', headers?: Record<string, string>): Response {
  return Response.json({ error: { message, type } }, { status, headers });
}

export function jsonOkCors(data: unknown, status = 200): Response {
  return jsonOk(data, status, CORS_HEADERS);
}

export function jsonErrorCors(status: number, message: string, type = 'error'): Response {
  return jsonError(status, message, type, CORS_HEADERS);
}

export function handleCorsOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}