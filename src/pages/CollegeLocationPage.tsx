import { useMemo, useState } from 'react'
import {
  Building2,
  Compass,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  Save,
  TriangleAlert,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { Alert, Card, PageHeader } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { PROVINCES } from '@/lib/defaults'
import { LATITUDE_MESSAGE, LATITUDE_PATTERN, LONGITUDE_MESSAGE, LONGITUDE_PATTERN } from '@/lib/validation'

type Errors = Partial<{ latitude: string; longitude: string; address: string; city: string }>

export function CollegeLocationPage() {
  const { updateCollege, settings } = useStore()
  const toast = useToast()

  const college = settings.college

  const [address, setAddress] = useState(college.address)
  const [city, setCity] = useState(college.city)
  const [province, setProvince] = useState(college.province)
  const [latitude, setLatitude] = useState(college.latitude)
  const [longitude, setLongitude] = useState(college.longitude)
  const [errors, setErrors] = useState<Errors>({})

  const lat = Number(latitude)
  const lng = Number(longitude)
  const hasCoordinates = latitude.trim() !== '' && longitude.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng)

  /** Full street address used for directions links. */
  const fullAddress = useMemo(
    () =>
      [address, city, province]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ') || '',
    [address, city, province],
  )

  /**
   * OpenStreetMap embed — no API key required and reliable offline of billing
   * concerns. The bbox is derived from the point with a fixed span so the pin
   * is always centred and visible.
   */
  const mapSrc = useMemo(() => {
    if (!hasCoordinates) return null
    const span = 0.006
    const bbox = [
      (lng - span).toFixed(5),
      (lat - span).toFixed(5),
      (lng + span).toFixed(5),
      (lat + span).toFixed(5),
    ].join('%2C')
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`
  }, [hasCoordinates, lat, lng])

  const directionsUrl = useMemo(() => {
    if (hasCoordinates) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`
    }
    if (fullAddress) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`
    }
    return null
  }, [hasCoordinates, lat, lng, fullAddress])

  const openInMaps = useMemo(() => {
    if (hasCoordinates) {
      return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(6)}/${lng.toFixed(6)}`
    }
    if (fullAddress) {
      return `https://www.openstreetmap.org/search?query=${encodeURIComponent(fullAddress)}`
    }
    return null
  }, [hasCoordinates, lat, lng, fullAddress])

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault()

    const next: Errors = {}

    if (!address.trim()) next.address = 'College address is required.'
    if (!city.trim()) next.city = 'City is required.'

    if (latitude.trim() && !LATITUDE_PATTERN.test(latitude.trim())) {
      next.latitude = LATITUDE_MESSAGE
    }
    if (longitude.trim() && !LONGITUDE_PATTERN.test(longitude.trim())) {
      next.longitude = LONGITUDE_MESSAGE
    }

    // Both must be provided together, otherwise the map cannot be centred.
    if (latitude.trim() && !longitude.trim()) {
      next.longitude = 'Enter a longitude to complete the coordinates.'
    }
    if (longitude.trim() && !latitude.trim()) {
      next.latitude = 'Enter a latitude to complete the coordinates.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) {
      toast.error('Check the form', 'Some location details need attention.')
      return
    }

    updateCollege({
      address: address.trim(),
      city: city.trim(),
      province,
      latitude: latitude.trim(),
      longitude: longitude.trim(),
    })

    toast.success('Location saved', 'The map and directions link now use these coordinates.')
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Not supported', 'This browser does not expose a geolocation API.')
      return
    }

    toast.notify({
      tone: 'info',
      title: 'Locating…',
      message: 'Waiting for a position fix from your device.',
    })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6))
        setLongitude(position.coords.longitude.toFixed(6))
        toast.success(
          'Coordinates captured',
          'Review the values and save the location when they look correct.',
        )
      },
      (error) => {
        const reason =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : error.code === error.TIMEOUT
              ? 'The request timed out.'
              : 'Your position could not be determined.'
        toast.error('Could not get location', reason)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <>
      <PageHeader
        title="College Location"
        description="The registered address and geographic coordinates of the campus, used for directions and the embedded map."
        actions={
          <Button variant="accent" icon={<Save size={14} />} type="submit" form="location-form">
            Save location
          </Button>
        }
      />

      <form id="location-form" onSubmit={handleSave} noValidate>
        <div className="u-stack-16">
          <Card title="Address" subtitle="Where the college is situated">
            <div className="form-grid form-grid--3">
              <Input
                label="College Address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="University Road, Shahrah-e-Faisal"
                error={errors.address}
                wrapperClassName="form-grid__full"
                required
              />
              <Input
                label="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Lahore"
                error={errors.city}
                required
              />
              <Select
                label="Province"
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                options={PROVINCES.map((item) => ({ value: item, label: item }))}
                placeholder="Select province"
              />
              <div className="field">
                <span className="field__label">Phone</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 0',
                    fontSize: '0.8125rem',
                    color: college.phone ? 'var(--ink-900)' : 'var(--text-subtle)',
                  }}
                >
                  <Phone size={14} />
                  {college.phone || 'Not set in College Information'}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Coordinates"
            subtitle="Decimal degrees, used to centre the map"
            actions={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Compass size={13} />}
                onClick={useCurrentLocation}
              >
                Use my location
              </Button>
            }
          >
            <div className="coord-row">
              <Input
                label="Latitude"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="31.468600"
                inputMode="decimal"
                error={errors.latitude}
                hint="Between -90 and 90"
              />
              <Input
                label="Longitude"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="74.384200"
                inputMode="decimal"
                error={errors.longitude}
                hint="Between -180 and 180"
              />
            </div>

            <p className="u-text-subtle" style={{ marginTop: 12, fontSize: '0.75rem' }}>
              OpenStreetMap is used for the embedded map, so no API key is required. Coordinates
              can be copied from any mapping service in decimal degree format.
            </p>
          </Card>

          <Card
            title="Map"
            subtitle={hasCoordinates ? 'Approximate campus location' : 'Add coordinates to display the map'}
            flush
          >
            {mapSrc ? (
              <div className="map-frame">
                <iframe
                  src={mapSrc}
                  title="College location map"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="map-frame map-frame--placeholder" style={{ margin: 18 }}>
                <div>
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      display: 'grid',
                      placeItems: 'center',
                      margin: '0 auto 13px',
                      color: 'var(--text-subtle)',
                    }}
                  >
                    <MapPin size={21} />
                  </span>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--ink-900)',
                    }}
                  >
                    No coordinates set
                  </p>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      maxWidth: '46ch',
                      margin: '6px auto 0',
                    }}
                  >
                    Enter a latitude and longitude above, then save. The map will centre on the
                    campus automatically.
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card title="Directions" subtitle="Shareable links to the campus">
            {directionsUrl ? (
              <div className="directions-card">
                <div>
                  <p className="directions-card__title">Get directions to the campus</p>
                  <p className="directions-card__text">
                    {fullAddress || 'Coordinates only — no postal address recorded yet.'}
                    {hasCoordinates && (
                      <>
                        {' '}
                        ({Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)})
                      </>
                    )}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <a
                    className="btn btn--accent"
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation size={14} />
                    Get Directions
                  </a>
                  {openInMaps && (
                    <a
                      className="btn btn--secondary"
                      href={openInMaps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} />
                      Open Map
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <Alert tone="warning" icon={<TriangleAlert size={15} />}>
                Record an address or a pair of coordinates to generate a directions link.
              </Alert>
            )}
          </Card>

          <div className="form-actions" style={{ borderRadius: 'var(--radius-lg)' }}>
            <span className="form-actions__note">
              <Building2 size={13} />
              Address details are shared with the College Information page
            </span>
            <ButtonLink to="/college" variant="secondary">
              Edit full profile
            </ButtonLink>
            <Button type="submit" variant="accent" icon={<Save size={14} />}>
              Save location
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}