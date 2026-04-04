# Guía de desarrollo local

## Requisitos previos

- Node.js instalado
- pnpm instalado (`npm install -g pnpm`)
- Expo Go instalado en el móvil (para la versión mobile)

---

## Versión Web (Next.js)

### Arrancar

```bash
cd apps/web
pnpm dev
```

La app estará disponible en **http://localhost:3000**

### Detener

Pulsa `Ctrl + C` en la terminal donde se está ejecutando.

---

## Versión Mobile (Expo)

### Arrancar en el navegador (modo web)

```bash
cd apps/mobile
npx expo start --web --port 8081
```

La app estará disponible en **http://localhost:8081**

### Arrancar para móvil con Expo Go

```bash
cd apps/mobile
npx expo start
```

1. Instala **Expo Go** en tu móvil (App Store / Google Play)
2. Abre Expo Go y escanea el QR que aparece en la terminal
3. El móvil y el PC deben estar en la **misma red WiFi**

### Arrancar con túnel (móvil fuera de la red local)

```bash
cd apps/mobile
npx expo start --tunnel
```

Permite acceder desde cualquier red, no solo la local.

### Detener

Pulsa `Ctrl + C` en la terminal donde se está ejecutando.

---

## Arrancar ambas versiones a la vez

Abre **dos terminales**:

**Terminal 1 — Web:**
```bash
cd apps/web
pnpm dev
```

**Terminal 2 — Mobile:**
```bash
cd apps/mobile
npx expo start --web --port 8081
```

---

## Variables de entorno

### Web (`apps/web/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Mobile (`apps/mobile/.env`)

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

> En Android Emulator usa `http://10.0.2.2:3000` en vez de `localhost`.  
> En dispositivo físico usa la IP local de tu máquina: `http://192.168.1.X:3000`

---

## Puertos por defecto

| Servicio     | Puerto |
|--------------|--------|
| Web (Next.js)| 3000   |
| Mobile (Expo)| 8081   |

---

## Solución de problemas

### Puerto ya en uso

```bash
# Ver qué proceso usa el puerto (ej. 3000)
netstat -ano | findstr :3000

# Matar el proceso por PID
powershell -Command "Stop-Process -Id <PID> -Force"
```

### Metro Bundler con caché corrupta

```bash
cd apps/mobile
npx expo start --clear
```
