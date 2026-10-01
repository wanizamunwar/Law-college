import { useEffect, useRef, useState } from 'react'
import { Building2, ImageIcon, Save, Trash2, TriangleAlert } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { Alert, Card, PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import type { CollegeProfile, OfficeHours } from '@/types'
import { EMPTY_OFFICE_HOURS, MAX_IMAGE_BYTES, PROVINCES } from '@/lib/defaults'
import { formatBytes } from '@/lib/format'
import { isValidUrl } from '@/lib/validation'

const WEEKDAYS: Array<{ key: keyof OfficeHours; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

type Errors = Partial<Record<keyof CollegeProfile, string>>

const CURRENT_YEAR = new Date().getFullYear()

/** Reads an image file and returns a downscaled data URL for the logo slot. */
async function fileToScaledDataUrl(file: File, maxSize = 256): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })

  // Only raster images need resizing; SVG logos are already compact.
  if (file.type === 'image/svg+xml') return dataUrl

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('The selected file is not a valid image.'))
    element.src = dataUrl
  })

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)

  const context = canvas.getContext('2d')
  if (!context) return dataUrl

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export function CollegeInformationPage() {
  const { settings, saveCollege, canEdit } = useStore()
  const toast = useToast()

  const [form, setForm] = useState<CollegeProfile>(settings.college)
  const [errors, setErrors] = useState<Errors>({})
  const [logoError, setLogoError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  // Lets us detect edits made on the Location page.
  const previousProfile = useRef(settings.college)

  useEffect(() => {
    if (previousProfile.current !== settings.college) {
      previousProfile.current = settings.college
      setForm(settings.college)
      setDirty(false)
    }
  }, [settings.college])

  const set = <K extends keyof CollegeProfile>(key: K, value: CollegeProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const setHours = (key: keyof OfficeHours, value: string) => {
    setForm((prev) => ({ ...prev, officeHours: { ...prev.officeHours, [key]: value } }))
    setDirty(true)
  }

  const handleLogoFile = async (file: File) => {
    setLogoError(null)

    if (!file.type.startsWith('image/')) {
      setLogoError('The logo must be an image file (PNG, JPG, SVG or WEBP).')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setLogoError(`The logo must be smaller than ${formatBytes(MAX_IMAGE_BYTES)}.`)
      return
    }

    try {
      const dataUrl = await fileToScaledDataUrl(file)
      set('logoDataUrl', dataUrl)
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Could not process the image.')
    }
  }

  const removeLogo = () => {
    set('logoDataUrl', null)
    setLogoError(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const validate = (): boolean => {
    const next: Errors = {}

    if (!form.name.trim()) next.name = 'College name is required.'
    if (!form.address.trim()) next.address = 'College address is required.'
    if (!form.city.trim()) next.city = 'City is required.'
    if (!form.province) next.province = 'Select a province.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) {
      next.email = 'Enter a valid email address.'
    }
    if (form.website && !isValidUrl(form.website)) {
      next.website = 'Enter a full URL, including https://'
    }
    if (form.establishmentYear) {
      const year = Number(form.establishmentYear)
      if (!Number.isInteger(year) || year < 1800 || year > CURRENT_YEAR) {
        next.establishmentYear = `Enter a valid year between 1800 and ${CURRENT_YEAR}.`
      }
    }
    if (form.latitude) {
      const latitude = Number(form.latitude)
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        next.latitude = 'Latitude must be between -90 and 90.'
      }
    }
    if (form.longitude) {
      const longitude = Number(form.longitude)
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        next.longitude = 'Longitude must be between -180 and 180.'
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) {
      toast.error('Check the form', 'Some fields need attention before saving.')
      return
    }

    setSaving(true)
    try {
      await saveCollege({
        ...form,
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        website: form.website.trim(),
        about: form.about.trim(),
        city: form.city.trim(),
      })

      setDirty(false)
      toast.success('College information saved', 'Your changes are now reflected across the system.')
    } catch (error) {
      toast.error(
        'Could not save the profile',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setForm(settings.college)
    previousProfile.current = settings.college
    setErrors({})
    setLogoError(null)
    setDirty(false)
  }

  return (
    <>
      <PageHeader
        title="College Information"
        description="The official profile of the institution. These details appear on the login screen, sidebar and location page."
        actions={
          <>
            {dirty && (
              <Button variant="ghost" icon={<TriangleAlert size={14} />} onClick={handleReset}>
                Discard changes
              </Button>
            )}
            <Button
              variant="accent"
              icon={<Save size={14} />}
              onClick={handleSubmit}
              type="submit"
              form="college-form"
              disabled={!dirty || saving || !canEdit}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />

      <form id="college-form" onSubmit={handleSubmit} noValidate>
        <div className="profile-layout">
          {/* --------------------------- Logo --------------------------- */}
          <aside className="profile-side">
            <Card title="College Logo" subtitle="Shown in the sidebar and header">
              <div
                className="logo-drop"
                onClick={() => logoInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    logoInputRef.current?.click()
                  }
                }}
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="u-visually-hidden"
                  aria-label="Upload college logo"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void handleLogoFile(file)
                  }}
                />

                <span className="logo-drop__preview">
                  {form.logoDataUrl ? (
                    <img src={form.logoDataUrl} alt="College logo" />
                  ) : (
                    <Building2 size={26} />
                  )}
                </span>

                <span className="logo-drop__label">
                  {form.logoDataUrl ? 'Replace logo' : 'Upload logo'}
                </span>
                <span className="logo-drop__hint">
                  PNG, JPG, SVG · max {formatBytes(MAX_IMAGE_BYTES)}
                </span>
              </div>

              {logoError && (
                <div style={{ marginTop: 12 }}>
                  <Alert tone="danger" icon={<TriangleAlert size={14} />}>
                    {logoError}
                  </Alert>
                </div>
              )}

              {form.logoDataUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={removeLogo}
                  style={{ marginTop: 12 }}
                >
                  Remove logo
                </Button>
              )}

              <div className="u-divider" style={{ margin: '18px 0' }} />

              <p className="section-label">Institution Summary</p>
              <div style={{ display: 'grid', gap: 9, fontSize: '0.8125rem' }}>
                <SummaryRow label="Name" value={form.shortName || form.name} />
                <SummaryRow label="City" value={form.city} />
                <SummaryRow label="Province" value={form.province} />
                <SummaryRow label="Established" value={form.establishmentYear} />
              </div>
            </Card>
          </aside>

          {/* ------------------------- Main form ------------------------- */}
          <div className="u-stack-16">
            <Card title="Identity" subtitle="Name and institutional details">
              <div className="form-grid form-grid--2">
                <Input
                  label="College Name"
                  value={form.name}
                  onChange={(event) => set('name', event.target.value)}
                  placeholder="e.g. Siraj-ud-Daulah Law College"
                  error={errors.name}
                  wrapperClassName="form-grid__full"
                  required
                />
                <Input
                  label="Short Name"
                  value={form.shortName}
                  onChange={(event) => set('shortName', event.target.value)}
                  placeholder="e.g. SDL Law College"
                  hint="Optional. Used where space is limited."
                />
                <Input
                  label="Establishment Year"
                  value={form.establishmentYear}
                  onChange={(event) => set('establishmentYear', event.target.value)}
                  placeholder="1974"
                  inputMode="numeric"
                  error={errors.establishmentYear}
                />
                <Input
                  label="Registrar Name"
                  value={form.registrarName}
                  onChange={(event) => set('registrarName', event.target.value)}
                  placeholder="e.g. Prof. Nusrat Hussain"
                  wrapperClassName="form-grid__full"
                />
              </div>
            </Card>

            <Card title="Contact" subtitle="How the institution can be reached">
              <div className="form-grid form-grid--2">
                <Textarea
                  label="Address"
                  value={form.address}
                  onChange={(event) => set('address', event.target.value)}
                  placeholder="Street address"
                  rows={2}
                  error={errors.address}
                  wrapperClassName="form-grid__full"
                  required
                />
                <Input
                  label="City"
                  value={form.city}
                  onChange={(event) => set('city', event.target.value)}
                  placeholder="e.g. Lahore"
                  error={errors.city}
                  required
                />
                <Input
                  label="Province"
                  value={form.province}
                  onChange={(event) => set('province', event.target.value)}
                  placeholder="Select province"
                  error={errors.province}
                  list="province-options"
                  required
                />
                <datalist id="province-options">
                  {PROVINCES.map((province) => (
                    <option key={province} value={province} />
                  ))}
                </datalist>

                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(event) => set('phone', event.target.value)}
                  placeholder="+92 42 3577 1200"
                  inputMode="tel"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) => set('email', event.target.value)}
                  placeholder="registrar@college.edu.pk"
                  error={errors.email}
                />
                <Input
                  label="Website"
                  value={form.website}
                  onChange={(event) => set('website', event.target.value)}
                  placeholder="https://www.college.edu.pk"
                  error={errors.website}
                  wrapperClassName="form-grid__full"
                />
              </div>
            </Card>

            <Card title="About College" subtitle="Shown on the profile and login screen">
              <Textarea
                label="About College"
                value={form.about}
                onChange={(event) => set('about', event.target.value)}
                placeholder="Describe the college's history, academic philosophy and specialisms."
                rows={6}
                maxLength={1200}
                hint={`${form.about.length} of 1200 characters`}
              />
            </Card>

            <Card title="Office Hours" subtitle="Registry opening hours">
              <div className="office-hours">
                {WEEKDAYS.map((day) => (
                  <div className="office-hours__row" key={day.key}>
                    <label className="office-hours__day" htmlFor={`hours-${day.key}`}>
                      {day.label}
                    </label>
                    <input
                      id={`hours-${day.key}`}
                      type="text"
                      className="input"
                      value={form.officeHours[day.key]}
                      onChange={(event) => setHours(day.key, event.target.value)}
                      placeholder={EMPTY_OFFICE_HOURS[day.key]}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      officeHours: { ...EMPTY_OFFICE_HOURS },
                    }))
                    setDirty(true)
                  }}
                >
                  Reset to defaults
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      officeHours: {
                        ...prev.officeHours,
                        monday: '08:30 – 16:00',
                        tuesday: '08:30 – 16:00',
                        wednesday: '08:30 – 16:00',
                        thursday: '08:30 – 16:00',
                        friday: '08:30 – 16:00',
                        saturday: '09:00 – 13:00',
                        sunday: 'Closed',
                      },
                    }))
                    setDirty(true)
                  }}
                >
                  Copy Monday hours to weekdays
                </Button>
              </div>
            </Card>

            <div className="form-actions" style={{ borderRadius: 'var(--radius-lg)' }}>
              <span className="form-actions__note">
                <ImageIcon size={13} />
                {!canEdit
                  ? 'Your account has read-only access'
                  : dirty
                    ? 'You have unsaved changes'
                    : 'All changes saved'}
              </span>
              <Button variant="secondary" onClick={handleReset} disabled={!dirty}>
                Discard
              </Button>
              <Button
                type="submit"
                variant="accent"
                icon={<Save size={14} />}
                disabled={!dirty || saving || !canEdit}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span className="u-text-muted">{label}</span>
      <span
        style={{
          fontWeight: 550,
          color: value ? 'var(--ink-900)' : 'var(--text-subtle)',
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '60%',
        }}
      >
        {value || 'Not set'}
      </span>
    </div>
  )
}