import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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

// GET /api/plants/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: plantId } = await params;
    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const rows = await sql`SELECT * FROM plants WHERE id = ${plantId} LIMIT 1`;
    if (!rows || rows.length === 0 || !rows[0]) {
      return NextResponse.json({ error: `Planta ${plantId} no encontrada.` }, { status: 404 });
    }

    const plant = rowToPlant(rows[0]);
    return NextResponse.json({ plant }, { status: 200 });
  } catch (error) {
    console.error('Error al obtener planta:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener planta' },
      { status: 500 }
    );
  }
}

// PUT /api/plants/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: plantId } = await params;
    const body = await request.json();
    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    const existingRows = await sql`SELECT * FROM plants WHERE id = ${plantId} LIMIT 1`;
    if (!existingRows || existingRows.length === 0 || !existingRows[0]) {
      return NextResponse.json({ error: `Planta ${plantId} no encontrada.` }, { status: 404 });
    }

    const current = existingRows[0];

    const commonName = body.commonName !== undefined ? body.commonName : current.common_name;
    const species = body.species !== undefined ? body.species : current.species;
    const scientificName = body.scientificName !== undefined ? body.scientificName : current.scientific_name;
    const acquisitionDate = body.acquisitionDate !== undefined ? body.acquisitionDate : current.acquisition_date;
    const plantType = body.plantType !== undefined ? body.plantType : current.plant_type;
    const location = body.location !== undefined ? body.location : current.location;
    const notes = body.notes !== undefined ? body.notes : current.notes;
    const representativePhotoUrl = body.representativePhotoUrl !== undefined ? body.representativePhotoUrl : current.representative_photo_url;

    const wateringDays = body.careSchedule?.watering?.frequencyDays ?? current.watering_frequency_days;
    const fertilizingDays = body.careSchedule?.fertilizing?.frequencyDays ?? current.fertilizing_frequency_days;
    const fertilizerType = body.careSchedule?.fertilizing?.fertilizerType !== undefined ? body.careSchedule?.fertilizing?.fertilizerType : current.fertilizer_type;
    const lightNeeds = body.careSchedule?.lightNeeds ?? current.light_needs;
    const minC = body.careSchedule?.temperature?.minC ?? current.temperature_min_c;
    const maxC = body.careSchedule?.temperature?.maxC ?? current.temperature_max_c;
    const pruningMonths = body.careSchedule?.pruning?.frequencyMonths ?? current.pruning_frequency_months;
    const repottingMonths = body.careSchedule?.repotting?.frequencyMonths ?? current.repotting_frequency_months;

    const nextWatering = body.nextCareDates?.watering !== undefined ? body.nextCareDates.watering : current.next_watering_date;
    const nextFertilizing = body.nextCareDates?.fertilizing !== undefined ? body.nextCareDates.fertilizing : current.next_fertilizing_date;
    const nextPruning = body.nextCareDates?.pruning !== undefined ? body.nextCareDates.pruning : current.next_pruning_date;
    const nextRepotting = body.nextCareDates?.repotting !== undefined ? body.nextCareDates.repotting : current.next_repotting_date;

    const updatedRows = await sql`
      UPDATE plants SET
        common_name = ${commonName},
        species = ${species},
        scientific_name = ${scientificName || null},
        acquisition_date = ${acquisitionDate || null},
        plant_type = ${plantType},
        location = ${location},
        notes = ${notes || null},
        representative_photo_url = ${representativePhotoUrl || null},
        watering_frequency_days = ${wateringDays},
        fertilizing_frequency_days = ${fertilizingDays},
        fertilizer_type = ${fertilizerType || null},
        light_needs = ${lightNeeds},
        temperature_min_c = ${minC},
        temperature_max_c = ${maxC},
        pruning_frequency_months = ${pruningMonths},
        repotting_frequency_months = ${repottingMonths},
        next_watering_date = ${nextWatering || null},
        next_fertilizing_date = ${nextFertilizing || null},
        next_pruning_date = ${nextPruning || null},
        next_repotting_date = ${nextRepotting || null},
        updated_at = now()
      WHERE id = ${plantId}
      RETURNING *
    `;

    if (!updatedRows || updatedRows.length === 0 || !updatedRows[0]) {
      throw new Error('No se pudo actualizar la planta');
    }

    const plant = rowToPlant(updatedRows[0]);
    return NextResponse.json({ plant }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar planta:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar planta' },
      { status: 500 }
    );
  }
}

// DELETE /api/plants/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: plantId } = await params;
    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
    }

    await sql`DELETE FROM plants WHERE id = ${plantId}`;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar planta:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar planta' },
      { status: 500 }
    );
  }
}
