import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

// GET /api/care?plantId=...
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
      SELECT id, plant_id, task_type, performed_at, notes
      FROM care_logs
      WHERE plant_id = ${plantId}
      ORDER BY performed_at DESC
    `;

    const careLogs = rows.map((r) => ({
      id: r.id,
      plantId: r.plant_id,
      taskType: r.task_type,
      performedAt: r.performed_at,
      notes: r.notes || undefined,
    }));

    return NextResponse.json({ careLogs }, { status: 200 });
  } catch (error) {
    console.error('Error al obtener historial de cuidados:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener historial de cuidados' },
      { status: 500 }
    );
  }
}

// POST /api/care (Registrar tarea de cuidado)
export async function POST(request: NextRequest) {
  try {
    const { plantId, taskType, performedAt, notes } = await request.json();

    if (!plantId || !taskType) {
      return NextResponse.json({ error: 'plantId y taskType son obligatorios' }, { status: 400 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const timestamp = performedAt || new Date().toISOString();
    const dateStr = timestamp.slice(0, 10);

    // 1. Insertar en care_logs
    const logRows = await sql`
      INSERT INTO care_logs (plant_id, task_type, performed_at, notes)
      VALUES (${plantId}, ${taskType}, ${timestamp}, ${notes || null})
      RETURNING id, plant_id, task_type, performed_at, notes
    `;

    if (!logRows || logRows.length === 0 || !logRows[0]) {
      throw new Error('No se pudo insertar el registro de cuidado');
    }

    const logRow = logRows[0] as {
      id: string;
      plant_id: string;
      task_type: string;
      performed_at: string;
      notes: string | null;
    };

    // 2. Obtener frecuencias de la planta para calcular próxima fecha
    const plantRows = await sql`
      SELECT watering_frequency_days, fertilizing_frequency_days, pruning_frequency_months, repotting_frequency_months
      FROM plants
      WHERE id = ${plantId}
      LIMIT 1
    `;

    if (plantRows && plantRows.length > 0 && plantRows[0]) {
      const p = plantRows[0] as {
        watering_frequency_days: number | null;
        fertilizing_frequency_days: number | null;
        pruning_frequency_months: number | null;
        repotting_frequency_months: number | null;
      };
      let nextDate: string | null = null;

      if (taskType === 'watering' && p.watering_frequency_days) {
        nextDate = addDays(dateStr, p.watering_frequency_days);
        await sql`UPDATE plants SET next_watering_date = ${nextDate} WHERE id = ${plantId}`;
      } else if (taskType === 'fertilizing' && p.fertilizing_frequency_days) {
        nextDate = addDays(dateStr, p.fertilizing_frequency_days);
        await sql`UPDATE plants SET next_fertilizing_date = ${nextDate} WHERE id = ${plantId}`;
      } else if (taskType === 'pruning' && p.pruning_frequency_months) {
        nextDate = addMonths(dateStr, p.pruning_frequency_months);
        await sql`UPDATE plants SET next_pruning_date = ${nextDate} WHERE id = ${plantId}`;
      } else if (taskType === 'repotting' && p.repotting_frequency_months) {
        nextDate = addMonths(dateStr, p.repotting_frequency_months);
        await sql`UPDATE plants SET next_repotting_date = ${nextDate} WHERE id = ${plantId}`;
      }
    }

    const careLog = {
      id: logRow.id,
      plantId: logRow.plant_id,
      taskType: logRow.task_type,
      performedAt: logRow.performed_at,
      notes: logRow.notes || undefined,
    };

    return NextResponse.json({ careLog }, { status: 201 });
  } catch (error) {
    console.error('Error al registrar cuidado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar cuidado' },
      { status: 500 }
    );
  }
}

// PATCH /api/care (Actualizar rutina de cuidados)
export async function PATCH(request: NextRequest) {
  try {
    const { plantId, careSchedule } = await request.json();

    if (!plantId || !careSchedule) {
      return NextResponse.json({ error: 'plantId y careSchedule son requeridos' }, { status: 400 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    await sql`
      UPDATE plants SET
        watering_frequency_days = ${careSchedule.watering?.frequencyDays || 7},
        fertilizing_frequency_days = ${careSchedule.fertilizing?.frequencyDays || 30},
        fertilizer_type = ${careSchedule.fertilizing?.fertilizerType || null},
        light_needs = ${careSchedule.lightNeeds || 'indirecta'},
        temperature_min_c = ${careSchedule.temperature?.minC ?? 10},
        temperature_max_c = ${careSchedule.temperature?.maxC ?? 25},
        pruning_frequency_months = ${careSchedule.pruning?.frequencyMonths || 6},
        repotting_frequency_months = ${careSchedule.repotting?.frequencyMonths || 12},
        updated_at = now()
      WHERE id = ${plantId}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar rutina:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar rutina' },
      { status: 500 }
    );
  }
}
