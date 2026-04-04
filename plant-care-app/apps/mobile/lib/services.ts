/**
 * Lazy-initialised service singletons for the mobile app.
 * Must import this module AFTER lib/supabase.ts has been imported
 * (the root _layout.tsx does this) so that setSupabaseClient() has
 * already been called before any service constructor fires.
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
  getSupabaseClient,
} from '@plant-care/core'
import { asyncStorageAdapter } from './asyncStorageAdapter'

// The API base URL must be absolute on native (no relative paths).
const apiBase = process.env.EXPO_PUBLIC_API_URL ?? ''

if (!apiBase) {
  console.warn('[mobile] EXPO_PUBLIC_API_URL is not set — AI features will not work.')
}

const client = () => getSupabaseClient()

let auth:    AuthService            | null = null
let plant:   PlantService           | null = null
let photo:   PhotoService           | null = null
let care:    CareService            | null = null
let problem: ProblemService         | null = null
let notif:   NotificationService    | null = null
let ai:      AIService              | null = null
let offline: OfflineSyncService     | null = null

export function getAuthService():             AuthService            { return (auth    ??= new AuthService(client())) }
export function getPlantService():            PlantService           { return (plant   ??= new PlantService(client())) }
export function getPhotoService():            PhotoService           { return (photo   ??= new PhotoService(client())) }
export function getCareService():             CareService            { return (care    ??= new CareService(client())) }
export function getProblemService():          ProblemService         { return (problem ??= new ProblemService(client())) }
export function getNotificationService():     NotificationService    { return (notif   ??= new NotificationService(client())) }
export function getAIService():               AIService              { return (ai      ??= new AIService({ client: client(), apiBase })) }
export function getOfflineSyncService():      OfflineSyncService     { return (offline ??= new OfflineSyncService({ client: client(), storage: asyncStorageAdapter })) }
