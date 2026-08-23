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

// GET /api/problems?plantId=...
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
      SELECT id, plant_id, type, description, detected_at, image_url, resolved, resolved_at
      FROM problems
      WHERE plant_id = ${plantId}
      ORDER BY detected_at DESC
    `;

    const problems = rows.map(rowToProblem);
    return NextResponse.json({ problems }, { status: 200 });
  } catch (error) {
    console.error('Error al obtener problemas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener problemas' },
      { status: 500 }
    );
  }
}

// POST /api/problems
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plantId, type, description, detectedAt, imageUrl } = body;

    if (!plantId || !type?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'plantId, tipo y descripción son obligatorios' },
        { status: 400 }
      );
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const timestamp = detectedAt || new Date().toISOString();

    const rows = await sql`
      INSERT INTO problems (plant_id, type, description, detected_at, image_url, resolved, resolved_at)
      VALUES (${plantId}, ${type.trim()}, ${description.trim()}, ${timestamp}, ${imageUrl || null}, false, null)
      RETURNING id, plant_id, type, description, detected_at, image_url, resolved, resolved_at
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      throw new Error('No se pudo guardar el problema');
    }

    const problem = rowToProblem(rows[0]);
    return NextResponse.json({ problem }, { status: 201 });
  } catch (error) {
    console.error('Error al crear problema:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear problema' },
      { status: 500 }
    );
  }
}
