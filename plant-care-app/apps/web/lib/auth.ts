import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'plant-care-default-secret-change-in-prod-2026';
const secretKey = new TextEncoder().encode(JWT_SECRET);
export const COOKIE_NAME = 'plant_care_session';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(payload: { id: string; email: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<{ id: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return {
      id: payload.id as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  // 1. Intentar leer de cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    const user = await verifySessionToken(token);
    if (user) return user;
  }

  // 2. Intentar leer de cabecera Authorization (para app móvil)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7);
    return verifySessionToken(bearerToken);
  }

  return null;
}
