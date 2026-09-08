/**
 * LocationMapPicker — Leaflet-based GPS pin picker
 *
 * Props:
 *   lat, lng          — current pin coordinates (numbers or null)
 *   onChange(lat,lng) — called whenever the pin moves
 *   height            — CSS height string, default '320px'
 *   label             — optional label shown above the map
 */
import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

// Bago City centre
const BAGO_CENTER = [10.5340, 122.8374];
const DEFAULT_ZOOM = 14;

export default function LocationMapPicker({
  lat = null,
  lng = null,
  onChange,
  height = '320px',
  label = 'Pin your exact location',
}) {
  const mapRef      = useRef(null);  // DOM node
  const leafletMap  = useRef(null);  // L.Map instance
  const markerRef   = useRef(null);  // L.Marker instance
  const [locating,  setLocating]  = useState(false);
  const [error,     setError]     = useState('');
  const [pinned,    setPinned]    = useState(!!(lat && lng));

  // ── Bootstrap Leaflet once ──────────────────────────────────────────────
  useEffect(() => {
    if (leafletMap.current) return; // already initialised

    // Lazy-load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id    = 'leaflet-css';
      link.rel   = 'stylesheet';
      link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then(L => {
      // Fix default marker icon paths broken by bundlers
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initialCenter = (lat && lng) ? [lat, lng] : BAGO_CENTER;
      const map = L.map(mapRef.current, {
        center: initialCenter,
        zoom:   DEFAULT_ZOOM,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Place initial marker if coordinates provided
      if (lat && lng) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.bindPopup('📍 Your location').openPopup();
        markerRef.current.on('dragend', e => {
          const pos = e.target.getLatLng();
          onChange(pos.lat, pos.lng);
        });
      }

      // Click to set / move pin
      map.on('click', e => {
        const { lat: cLat, lng: cLng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([cLat, cLng]);
        } else {
          markerRef.current = L.marker([cLat, cLng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', ev => {
            const pos = ev.target.getLatLng();
            onChange(pos.lat, pos.lng);
          });
        }
        markerRef.current.bindPopup('📍 Your location').openPopup();
        setPinned(true);
        onChange(cLat, cLng);
      });

      leafletMap.current = map;
    });

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markerRef.current  = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync external lat/lng changes into the map ──────────────────────────
  useEffect(() => {
    if (!leafletMap.current || !lat || !lng) return;
    import('leaflet').then(L => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(leafletMap.current);
        markerRef.current.on('dragend', e => {
          const pos = e.target.getLatLng();
          onChange(pos.lat, pos.lng);
        });
      }
      leafletMap.current.setView([lat, lng], DEFAULT_ZOOM);
      setPinned(true);
    });
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS: use device location ────────────────────────────────────────────
  const useGPS = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('GPS not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        onChange(latitude, longitude);
        setLocating(false);
      },
      err => {
        setError('Could not get GPS location. Please pin manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} <span className="text-red-500">*</span>
        </label>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={useGPS}
          disabled={locating}
          className="flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          <Navigation size={14} />
          {locating ? 'Getting GPS…' : 'Use My GPS Location'}
        </button>
        {pinned && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <MapPin size={12} /> Location pinned
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        style={{ height, width: '100%' }}
        className="rounded-xl border border-gray-300 overflow-hidden z-0"
      />

      {/* Coordinate display */}
      {lat && lng && (
        <p className="text-xs text-gray-400 mt-1.5">
          📍 {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
        </p>
      )}

      <p className="text-xs text-gray-400 mt-1">
        Tap the map or drag the pin to adjust your exact location.
      </p>
    </div>
  );
}
