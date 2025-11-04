/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { FiSearch, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const AVAILABLE = 'DXuCBw5ovRqNwkda3e5i';
const PARKED = 'wHdkyrnMeyEYfgUJgRek';
const OFF_LOT = '58WZhssfhAVfxsvTiOFs';

const now = Date.now();

/** Firestore Timestamp/seconds/number -> ms */
function tsToMillis(v) {
  if (typeof v === 'number') return v;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && typeof v.seconds === 'number') return v.seconds * 1000;
  return NaN;
}

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

const locationMap = {
  '5czwtumKOwNiRLtfVNDw': 'Airport',
  dDuHdE9wXNVDtoKcNxhQ: 'Waikiki',
};

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

// Small pill for currentTrip status in Vehicle header
function TripPill({ trip }) {
  if (!trip?.status) return null;

  const nowMs = now;
  const isOOS = trip.status === 'out of service';
  const lateAfterMs = tsToMillis(trip.lateAfter);
  const isReservation = !isOOS;
  const isLate =
    isReservation && Number.isFinite(lateAfterMs) && nowMs >= lateAfterMs;

  let bg = '#dbeafe',
    fg = '#1e40af',
    label = 'Rented'; // default
  if (isOOS) {
    bg = '#ef4444';
    fg = '#ffffff';
    label = 'Out of service';
  } else if (isLate) {
    bg = '#ef4444';
    fg = '#ffffff';
    label = 'Late';
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ml-2"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
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

function VehicleCard({
  vehicle,
  handleSelectVehicle,
  statusById,
  showClosedReservations,
  ...rest
}) {
  // Filter closed events here (keep OOS visible)
  const eventsToShow = useMemo(() => {
    const all = Array.isArray(vehicle?.events) ? vehicle.events : [];
    return filterEventsByClosed(all, showClosedReservations);
  }, [vehicle, showClosedReservations]);

  const hasTrip = !!vehicle?.currentTrip;

  return (
    <div
      onClick={() => handleSelectVehicle(vehicle)}
      className="rounded-2xl shadow overflow-hidden bg-gray-50 w-full grid grid-cols-3 "
      {...rest}
    >
      <div className=" relative">
        <div className="absolute top-0 left-0 p-1">
          <span className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-black text-white ">
            {locationMap[vehicle.assignedLocation] ?? '—'}
          </span>
        </div>
        <img
          //src="/car-placeholder.png"
          src="https://i.abcnewsfe.com/a/f43853f3-9eaf-4048-9ae7-757332c5787e/mclaren-1-ht-gmh-240412_1712928561648_hpMain_16x9.jpg?w=992"
          alt="placeholder"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="col-span-2 w-full">
        <div className="px-3 pt-3">
          <div className="flex justify-between leading-tight w-full">
            <div className="font-medium">
              {vehicle.make} {vehicle.model}{' '}
              {hasTrip ? (
                <TripPill trip={vehicle.currentTrip} />
              ) : eventsToShow.length === 0 ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-green-200 text-green-700">
                  Available
                </span>
              ) : null}
            </div>
            <div className="font-semibold whitespace-nowrap text-end">
              {vehicle.licenseNo}
            </div>
          </div>
        </div>
        {vehicle.currentTrip && vehicle.currentTrip.lateAfter && (
          <>{vehicle.currentTrip.lateAfter}</>
        )}
        {eventsToShow.length === 0 ? (
          <div className="min-h-24 mt-1 px-3"></div>
        ) : (
          <div className="w-full overflow-hidden overflow-x-auto min-h-22 p-3">
            <div
              className={`grid ${
                eventsToShow.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              } w-max gap-2`}
            >
              {eventsToShow.map((evt) => (
                <EventCard key={evt.id} evt={evt} statusById={statusById} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ evt, statusById, ...rest }) {
  if (evt?.status === 'oos') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg py-1 px-2 min-w-[260px] min-h-20">
        <div className="text-sm font-semibold">Out of service</div>
        <div className="text-xs">{evt?.description}</div>
      </div>
    );
  }

  return (
    <div
      className="border border-gray-200 rounded-lg py-1 px-2 bg-white min-w-[260px] min-h-20"
      {...rest}
    >
      <div className="flex justify-between mb-1">
        <span className="text-sm mr-2 font-semibold">{evt.renterName}</span>
        <EventPill event={evt} statusById={statusById} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="">
          <div className="text-xs uppercase font-semibold">Pick-up</div>
          <div className="text-xs">{locationMap[evt?.pickUpLocation]}</div>
          <div className="text-xs">
            {evt?.startDate} {evt?.startTime}
          </div>
        </div>
        <div className="">
          <div className="text-xs uppercase font-semibold">Return</div>
          <div className="text-xs">{locationMap[evt?.returnLocation]}</div>
          <div className="text-xs">
            {evt?.endDate} {evt?.endTime}
          </div>
        </div>
      </div>
    </div>
  );
}

function VehicleModal({
  open,
  onClose,
  vehicle,
  showClosedReservations,
  currentUser,
}) {
  // Keep modal in sync with the same closed filter toggle
  const eventsToShow = useMemo(() => {
    const all = Array.isArray(vehicle?.events) ? vehicle.events : [];
    return filterEventsByClosed(all, showClosedReservations);
  }, [vehicle, showClosedReservations]);

  const handleCheckout = async (event) => {
    if (!vehicle?.id) return;

    const isOOS = String(event?.status || '').toLowerCase() === 'oos';

    // Build lateAfter from the event's endDate + endTime (reservations only)
    const lateAfter = isOOS
      ? null
      : toTimestamp(event?.endDate, event?.endTime);

    const trip = {
      timestamp: now,
      handledBy: currentUser?.email || currentUser?.uid || 'unauthenticated',
      status: isOOS ? 'out of service' : 'rented',
      lateAfter: lateAfter ?? null, // <—— stored for off-lot sorting + "Late" pill
      // For reservations:
      ...(isOOS
        ? { oosDescription: event?.description || '' }
        : {
            driver: event?.renterName || '',
            event: event?.id || '',
          }),
    };

    try {
      await updateDoc(doc(db, 'vehicles', vehicle.id), { currentTrip: trip });
      onClose?.();
    } catch (err) {
      console.error('Failed to set currentTrip:', err);
      // optional: toast error
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.licenseNo}` : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Add photo
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {eventsToShow.map((event) => {
        const isOOS = String(event?.status || '').toLowerCase() === 'oos';
        return (
          <div key={event.id} className="space-y-2 mb-4">
            <div className="font-semibold">
              {isOOS ? 'Out of service' : event.renterName}
            </div>
            {isOOS && (
              <div className="text-xs text-gray-600">
                {event?.description || ''}
              </div>
            )}
            <Button variant="primary" onClick={() => handleCheckout(event)}>
              Checkout{!isOOS && event.renterName ? ` ${event.renterName}` : ''}
            </Button>
          </div>
        );
      })}
      {eventsToShow.length === 0 && (
        <div className="text-sm text-gray-600">No active events.</div>
      )}
    </Modal>
  );
}

function EventPill({ event, statusById }) {
  if (!event) return null;
  const isOOS = String(event.status || '').toLowerCase() === 'oos';
  if (isOOS) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ background: '#ef4444', color: '#ffffff' }}
        title="Out of service"
      >
        Out of service
      </span>
    );
  }
  const rs = statusById[event.status];
  const bg = rs?.background || '#e5e7eb';
  const fg = rs?.text || '#111827';
  const label = rs?.name || 'Status';
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: bg, color: fg }}
      title={label}
    >
      {label}
    </span>
  );
}
