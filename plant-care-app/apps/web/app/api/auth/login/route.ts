import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { comparePassword, hashPassword, signSessionToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    // 1. Buscar usuario por email
    const rows = await sql`
      SELECT id, email, password_hash, display_name, notifications_enabled, reminder_time, fcm_token, created_at
      FROM users
      WHERE email = ${email.toLowerCase().trim()}
      LIMIT 1
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas. Revisa tus datos e inténtalo de nuevo.' },
        { status: 401 }
      );
    }

    const userRow = rows[0] as {
      id: string;
      email: string;
      password_hash: string | null;
      display_name: string;
      notifications_enabled: boolean;
      reminder_time: string;
      fcm_token: string | null;
      created_at: string;
    };

    // 2. Si la cuenta fue migrada de Supabase y no tenía password_hash, la inicializamos con la contraseña introducida
    if (!userRow.password_hash) {
      const newHash = await hashPassword(password);
      await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userRow.id}`;
    } else {
      // 3. Verificar contraseña contra el hash de Neon
      const isValid = await comparePassword(password, userRow.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Credenciales incorrectas. Revisa tus datos e inténtalo de nuevo.' },
          { status: 401 }
        );
      }
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.display_name,
      notificationsEnabled: userRow.notifications_enabled,
      reminderTime: userRow.reminder_time,
      fcmToken: userRow.fcm_token || undefined,
      createdAt: userRow.created_at,
    };

    // 4. Firmar token JWT y fijar cookie
    const token = await signSessionToken({ id: user.id, email: user.email });

    const response = NextResponse.json({ user, token }, { status: 200 });

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
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
}
