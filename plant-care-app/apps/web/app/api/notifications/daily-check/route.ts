import { createClient } from '@supabase/supabase-js'
import { getDuePlants } from '@plant-care/core'
import { rowToPlant, type PlantRow } from '@plant-care/core'

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface UserRow {
  id: string
  fcm_token: string | null
  notifications_enabled: boolean
}

interface FcmSendResult {
  plantId: string
  userId: string
  status: 'sent' | 'skipped' | 'error'
  reason?: string
}

// ---------------------------------------------------------------------------
// POST /api/notifications/daily-check
// Triggered by Vercel Cron Job daily at 08:00 (schedule: "0 8 * * *")
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  // 1. Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Build a service-role Supabase client (bypasses RLS to read all users' plants)
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: 'Missing Supabase environment variables' },
      { status: 500 },
    )
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 3. Query all plants with their nextCareDates
  const { data: plantRows, error: plantsError } = await db
    .from('plants')
    .select(
      'id, user_id, common_name, species, scientific_name, acquisition_date, location, notes, representative_photo_url, ' +
      'watering_frequency_days, fertilizing_frequency_days, fertilizer_type, light_needs, ' +
      'temperature_min_c, temperature_max_c, pruning_frequency_months, repotting_frequency_months, ' +
      'next_watering_date, next_fertilizing_date, next_pruning_date, next_repotting_date, ' +
      'created_at, updated_at',
    )

  if (plantsError) {
    return Response.json({ error: plantsError.message }, { status: 500 })
  }

  const plants = (plantRows as unknown as PlantRow[]).map(rowToPlant)

  // 4. Filter plants with due tasks (nextCareDate <= today)
  const today = new Date()
  const duePlants = getDuePlants(today, plants)

  if (duePlants.length === 0) {
    return Response.json({ sent: 0, skipped: 0, results: [] })
  }

  // 5. Fetch user settings (fcm_token + notifications_enabled) for affected users
  const userIds = [...new Set(duePlants.map((p) => p.userId))]

  const { data: userRows, error: usersError } = await db
    .from('users')
    .select('id, fcm_token, notifications_enabled')
    .in('id', userIds)

  if (usersError) {
    return Response.json({ error: usersError.message }, { status: 500 })
  }

  const userMap = new Map<string, UserRow>(
    (userRows as UserRow[]).map((u) => [u.id, u]),
  )

  // 6. Send FCM push notification for each due plant
  const fcmServerKey = process.env['FCM_SERVER_KEY']
  const results: FcmSendResult[] = []

  for (const plant of duePlants) {
    const user = userMap.get(plant.userId)

    if (!user) {
      results.push({ plantId: plant.id, userId: plant.userId, status: 'skipped', reason: 'user not found' })
      continue
    }

    if (!user.notifications_enabled) {
      results.push({ plantId: plant.id, userId: plant.userId, status: 'skipped', reason: 'notifications disabled' })
      continue
    }

    if (!user.fcm_token) {
      results.push({ plantId: plant.id, userId: plant.userId, status: 'skipped', reason: 'no fcm_token' })
      continue
    }

    if (!fcmServerKey) {
      results.push({ plantId: plant.id, userId: plant.userId, status: 'skipped', reason: 'FCM_SERVER_KEY not configured' })
      continue
    }

    // Determine which tasks are due
    const todayStr = today.toISOString().slice(0, 10)
    const dueTasks: string[] = []
    const { watering, fertilizing, pruning, repotting } = plant.nextCareDates
    if (watering && watering <= todayStr) dueTasks.push('riego')
    if (fertilizing && fertilizing <= todayStr) dueTasks.push('abono')
    if (pruning && pruning <= todayStr) dueTasks.push('poda')
    if (repotting && repotting <= todayStr) dueTasks.push('trasplante')

    const body = `${plant.commonName} necesita: ${dueTasks.join(', ')}`

    try {
      const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: user.fcm_token,
          notification: {
            title: 'Recordatorio de cuidado de planta',
            body,
          },
          data: {
            plantId: plant.id,
          },
        }),
      })

      if (fcmResponse.ok) {
        results.push({ plantId: plant.id, userId: plant.userId, status: 'sent' })
      } else {
        const errText = await fcmResponse.text()
        results.push({ plantId: plant.id, userId: plant.userId, status: 'error', reason: errText })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ plantId: plant.id, userId: plant.userId, status: 'error', reason: message })
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.filter((r) => r.status === 'error').length

  return Response.json({ sent, skipped, errors, results })
}
