import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FiSearch, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const AVAILABLE = 'DXuCBw5ovRqNwkda3e5i';
const PARKED = 'wHdkyrnMeyEYfgUJgRek';
const OFF_LOT = '58WZhssfhAVfxsvTiOFs';

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

/** Format yyyy-mm-dd -> mm/dd/yyyy (pass-through for anything else) */
function fmtMmDdYyyy(v = '') {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  const [, yyyy, mm, dd] = m;
  return `${mm}/${dd}/${yyyy}`;
}

/* ---------- Small UI helpers ---------- */
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

function EventDates({ event }) {
  if (!event) return null;
  const { startDate, endDate, startTime, endTime } = event;
  return (
    <div className="text-xs text-gray-700">
      <span className="font-medium">From:</span> {fmtMmDdYyyy(startDate)}{' '}
      {startTime || ''} <span className="font-medium ml-2">To:</span>{' '}
      {fmtMmDdYyyy(endDate)} {endTime || ''}
    </div>
  );
}

function VehicleCard({ vehicle, statusById, handleSelectVehicle, ...rest }) {
  function getBg() {
    if (vehicle.status === AVAILABLE) {
      return vehicle.clean ? 'bg-green-200' : 'bg-red-200';
    }
    if (vehicle.status === PARKED) return 'bg-blue-200';
    if (vehicle.status === OFF_LOT) return 'bg-gray-50';
    return 'bg-gray-50';
  }

  return (
    <div
      onClick={() => handleSelectVehicle(vehicle)}
      className={`rounded-2xl shadow ${getBg()} grid grid-cols-4 overflow-hidden`}
      {...rest}
    >
      <div>
        <div className="w-full aspect-square">
          <img
            src="https://i.abcnewsfe.com/a/f43853f3-9eaf-4048-9ae7-757332c5787e/mclaren-1-ht-gmh-240412_1712928561648_hpMain_16x9.jpg?w=992"
            alt="placeholder"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="col-span-3 p-3">
        <div className="flex justify-between leading-tight">
          <div className="">
            <div className="font-medium">
              {vehicle.make} {vehicle.model}
            </div>
          </div>
          <div className="font-semibold whitespace-nowrap text-end">
            {vehicle.licenseNo}
          </div>
        </div>

        <div className="text-xs text-gray-500">Vehicle class</div>

        {/* Map all events */}
        <div className="w-full overflow-x-auto overflow-hidden">
          {vehicle.events?.length > 0 ? (
            <div className="mt-2 flex space-x-2 w-max">
              {vehicle.events.map((ev) => {
                const isOOS = String(ev.status || '').toLowerCase() === 'oos';
                const label = isOOS
                  ? ev.description || 'Out of service'
                  : ev.renterName || 'Unassigned';
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl bg-white/70 p-2 border border-gray-200"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">
                        {label}
                      </div>
                      <EventPill event={ev} statusById={statusById} />
                    </div>
                    <div className="mt-1">
                      <EventDates event={ev} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm mt-2 text-gray-600">Available</div>
          )}
        </div>
      </div>
    </div>
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

  // Enrich with ALL events for each vehicle (today-overlapping)
  const enrichedVehicles = useMemo(() => {
    if (!vehicles.length) return [];

    const activeEvents = vehicleEvents.filter(
      (ev) => ev.status !== 'W6TBsaDUeLB9R6POm9Hf'
    );

    // group events by vehicleId
    const byVehicle = activeEvents.reduce((acc, ev) => {
      const vid = ev.assignedVehicle;
      if (!vid) return acc;
      if (!acc[vid]) acc[vid] = [];
      acc[vid].push(ev);
      return acc;
    }, {});

    // sort events per vehicle: earliest startDate/time first
    Object.keys(byVehicle).forEach((vid) => {
      byVehicle[vid].sort((a, b) => {
        const aKey = `${a.startDate || ''} ${a.startTime || ''}`;
        const bKey = `${b.startDate || ''} ${b.startTime || ''}`;
        if (aKey === bKey) {
          const ae = `${a.endDate || ''} ${a.endTime || ''}`;
          const be = `${b.endDate || ''} ${b.endTime || ''}`;
          return ae.localeCompare(be);
        }
        return aKey.localeCompare(bKey);
      });
    });

    return vehicles.map((v) => {
      const evs = byVehicle[v.id] || [];
      // normalize each event for UI
      const normalized = evs.map((ev) => ({
        id: ev.id,
        status: ev.status, // 'oos' OR reservationStatus doc id
        renterName: ev.renterName || '',
        description: ev.description || '',
        startDate: ev.startDate || '',
        endDate: ev.endDate || '',
        startTime: ev.startTime || '',
        endTime: ev.endTime || '',
      }));

      // keep a renterName fallback for search
      const firstRes = normalized.find(
        (e) => String(e.status || '').toLowerCase() !== 'oos'
      );
      const renterFallback = firstRes?.renterName || v.renterName || '';

      return { ...v, renterName: renterFallback, events: normalized };
    });
  }, [vehicles, vehicleEvents]);

  // Search includes all event texts
  const base = useMemo(() => {
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

  // Grouping (kept simple)
  const { available, offLot } = useMemo(() => {
    const out = { available: [], offLot: [] };
    for (const v of base) {
      const status = v.status;
      if (status === AVAILABLE || status === PARKED) out.available.push(v);
      else if (status === OFF_LOT) out.offLot.push(v);
    }
    return out;
  }, [base]);

  const handleSelectVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    setOpenVehicleModal(true);
  };

  return (
    <DashboardLayout>
      <div className="p-4 bg-black min-h-screen">
        <div className="space-y-4">
          <div className="md:flex items-center justify-between md:space-x-2 space-y-3 md:space-y-0">
            <div className="flex space-x-2">
              <Button variant="defaultDark">
                <span className="whitespace-nowrap">
                  All ({available.length + offLot.length})
                </span>
              </Button>
              {locations.map((location) => (
                <Button key={location.id} variant="outlineDark">
                  {location.label}
                </Button>
              ))}
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* On Site */}
            <div className="space-y-2">
              <div className="font-semibold text-white">
                On site ({available.length})
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outlineDark" size="sm">
                  Available
                </Button>
                <Button variant="outlineDark" size="sm">
                  Not clean
                </Button>
                <Button variant="outlineDark" size="sm">
                  Reserved
                </Button>
                <Button variant="outlineDark" size="sm">
                  Out of service
                </Button>
              </div>
              {available.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  statusById={statusById}
                  handleSelectVehicle={handleSelectVehicle}
                />
              ))}
              {available.length === 0 && (
                <div className="text-sm text-slate-500">No vehicles</div>
              )}
            </div>

            {/* Off Lot */}
            <div className="space-y-2">
              <div className="font-semibold text-white">
                Off lot ({offLot.length})
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outlineDark" size="sm">
                  Rented
                </Button>
                <Button variant="outlineDark" size="sm">
                  Out of service
                </Button>
                <Button variant="outlineDark" size="sm">
                  Late
                </Button>
              </div>
              {offLot.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  statusById={statusById}
                  handleSelectVehicle={handleSelectVehicle}
                />
              ))}
              {offLot.length === 0 && (
                <div className="text-sm text-slate-500">No vehicles</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <VehicleModal
        open={openVehicleModal}
        onClose={() => setOpenVehicleModal(false)}
        vehicle={selectedVehicle}
        statusById={statusById}
      />
    </DashboardLayout>
  );
}

/* ---------- Modal ---------- */
function VehicleModal({ open, onClose, vehicle, statusById }) {
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
            Close
          </Button>
        </>
      }
    >
      <div className="mt-1 w-full aspect-[85.6/53.98] rounded-xl border border-gray-300 bg-gray-50 px-2"></div>

      {vehicle?.events?.length ? (
        <div className="space-y-3">
          <div className="font-semibold">Events for today</div>
          {vehicle.events.map((ev) => {
            const isOOS = String(ev.status || '').toLowerCase() === 'oos';
            const label = isOOS
              ? ev.description || 'Out of service'
              : ev.renterName || 'Unassigned';
            return (
              <div
                key={ev.id}
                className="rounded-md border border-gray-200 p-2"
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{label}</div>
                  <EventPill event={ev} statusById={statusById} />
                </div>
                <div className="mt-1">
                  <EventDates event={ev} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-600">
          No events overlapping today.
        </div>
      )}
    </Modal>
  );
}
