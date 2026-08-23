import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/photos?plantId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plantId');

    if (!plantId) {
      return NextResponse.json({ error: 'plantId es requerido' }, { status: 400 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const rows = await sql`
      SELECT id, plant_id, url, storage_path, captured_at, uploaded_at
      FROM photos
      WHERE plant_id = ${plantId}
      ORDER BY captured_at DESC
    `;

    const photos = rows.map((row) => ({
      id: row.id,
      plantId: row.plant_id,
      url: row.url,
      storagePath: row.storage_path,
      capturedAt: row.captured_at,
      uploadedAt: row.uploaded_at,
    }));

    return NextResponse.json({ photos }, { status: 200 });
  } catch (error) {
    console.error('Error al obtener fotos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener fotos' },
      { status: 500 }
    );
  }
}
