import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
      SELECT id, plant_id, image_url, general_status, detected_problems, recommendations, created_at
      FROM analysis_reports
      WHERE plant_id = ${plantId}
      ORDER BY created_at DESC
    `;

    const reports = rows.map((r) => ({
      id: r.id,
      plantId: r.plant_id,
      imageUrl: r.image_url,
      generalStatus: r.general_status,
      detectedProblems: r.detected_problems || [],
      recommendations: r.recommendations || [],
      createdAt: r.created_at,
    }));

    return NextResponse.json({ reports }, { status: 200 });
  } catch (error) {
    console.error('Error al obtener analysis_reports:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener reportes' },
      { status: 500 }
    );
  }
}
