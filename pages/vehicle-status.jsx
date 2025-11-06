/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { FiSearch, FiX } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import VehicleCard from '@/features/vehicle-status/VehicleCard';
import VehicleModal from '@/features/vehicle-status/VehicleModal';

const AVAILABLE = 'DXuCBw5ovRqNwkda3e5i';
const PARKED = 'wHdkyrnMeyEYfgUJgRek';
const OFF_LOT = '58WZhssfhAVfxsvTiOFs';

const now = Date.now();

/** Parse time in "HH:mm" or "h:mmam"/"h:mmpm" (case-insensitive) → "HH:mm" 24h */
function parseTimeTo24h(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const s = timeStr.trim().toLowerCase();

  // 24h "HH:mm"
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let [, hh, mm] = m24;
    const H = Math.max(0, Math.min(23, parseInt(hh, 10)));
    const M = Math.max(0, Math.min(59, parseInt(mm, 10)));
    return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
  }

  // 12h "h:mmam" / "h:mmpm" / with space (e.g. "1:07 pm", "9 am")
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?$/i);
  if (m12) {
    let hour = parseInt(m12[1] || '0', 10);
    let min = parseInt(m12[2] || '0', 10);
    const ap = m12[3]; // 'a' or 'p'
    hour = Math.max(1, Math.min(12, hour));
    min = Math.max(0, Math.min(59, min));
    if (ap === 'p' && hour !== 12) hour += 12;
    if (ap === 'a' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  // simple "h am"/"h pm"
  const m12simple = s.match(/^(\d{1,2})\s*([ap])\.?m?\.?$/i);
  if (m12simple) {
    let hour = parseInt(m12simple[1] || '0', 10);
    const ap = m12simple[2];
    hour = Math.max(1, Math.min(12, hour));
    if (ap === 'p' && hour !== 12) hour += 12;
    if (ap === 'a' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:00`;
  }

  // Unknown format
  return null;
}

/** Build local timestamp (ms) from "yyyy-mm-dd" + flexible time */
function toTimestamp(dateStr, timeStr) {
  if (!dateStr) return null;
  const hhmm = parseTimeTo24h(timeStr) ?? '23:59';
  const ts = new Date(`${dateStr}T${hhmm}:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

// 👇 Replace with your real "Closed" reservationStatus id
const CLOSED_STATUS_ID = 'W6TBsaDUeLB9R6POm9Hf';

const locations = [
  { id: '5czwtumKOwNiRLtfVNDw', label: 'Airport' },
  { id: 'dDuHdE9wXNVDtoKcNxhQ', label: 'Waikiki' },
];

function getTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Respect the "show closed" toggle
function filterEventsByClosed(allEvents = [], showClosed) {
  if (showClosed) return allEvents;
  return allEvents.filter(
    (e) =>
      String(e?.status || '').toLowerCase() === 'oos' ||
      e?.status !== CLOSED_STATUS_ID
  );
}

/* ---------- Main ---------- */
export default function VehicleStatus() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleEvents, setVehicleEvents] = useState([]);
  const [reservationStatuses, setReservationStatuses] = useState([]);
  const [search, setSearch] = useState('');
  const [openVehicleModal, setOpenVehicleModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showClosedReservations, setShowClosedReservations] = useState(false);

  // Location filter
  const [selectedLocationId, setSelectedLocationId] = useState('all');

  const auth = getAuth();
  const currentUser = auth.currentUser || null;

  const today = getTodayDate();

  // Vehicles
  useEffect(() => {
    const qRef = query(collection(db, 'vehicles'));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setVehicles(list);
      },
      (err) => console.error('vehicles onSnapshot error:', err)
    );
    return () => unsub();
  }, []);

  // Today's overlapping events
  useEffect(() => {
    const qRef = query(
      collection(db, 'vehicleEvents'),
      where('startDate', '<=', today),
      where('endDate', '>=', today)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const events = [];
        snap.forEach((d) => events.push({ id: d.id, ...d.data() }));
        setVehicleEvents(events);
      },
      (err) => console.error('vehicleEvents onSnapshot error:', err)
    );
    return () => unsub();
  }, [today]);

  // Reservation statuses
  useEffect(() => {
    const qRef = query(collection(db, 'reservationStatus'));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setReservationStatuses(list);
      },
      (err) => console.error('reservationStatus onSnapshot error:', err)
    );
    return () => unsub();
  }, []);

  // Enrich with ALL events for each vehicle (today-overlapping)
  const enrichedVehicles = useMemo(() => {
    if (!Array.isArray(vehicles) || vehicles.length === 0) return [];

    // Group events by vehicleId
    const byVehicle = (
      Array.isArray(vehicleEvents) ? vehicleEvents : []
    ).reduce((acc, ev) => {
      const vid = ev?.assignedVehicle;
      if (!vid) return acc;
      (acc[vid] ||= []).push(ev);
      return acc;
    }, {});

    return vehicles.map((v) => {
      const evs = byVehicle[v.id] || [];

      // Normalize event fields we care about
      const normalized = evs.map((ev) => ({
        id: ev.id,
        status: ev.status || '', // 'oos' OR reservationStatus doc id
        renterName: ev.renterName || '',
        description: ev.description || '',
        startDate: ev.startDate || '',
        endDate: ev.endDate || '',
        startTime: ev.startTime || '',
        endTime: ev.endTime || '',
        pickUpLocation: ev.pickUpLocation || '',
        returnLocation: ev.returnLocation || '',
      }));

      // renterFallback (legacy); search uses filtered events below
      const renterFallback = Array.from(
        new Set(
          normalized
            .map((e) => (e.renterName || '').trim())
            .filter(Boolean)
            .map((n) => n.toLowerCase())
        )
      ).join(' ');

      return { ...v, renterName: renterFallback, events: normalized };
    });
  }, [vehicles, vehicleEvents]);

  // --- Search (respects the "show closed" toggle) ---
  const searchFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const active = enrichedVehicles.filter((v) => !v.archived);
    if (!s) return active;

    return active.filter((v) => {
      // Only consider events after applying the closed filter
      const eventsForSearch = filterEventsByClosed(
        v.events,
        showClosedReservations
      );

      const eventText = (eventsForSearch || [])
        .flatMap((e) => [
          e.renterName,
          e.description,
          e.startDate,
          e.endDate,
          e.startTime,
          e.endTime,
          e.status,
        ])
        .filter(Boolean)
        .join(' ');

      const renterNamesFiltered = Array.from(
        new Set(
          (eventsForSearch || [])
            .map((e) => e.renterName?.toLowerCase())
            .filter(Boolean)
        )
      ).join(' ');

      const hay = [
        v.licenseNo,
        v.vin,
        v.make,
        v.model,
        v.className,
        renterNamesFiltered,
        eventText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return hay.includes(s);
    });
  }, [enrichedVehicles, search, showClosedReservations]);

  // --- Apply location filter on top of searchFiltered ---
  const base = useMemo(() => {
    if (selectedLocationId === 'all') return searchFiltered;
    return searchFiltered.filter(
      (v) => v.assignedLocation === selectedLocationId
    );
  }, [searchFiltered, selectedLocationId]);

  // Split into On-site (no currentTrip) vs Off-lot (has currentTrip)
  const onSiteVehicles = useMemo(
    () => base.filter((v) => !v.currentTrip),
    [base]
  );

  // Sort off-lot vehicles by currentTrip.lateAfter (ascending; nulls last)
  const offLotVehicles = useMemo(() => {
    const list = base.filter((v) => !!v.currentTrip);
    return [...list].sort((a, b) => {
      const A = a.currentTrip?.lateAfter ?? Infinity;
      const B = b.currentTrip?.lateAfter ?? Infinity;
      return A - B;
    });
  }, [base]);

  // Counts per location button still reflect searchFiltered baseline
  const countsByLocation = useMemo(() => {
    const map = { all: searchFiltered.length };
    for (const loc of locations) {
      map[loc.id] = searchFiltered.filter(
        (v) => v.assignedLocation === loc.id
      ).length;
    }
    return map;
  }, [searchFiltered]);

  const statusById = useMemo(() => {
    const map = {};
    for (const s of reservationStatuses) {
      map[s.id] = {
        name: s.name || 'Status',
        background: s.background || '#e5e7eb',
        text: s.text || '#111827',
      };
    }
    return map;
  }, [reservationStatuses]);

  const handleSelectVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    setOpenVehicleModal(true);
  };

  const isActiveFilter = (id) =>
    (id === 'all' && selectedLocationId === 'all') ||
    (id !== 'all' && selectedLocationId === id);

  const filterBtnVariant = (id) =>
    isActiveFilter(id) ? 'defaultDark' : 'outlineDark';

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-black space-y-4">
        {/* Sticky toolbar (filters + search) */}
        <div className="sticky top-0 z-20 px-4 py-3 bg-black/80 backdrop-blur supports-backdrop-filter:bg-black/60">
          <div className="md:flex items-center justify-between md:space-x-2 space-y-3 md:space-y-0">
            {/* Location filters with counts */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterBtnVariant('all')}
                onClick={() => setSelectedLocationId('all')}
              >
                <span className="whitespace-nowrap">
                  All ({countsByLocation.all ?? 0})
                </span>
              </Button>
              {locations.map((location) => (
                <Button
                  key={location.id}
                  variant={filterBtnVariant(location.id)}
                  onClick={() => setSelectedLocationId(location.id)}
                >
                  {location.label} ({countsByLocation[location.id] ?? 0})
                </Button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-[400px]">
              <label
                htmlFor="search"
                className="absolute left-0 top-0 h-12 aspect-square flex items-center justify-center"
              >
                <FiSearch className="text-lg" />
              </label>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vehicles, reservations and OOS…"
                className="w-full h-12 bg-white rounded-full px-12 "
              />
              {search !== '' && (
                <div className="absolute right-0 top-0 h-12 aspect-square flex items-center justify-center p-1.5">
                  <div
                    onClick={() => setSearch('')}
                    className="w-full aspect-square rounded-full hover:bg-gray-100 flex items-center justify-center"
                  >
                    <FiX className="text-lg" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-12">
          {/* On site */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-white">
                On site ({onSiteVehicles.length})
              </div>
              <div className="space-x-2">
                <Button
                  onClick={() => setShowClosedReservations((prev) => !prev)}
                  variant={
                    showClosedReservations ? 'defaultDark' : 'outlineDark'
                  }
                  size="sm"
                >
                  {showClosedReservations ? 'Hide closed' : 'Show closed'}
                </Button>
              </div>
            </div>

            {onSiteVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                handleSelectVehicle={handleSelectVehicle}
                statusById={statusById}
                showClosedReservations={showClosedReservations}
              />
            ))}
          </div>

          {/* Off lot */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-white">
                Off lot ({offLotVehicles.length})
              </div>
              <div className="space-x-2">{/* future filter chips */}</div>
            </div>

            {offLotVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                handleSelectVehicle={handleSelectVehicle}
                statusById={statusById}
                showClosedReservations={showClosedReservations}
              />
            ))}
          </div>
        </div>
      </div>

      <VehicleModal
        open={openVehicleModal}
        onClose={() => setOpenVehicleModal(false)}
        vehicle={selectedVehicle}
        showClosedReservations={showClosedReservations}
        currentUser={currentUser}
      />
    </DashboardLayout>
  );
}
