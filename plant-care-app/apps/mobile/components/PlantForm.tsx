import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import type { CreatePlantInput, LightNeeds, Plant, PlantLocation } from '@plant-care/core'

interface Props {
  initialValues?: Partial<Plant>
  onSubmit:   (input: CreatePlantInput) => Promise<void>
  onCancel?:  () => void
}

type SelectOption<T extends string> = { value: T | ''; label: string }

function SelectRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T | ''
  options: SelectOption<T>[]
  onChange: (v: T | '') => void
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, value === opt.value && styles.optionSelected]}
            onPress={() => onChange(opt.value as T | '')}
          >
            <Text style={[styles.optionText, value === opt.value && styles.optionTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

export default function PlantForm({ initialValues, onSubmit, onCancel }: Props) {
  const cs = initialValues?.careSchedule

  const [commonName,    setCommonName]    = useState(initialValues?.commonName     ?? '')
  const [species,       setSpecies]       = useState(initialValues?.species        ?? '')
  const [scientificName,setScientificName]= useState(initialValues?.scientificName ?? '')
  const [location,      setLocation]      = useState<PlantLocation | ''>(initialValues?.location ?? '')
  const [notes,         setNotes]         = useState(initialValues?.notes          ?? '')

  const [waterDays,    setWaterDays]    = useState(cs?.wateringFrequencyDays?.toString()    ?? '')
  const [fertilDays,   setFertilDays]   = useState(cs?.fertilizingFrequencyDays?.toString() ?? '')
  const [fertilizerType,setFertilizerType]=useState(cs?.fertilizerType ?? '')
  const [lightNeeds,   setLightNeeds]   = useState<LightNeeds | ''>(cs?.lightNeeds ?? '')
  const [tempMin,      setTempMin]      = useState(cs?.temperatureMinC?.toString()          ?? '')
  const [tempMax,      setTempMax]      = useState(cs?.temperatureMaxC?.toString()          ?? '')
  const [pruningMonths,setPruningMonths]= useState(cs?.pruningFrequencyMonths?.toString()   ?? '')
  const [repotMonths,  setRepotMonths]  = useState(cs?.repottingFrequencyMonths?.toString() ?? '')

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit() {
    if (!commonName.trim() || !species.trim()) {
      setError('El nombre común y la especie son obligatorios.')
      return
    }
    setError('')
    const input: CreatePlantInput = {
      commonName:     commonName.trim(),
      species:        species.trim(),
      scientificName: scientificName.trim() || undefined,
      location:       location || undefined,
      notes:          notes.trim() || undefined,
      careSchedule: {
        wateringFrequencyDays:    waterDays    ? Number(waterDays)    : undefined,
        fertilizingFrequencyDays: fertilDays   ? Number(fertilDays)   : undefined,
        fertilizerType:           fertilizerType.trim() || undefined,
        lightNeeds:               lightNeeds   || undefined,
        temperatureMinC:          tempMin      ? Number(tempMin)      : undefined,
        temperatureMaxC:          tempMax      ? Number(tempMax)      : undefined,
        pruningFrequencyMonths:   pruningMonths? Number(pruningMonths): undefined,
        repottingFrequencyMonths: repotMonths  ? Number(repotMonths)  : undefined,
      },
    }
    setSubmitting(true)
    try {
      await onSubmit(input)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  function field(
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { keyboardType?: 'numeric'; multiline?: boolean; placeholder?: string },
  ) {
    return (
      <View style={styles.formGroup}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, opts?.multiline && styles.textarea]}
          value={value}
          onChangeText={onChange}
          keyboardType={opts?.keyboardType}
          multiline={opts?.multiline}
          numberOfLines={opts?.multiline ? 3 : 1}
          textAlignVertical={opts?.multiline ? 'top' : undefined}
          placeholder={opts?.placeholder}
          placeholderTextColor="#94a3b8"
        />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>Datos básicos</Text>
      {field('Nombre común *',    commonName,     setCommonName,     { placeholder: 'Ej: Monstera' })}
      {field('Especie *',         species,        setSpecies,        { placeholder: 'Ej: Araceae' })}
      {field('Nombre científico', scientificName, setScientificName, { placeholder: 'Opcional' })}

      <SelectRow
        label="Ubicación"
        value={location}
        options={[
          { value: '',         label: 'Sin especificar' },
          { value: 'interior', label: '🏠 Interior' },
          { value: 'exterior', label: '☀️ Exterior' },
        ]}
        onChange={setLocation}
      />

      {field('Notas', notes, setNotes, { multiline: true, placeholder: 'Observaciones opcionales…' })}

      <Text style={styles.sectionTitle}>Programa de cuidados</Text>
      {field('Riego (cada N días)',         waterDays,    setWaterDays,    { keyboardType: 'numeric' })}
      {field('Fertilizado (cada N días)',   fertilDays,   setFertilDays,   { keyboardType: 'numeric' })}
      {field('Poda (cada N meses)',         pruningMonths,setPruningMonths,{ keyboardType: 'numeric' })}
      {field('Trasplante (cada N meses)',   repotMonths,  setRepotMonths,  { keyboardType: 'numeric' })}
      {field('Tipo de fertilizante',        fertilizerType,setFertilizerType, { placeholder: 'Ej: NPK equilibrado' })}

      <SelectRow
        label="Luz necesaria"
        value={lightNeeds}
        options={[
          { value: '',          label: 'Sin especificar' },
          { value: 'directa',   label: '☀️ Directa' },
          { value: 'indirecta', label: '🌤 Indirecta' },
          { value: 'sombra',    label: '🌑 Sombra' },
        ]}
        onChange={setLightNeeds}
      />

      <View style={styles.tempRow}>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Temp. mín. (°C)</Text>
          <TextInput style={styles.input} value={tempMin} onChangeText={setTempMin} keyboardType="numeric" placeholderTextColor="#94a3b8" />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Temp. máx. (°C)</Text>
          <TextInput style={styles.input} value={tempMax} onChangeText={setTempMax} keyboardType="numeric" placeholderTextColor="#94a3b8" />
        </View>
      </View>

      <View style={styles.btnRow}>
        {onCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitBtnText}>Guardar planta</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, padding: 16, backgroundColor: '#f0fdf4' },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  error:           { backgroundColor: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 },
  formGroup:       { marginBottom: 12 },
  label:           { fontSize: 13, color: '#475569', marginBottom: 4 },
  input:           { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 9, padding: 11, fontSize: 14, color: '#1e293b' },
  textarea:        { minHeight: 72 },
  optionRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option:          { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  optionSelected:  { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  optionText:      { fontSize: 13, color: '#64748b' },
  optionTextSelected: { color: '#15803d', fontWeight: '600' },
  tempRow:         { flexDirection: 'row', marginBottom: 12 },
  btnRow:          { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 32 },
  cancelBtn:       { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 14, alignItems: 'center' },
  cancelBtnText:   { color: '#475569', fontWeight: '600' },
  submitBtn:       { flex: 2, backgroundColor: '#16a34a', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDisabled:     { opacity: 0.6 },
  submitBtnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
})
