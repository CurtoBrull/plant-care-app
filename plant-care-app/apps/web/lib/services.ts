/**
 * Singletons de servicios del core.
 * Solo importar desde componentes 'use client'.
 */
import {
  AuthService,
  PlantService,
  PhotoService,
  CareService,
  ProblemService,
  NotificationService,
  AIService,
  OfflineSyncService,
} from '@plant-care/core'

let auth:    AuthService         | null = null
let plant:   PlantService        | null = null
let photo:   PhotoService        | null = null
let care:    CareService         | null = null
let problem: ProblemService      | null = null
let notif:   NotificationService | null = null
let ai:      AIService           | null = null
let offline: OfflineSyncService  | null = null

export function getAuthService()         { return (auth    ??= new AuthService()) }
export function getPlantService()        { return (plant   ??= new PlantService()) }
export function getPhotoService()        { return (photo   ??= new PhotoService()) }
export function getCareService()         { return (care    ??= new CareService()) }
export function getProblemService()      { return (problem ??= new ProblemService()) }
export function getNotificationService() { return (notif   ??= new NotificationService()) }
export function getAIService()           { return (ai      ??= new AIService()) }
export function getOfflineSyncService()  { return (offline ??= new OfflineSyncService()) }
