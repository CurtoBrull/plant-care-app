import { useEffect, useState } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import type { Photo, Plant } from '@plant-care/core'
import { getPhotoService } from '../lib/services'

interface Props {
  plant:      Plant
  onUpdated:  (plant: Plant) => void
}

export default function PhotoSection({ plant, onUpdated }: Props) {
  const [photos,    setPhotos]    = useState<Photo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    void getPhotoService().getPhotos(plant.id)
      .then(setPhotos)
      .finally(() => setLoading(false))
  }, [plant.id])

  async function pickAndUpload(useCamera: boolean) {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (perm.status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso para continuar.')
      return
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true })

    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const uri  = result.assets[0].uri
      const blob = await fetch(uri).then((r) => r.blob())
      const photo = await getPhotoService().uploadPhoto(plant.id, blob, new Date().toISOString())
      setPhotos((prev) => [photo, ...prev])
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto')
    } finally {
      setUploading(false)
    }
  }

  async function setRepresentative(photoId: string) {
    try {
      await getPhotoService().setRepresentativePhoto(plant.id, photoId)
      // Reload plant to reflect new representativePhotoUrl
      const updated = { ...plant, representativePhotoUrl: photos.find(p => p.id === photoId)?.url }
      onUpdated(updated as Plant)
      Alert.alert('Listo', 'Foto representativa actualizada')
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la foto representativa')
    }
  }

  async function deletePhoto(photo: Photo) {
    Alert.alert('Eliminar foto', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await getPhotoService().deletePhoto(photo.id)
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
          } catch {
            Alert.alert('Error', 'No se pudo eliminar la foto')
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.btnDisabled]}
          onPress={() => void pickAndUpload(true)}
          disabled={uploading}
        >
          <Text style={styles.uploadBtnText}>📷 Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.btnDisabled]}
          onPress={() => void pickAndUpload(false)}
          disabled={uploading}
        >
          <Text style={styles.uploadBtnText}>🖼 Galería</Text>
        </TouchableOpacity>
      </View>

      {uploading && <ActivityIndicator color="#16a34a" style={{ marginBottom: 12 }} />}

      {loading
        ? <ActivityIndicator color="#16a34a" style={{ marginTop: 32 }} />
        : photos.length === 0
          ? <Text style={styles.empty}>Sin fotos todavía.</Text>
          : (
            <FlatList
              data={photos}
              keyExtractor={(p) => p.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ gap: 8 }}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: item.url }} style={styles.photo} />
                  {plant.representativePhotoUrl === item.url && (
                    <Text style={styles.repBadge}>⭐ Representativa</Text>
                  )}
                  <View style={styles.photoActions}>
                    {plant.representativePhotoUrl !== item.url && (
                      <TouchableOpacity
                        style={styles.photoBtn}
                        onPress={() => void setRepresentative(item.id)}
                      >
                        <Text style={styles.photoBtnText}>⭐</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.photoBtn, { backgroundColor: '#fee2e2' }]}
                      onPress={() => void deletePhoto(item)}
                    >
                      <Text style={styles.photoBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { padding: 16 },
  btnRow:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  uploadBtn:    { flex: 1, backgroundColor: '#16a34a', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDisabled:  { opacity: 0.6 },
  uploadBtnText:{ color: '#fff', fontWeight: '600', fontSize: 14 },
  empty:        { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
  photoWrap:    { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  photo:        { width: '100%', aspectRatio: 1 },
  repBadge:     { position: 'absolute', top: 4, left: 4, backgroundColor: '#fefce8', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11 } as never,
  photoActions: { flexDirection: 'row', gap: 4, padding: 6, backgroundColor: 'rgba(0,0,0,0.04)' },
  photoBtn:     { backgroundColor: '#f0fdf4', borderRadius: 6, padding: 6 },
  photoBtnText: { fontSize: 14 },
})
