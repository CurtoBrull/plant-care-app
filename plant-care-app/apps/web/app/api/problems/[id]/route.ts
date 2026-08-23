import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function rowToProblem(r: any) {
  return {
    id: r.id,
    plantId: r.plant_id,
    type: r.type,
    description: r.description,
    detectedAt: r.detected_at,
    imageUrl: r.image_url || undefined,
    resolved: r.resolved,
    resolvedAt: r.resolved_at || undefined,
  };
}

// PATCH /api/problems/[id] - Marcar como resuelto
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: problemId } = await params;
    const body = await request.json().catch(() => ({}));
    const timestamp = body.resolvedAt || new Date().toISOString();

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const rows = await sql`
      UPDATE problems
      SET resolved = true, resolved_at = ${timestamp}
      WHERE id = ${problemId}
      RETURNING id, plant_id, type, description, detected_at, image_url, resolved, resolved_at
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.json({ error: `Problema ${problemId} no encontrado.` }, { status: 404 });
    }

    const problem = rowToProblem(rows[0]);
    return NextResponse.json({ problem }, { status: 200 });
  } catch (error) {
    console.error('Error al resolver problema:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al resolver problema' },
      { status: 500 }
    );
  }
}

// DELETE /api/problems/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: problemId } = await params;
    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    await sql`DELETE FROM problems WHERE id = ${problemId}`;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar problema:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar problema' },
      { status: 500 }
    );
  }
}
