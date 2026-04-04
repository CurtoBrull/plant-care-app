/**
 * Singletons de servicios del core con el cliente Supabase del navegador.
 * Solo importar desde componentes 'use client'.
 */
import { getSupabaseBrowser } from './supabase-browser'
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

function client() {
  return getSupabaseBrowser()
}

// Constructores: AuthService, PlantService, PhotoService, CareService,
// ProblemService, NotificationService reciben client?: SupabaseClient directamente.
// AIService y OfflineSyncService reciben options?: { client?, ... }.
let auth:    AuthService         | null = null
let plant:   PlantService        | null = null
let photo:   PhotoService        | null = null
let care:    CareService         | null = null
let problem: ProblemService      | null = null
let notif:   NotificationService | null = null
let ai:      AIService           | null = null
let offline: OfflineSyncService  | null = null

export function getAuthService()         { return (auth    ??= new AuthService(client())) }
export function getPlantService()        { return (plant   ??= new PlantService(client())) }
export function getPhotoService()        { return (photo   ??= new PhotoService(client())) }
export function getCareService()         { return (care    ??= new CareService(client())) }
export function getProblemService()      { return (problem ??= new ProblemService(client())) }
export function getNotificationService() { return (notif   ??= new NotificationService(client())) }
export function getAIService()           { return (ai      ??= new AIService({ client: client() })) }
export function getOfflineSyncService()  { return (offline ??= new OfflineSyncService({ client: client() })) }
