import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const plantId = formData.get('plantId') as string | null;
    const capturedAt = (formData.get('capturedAt') as string | null) || new Date().toISOString();

    if (!file || !plantId) {
      return NextResponse.json(
        { error: 'Se requieren file y plantId' },
        { status: 400 }
      );
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json(
        { error: 'DATABASE_URL no está configurada' },
        { status: 500 }
      );
    }

    // 1. Subir archivo a Vercel Blob
    const ext = file.name ? file.name.split('.').pop() || 'jpg' : 'jpg';
    const filename = `plants/${plantId}/${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
    });

    const now = new Date().toISOString();

    // 2. Guardar metadatos en la tabla photos de Neon PostgreSQL
    const rows = await sql`
      INSERT INTO photos (plant_id, url, storage_path, captured_at, uploaded_at)
      VALUES (${plantId}, ${blob.url}, ${blob.pathname || filename}, ${capturedAt}, ${now})
      RETURNING id, plant_id, url, storage_path, captured_at, uploaded_at
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      throw new Error('No se pudo guardar la foto en la base de datos');
    }

    const row = rows[0] as {
      id: string;
      plant_id: string;
      url: string;
      storage_path: string;
      captured_at: string;
      uploaded_at: string;
    };

    const photo = {
      id: row.id,
      plantId: row.plant_id,
      url: row.url,
      storagePath: row.storage_path,
      capturedAt: row.captured_at,
      uploadedAt: row.uploaded_at,
    };

    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    console.error('Error al subir foto a Vercel Blob / Neon:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al subir la foto' },
      { status: 500 }
    );
  }
}
