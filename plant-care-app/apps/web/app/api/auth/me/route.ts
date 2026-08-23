import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);

    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const rows = await sql`
      SELECT id, email, display_name, notifications_enabled, reminder_time, fcm_token, created_at
      FROM users
      WHERE id = ${session.id}
      LIMIT 1
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const userRow = rows[0] as {
      id: string;
      email: string;
      display_name: string;
      notifications_enabled: boolean;
      reminder_time: string;
      fcm_token: string | null;
      created_at: string;
    };

    const user = {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.display_name,
      notificationsEnabled: userRow.notifications_enabled,
      reminderTime: userRow.reminder_time,
      fcmToken: userRow.fcm_token || undefined,
      createdAt: userRow.created_at,
    };

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Error en /api/auth/me:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
