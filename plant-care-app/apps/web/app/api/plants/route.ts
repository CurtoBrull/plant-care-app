import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function rowToPlant(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    commonName: row.common_name,
    species: row.species,
    scientificName: row.scientific_name || undefined,
    acquisitionDate: row.acquisition_date || undefined,
    plantType: row.plant_type || 'otra',
    location: row.location || 'interior',
    notes: row.notes || undefined,
    representativePhotoUrl: row.representative_photo_url || undefined,
    careSchedule: {
      watering: { frequencyDays: row.watering_frequency_days || 7 },
      fertilizing: {
        frequencyDays: row.fertilizing_frequency_days || 30,
        fertilizerType: row.fertilizer_type || undefined,
      },
      pruning: { frequencyMonths: row.pruning_frequency_months || 6 },
      repotting: { frequencyMonths: row.repotting_frequency_months || 12 },
      lightNeeds: row.light_needs || 'indirecta',
      temperature: {
        minC: row.temperature_min_c ?? 10,
        maxC: row.temperature_max_c ?? 25,
      },
    },
    nextCareDates: {
      watering: row.next_watering_date || undefined,
      fertilizing: row.next_fertilizing_date || undefined,
      pruning: row.next_pruning_date || undefined,
      repotting: row.next_repotting_date || undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/plants?userId=...&search=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');
    const search = searchParams.get('search')?.trim();

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

    let rows;
    if (search) {
      const queryPattern = `%${search}%`;
      rows = await sql`
        SELECT * FROM plants
        WHERE user_id = ${userId}
          AND (common_name ILIKE ${queryPattern} OR species ILIKE ${queryPattern})
        ORDER BY created_at DESC
      `;
    } else {
      rows = await sql`
        SELECT * FROM plants
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
    }

    const plants = rows.map(rowToPlant);
    return NextResponse.json({ plants }, { status: 200 });
  } catch (error) {
    console.error('Error al listar plantas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar plantas' },
      { status: 500 }
    );
  }
}

// POST /api/plants
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let userId = body.userId;

    if (!userId) {
      const session = await getSessionUser(request);
      if (session) userId = session.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Usuario no autenticado o userId requerido' }, { status: 401 });
    }

    const {
      commonName,
      species,
      scientificName,
      acquisitionDate,
      plantType,
      location,
      notes,
      representativePhotoUrl,
      careSchedule,
    } = body;

    if (!commonName?.trim()) {
      return NextResponse.json({ error: 'El nombre común es obligatorio.' }, { status: 400 });
    }
    if (!species?.trim()) {
      return NextResponse.json({ error: 'La especie es obligatoria.' }, { status: 400 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const rows = await sql`
      INSERT INTO plants (
        user_id,
        common_name,
        species,
        scientific_name,
        acquisition_date,
        plant_type,
        location,
        notes,
        representative_photo_url,
        watering_frequency_days,
        fertilizing_frequency_days,
        fertilizer_type,
        light_needs,
        temperature_min_c,
        temperature_max_c,
        pruning_frequency_months,
        repotting_frequency_months,
        created_at,
        updated_at
      ) VALUES (
        ${userId},
        ${commonName.trim()},
        ${species.trim()},
        ${scientificName || null},
        ${acquisitionDate || null},
        ${plantType || 'otra'},
        ${location || 'interior'},
        ${notes || null},
        ${representativePhotoUrl || null},
        ${careSchedule?.watering?.frequencyDays || 7},
        ${careSchedule?.fertilizing?.frequencyDays || 30},
        ${careSchedule?.fertilizing?.fertilizerType || null},
        ${careSchedule?.lightNeeds || 'indirecta'},
        ${careSchedule?.temperature?.minC ?? 10},
        ${careSchedule?.temperature?.maxC ?? 25},
        ${careSchedule?.pruning?.frequencyMonths || 6},
        ${careSchedule?.repotting?.frequencyMonths || 12},
        now(),
        now()
      )
      RETURNING *
    `;

    if (!rows || rows.length === 0 || !rows[0]) {
      throw new Error('No se pudo crear la planta');
    }

    const plant = rowToPlant(rows[0]);
    return NextResponse.json({ plant }, { status: 201 });
  } catch (error) {
    console.error('Error al crear planta:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear planta' },
      { status: 500 }
    );
  }
}
