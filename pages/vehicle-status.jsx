/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FiSearch, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ReservationCardCompact from '@/features/_shared/ReservationCardCompact';

const AVAILABLE = 'DXuCBw5ovRqNwkda3e5i';
const PARKED = 'wHdkyrnMeyEYfgUJgRek';
const OFF_LOT = '58WZhssfhAVfxsvTiOFs';

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

/* ---------- Main ---------- */
export default function VehicleStatus() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleEvents, setVehicleEvents] = useState([]);
  const [reservationStatuses, setReservationStatuses] = useState([]);
  const [search, setSearch] = useState('');
  const [openVehicleModal, setOpenVehicleModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Location filter
  const [selectedLocationId, setSelectedLocationId] = useState('all');

  const today = getTodayDate();

  // Vehicles
  useEffect(() => {
    const qRef = query(collection(db, 'vehicles'));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
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
        snap.forEach((doc) => events.push({ id: doc.id, ...doc.data() }));
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
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
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

      // Build a renterFallback string for searching:
      // include each non-empty renterName once (case-insensitive)
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

  // --- Search (applied before counts and location) ---
  const searchFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const active = enrichedVehicles.filter((v) => !v.archived);
    if (!s) return active;

    return active.filter((v) => {
      const eventText = (v.events || [])
        .flatMap((e) => [
          e.renterName,
          e.description,
          e.startDate,
          e.endDate,
          e.startTime,
          e.endTime,
          e.status, // id or 'oos'
        ])
        .filter(Boolean)
        .join(' ');
      const hay = [
        v.licenseNo,
        v.vin,
        v.make,
        v.model,
        v.className,
        v.renterName,
        eventText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(s);
    });
  }, [enrichedVehicles, search]);

  // --- Counts per location, based on searchFiltered (so numbers reflect current search) ---
  const countsByLocation = useMemo(() => {
    const map = { all: searchFiltered.length };
    for (const loc of locations) {
      map[loc.id] = searchFiltered.filter(
        (v) => v.assignedLocation === loc.id
      ).length;
    }
    return map;
  }, [searchFiltered]);

  // --- Apply location filter on top of searchFiltered ---
  const base = useMemo(() => {
    if (selectedLocationId === 'all') return searchFiltered;
    return searchFiltered.filter(
      (v) => v.assignedLocation === selectedLocationId
    );
  }, [searchFiltered, selectedLocationId]);

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

  // Helpers: active styling for filter buttons
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-4 pb-12">
          <div className="space-y-2">
            <div className="font-semibold text-white">On site</div>
            {base.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                handleSelectVehicle={handleSelectVehicle}
                statusById={statusById}
              />
            ))}
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-white">Off lot</div>
          </div>
        </div>
      </div>

      <VehicleModal
        open={openVehicleModal}
        onClose={() => setOpenVehicleModal(false)}
        vehicle={selectedVehicle}
      />
    </DashboardLayout>
  );
}

function VehicleCard({ vehicle, handleSelectVehicle, statusById, ...rest }) {
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
            </div>
            <div className="font-semibold whitespace-nowrap text-end">
              {vehicle.licenseNo}
            </div>
          </div>
        </div>

        {vehicle.events.length === 0 ? (
          <div className="min-h-22 mt-1 px-3">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-green-200 text-green-700">
              Available
            </span>
          </div>
        ) : (
          <div className="w-full overflow-hidden overflow-x-auto min-h-22 p-3">
            <div
              className={`grid  ${
                vehicle.events.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              } w-max gap-2`}
            >
              {vehicle.events.map((evt) => (
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
      <div className=" bg-white border border-gray-200 rounded-lg py-1 px-2 min-w-[260px] min-h-20">
        <div className="text-sm font-semibold">Out of service</div>
        <div className="text-xs">{evt?.description}</div>
      </div>
    );
  }

  return (
    <div
      className=" border border-gray-200 rounded-lg py-1 px-2 bg-white min-w-[260px] min-h-20"
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

function VehicleModal({ open, onClose, vehicle }) {
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
      {vehicle?.events?.map((event) => (
        <div key={event.id}>
          <ReservationCardCompact reservationId={event.id} />

          <Button variant="primary">Checkout {event.renterName}</Button>
        </div>
      ))}
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
