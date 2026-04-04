import type { Plant } from '../models/plant'
import type { Problem } from '../models/problem'

/**
 * Construye el bloque de contexto de una planta que se inyecta en los prompts
 * de Gemini (análisis visual y chat).
 * Propiedad 17: el contexto debe incluir datos básicos, cuidados y problemas activos.
 */
export function buildPlantContext(plant: Plant, activeProblems: Problem[] = []): string {
  const cs = plant.careSchedule
  const nd = plant.nextCareDates

  const lines: string[] = [
    `=== PERFIL DE PLANTA ===`,
    `Nombre común: ${plant.commonName}`,
    `Especie: ${plant.species}`,
    ...(plant.scientificName ? [`Nombre científico: ${plant.scientificName}`] : []),
    ...(plant.location ? [`Ubicación: ${plant.location}`] : []),
    ...(plant.notes ? [`Notas: ${plant.notes}`] : []),
  ]

  // Cuidados registrados
  const careLines: string[] = []
  if (cs.wateringFrequencyDays) careLines.push(`Riego: cada ${cs.wateringFrequencyDays} días`)
  if (cs.fertilizingFrequencyDays) careLines.push(`Abono: cada ${cs.fertilizingFrequencyDays} días (${cs.fertilizerType ?? 'tipo no especificado'})`)
  if (cs.lightNeeds) careLines.push(`Luz: ${cs.lightNeeds}`)
  if (cs.temperatureMinC != null && cs.temperatureMaxC != null) {
    careLines.push(`Temperatura: ${cs.temperatureMinC}°C – ${cs.temperatureMaxC}°C`)
  }
  if (cs.pruningFrequencyMonths) careLines.push(`Poda: cada ${cs.pruningFrequencyMonths} meses`)
  if (cs.repottingFrequencyMonths) careLines.push(`Trasplante: cada ${cs.repottingFrequencyMonths} meses`)

  if (careLines.length > 0) {
    lines.push('', '--- Cuidados ---', ...careLines)
  }

  // Próximas fechas
  const nextLines: string[] = []
  if (nd.watering) nextLines.push(`Próximo riego: ${nd.watering}`)
  if (nd.fertilizing) nextLines.push(`Próximo abono: ${nd.fertilizing}`)
  if (nd.pruning) nextLines.push(`Próxima poda: ${nd.pruning}`)
  if (nd.repotting) nextLines.push(`Próximo trasplante: ${nd.repotting}`)

  if (nextLines.length > 0) {
    lines.push('', '--- Próximas tareas ---', ...nextLines)
  }

  // Problemas activos
  const activeLines = activeProblems
    .filter((p) => !p.resolved)
    .map((p) => `• [${p.type}] ${p.description} (detectado: ${p.detectedAt.slice(0, 10)})`)

  if (activeLines.length > 0) {
    lines.push('', '--- Problemas activos ---', ...activeLines)
  }

  lines.push('=== FIN DEL PERFIL ===')
  return lines.join('\n')
}
