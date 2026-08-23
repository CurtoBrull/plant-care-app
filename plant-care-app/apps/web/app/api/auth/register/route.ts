import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, signSessionToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    // 1. Comprobar si el usuario ya existe
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'El correo electrónico ya está en uso. Prueba a iniciar sesión.' },
        { status: 409 }
      );
    }

    // 2. Hashear contraseña
    const passwordHash = await hashPassword(password);
    const name = displayName || email.split('@')[0];

    // 3. Insertar usuario en Neon
    const rows = await sql`
      INSERT INTO users (email, password_hash, display_name, notifications_enabled, reminder_time, created_at)
      VALUES (${email.toLowerCase().trim()}, ${passwordHash}, ${name}, true, '08:00:00', now())
      RETURNING id, email, display_name, notifications_enabled, reminder_time, created_at
    `;

    const userRow = rows[0] as {
      id: string;
      email: string;
      display_name: string;
      notifications_enabled: boolean;
      reminder_time: string;
      created_at: string;
    };

    const user = {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.display_name,
      notificationsEnabled: userRow.notifications_enabled,
      reminderTime: userRow.reminder_time,
      createdAt: userRow.created_at,
    };

    // 4. Firmar token JWT y fijar cookie
    const token = await signSessionToken({ id: user.id, email: user.email });

    const response = NextResponse.json({ user, token }, { status: 201 });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 días
    });

    return response;
  } catch (error) {
    console.error('Error en register:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar usuario' },
      { status: 500 }
    );
  }
}
