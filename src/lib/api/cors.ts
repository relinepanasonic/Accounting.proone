import { NextResponse } from 'next/server';

const ALLOWED_ORIGIN = process.env.NODE_ENV === 'development' ? '*' : 'https://app.newwave.id';

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Validates the Authorization Bearer token against the NEWWAVE_INTEGRATION_TOKEN env variable.
 * Returns true if valid, false otherwise.
 */
export function authenticateApiRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  const validToken = process.env.NEWWAVE_INTEGRATION_TOKEN;

  if (!validToken || token !== validToken) {
    return false;
  }

  return true;
}

/**
 * Handles CORS OPTIONS requests automatically.
 */
export function handleOptions() {
  return NextResponse.json({}, { headers: corsHeaders });
}
