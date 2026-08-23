import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/users/settings?userId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');

    if (!userId) {
      const session = await getSessionUser(request);
      if (session) userId = session.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const rows = await sql`
      SELECT notifications_enabled, reminder_time, fcm_token
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const row = rows[0];
    return NextResponse.json({
      notificationsEnabled: row.notifications_enabled,
      reminderTime: row.reminder_time,
      fcmToken: row.fcm_token,
    }, { status: 200 });
  } catch (error) {
    console.error('Error al obtener ajustes de usuario:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener ajustes' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/settings
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    let userId = body.userId;

    if (!userId) {
      const session = await getSessionUser(request);
      if (session) userId = session.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const { notificationsEnabled, reminderTime, fcmToken } = body;

    if (notificationsEnabled !== undefined) {
      await sql`UPDATE users SET notifications_enabled = ${notificationsEnabled} WHERE id = ${userId}`;
    }

    if (reminderTime !== undefined) {
      await sql`UPDATE users SET reminder_time = ${reminderTime} WHERE id = ${userId}`;
    }

    if (fcmToken !== undefined) {
      await sql`UPDATE users SET fcm_token = ${fcmToken} WHERE id = ${userId}`;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar ajustes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar ajustes' },
      { status: 500 }
    );
  }
}
