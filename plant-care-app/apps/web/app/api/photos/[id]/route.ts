import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/photos/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params;
    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    // 1. Obtener la URL de la foto antes de borrar
    const rows = await sql`
      SELECT id, url, storage_path FROM photos WHERE id = ${photoId} LIMIT 1
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 });
    }

    const photo = rows[0] as { id: string; url: string; storage_path: string };

    // 2. Si es una URL de Vercel Blob, eliminarla de Blob Storage
    if (photo.url && photo.url.includes('blob.vercel-storage.com')) {
      try {
        await del(photo.url);
      } catch (err) {
        console.warn('Aviso al borrar de Vercel Blob:', err);
      }
    }

    // 3. Eliminar de la base de datos Neon
    await sql`
      DELETE FROM photos WHERE id = ${photoId}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar foto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar foto' },
      { status: 500 }
    );
  }
}

// PATCH /api/photos/[id] - Marcar como representativa
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params;
    const body = await request.json();
    const plantId = body.plantId;

    if (!plantId) {
      return NextResponse.json({ error: 'plantId es requerido' }, { status: 400 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const rows = await sql`
      SELECT url FROM photos WHERE id = ${photoId} LIMIT 1
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 });
    }

    const photoUrl = (rows[0] as { url: string }).url;

    await sql`
      UPDATE plants SET representative_photo_url = ${photoUrl} WHERE id = ${plantId}
    `;

    return NextResponse.json({ success: true, representativePhotoUrl: photoUrl }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar foto representativa:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar foto representativa' },
      { status: 500 }
    );
  }
}
