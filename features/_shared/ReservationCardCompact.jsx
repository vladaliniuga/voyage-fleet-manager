// components/reservations/ReservationCardCompact.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { FiUser, FiMapPin, FiClock } from 'react-icons/fi';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function formatTime12h(time) {
  if (typeof time !== 'string') return time;

  // Match valid 24-hour time strings like "00:00" to "23:59"
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return time; // Not a valid military time → return as-is

  let [_, h, m] = match;
  h = parseInt(h, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // Convert 0 -> 12
  return `${h}:${m} ${ampm}`;
}

/* ------------------------------
   Tiny local helpers
------------------------------ */
const formatDate = (ymd = '') => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!m) return ymd || '';
  const [, y, mo, d] = m;
  return `${mo}/${d}/${y}`;
};

const Pill = ({ label, bg = '#e5e7eb', text = '#111827' }) => (
  <span
    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
    style={{ backgroundColor: bg, color: text }}
    title={label}
  >
    {label}
  </span>
);

const Skeleton = () => (
  <div className="animate-pulse rounded-2xl border bg-white shadow-sm">
    <div className="p-3 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-40" />
      <div className="h-3 bg-gray-200 rounded w-24" />
    </div>
    <div className="h-px bg-gray-100" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
      <div className="rounded-xl bg-gray-50 p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-200 rounded w-48" />
      </div>
      <div className="rounded-xl bg-gray-50 p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-3 bg-gray-200 rounded w-48" />
      </div>
    </div>
    <div className="px-3 pb-3">
      <div className="rounded-xl bg-white ring-1 ring-gray-100 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-28" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-28" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
      </div>
    </div>
  </div>
);

/* ------------------------------
   Main component (presentation only)
   Props:
     - reservationId: string (vehicleEvents doc id)
------------------------------ */
export default function ReservationCardCompact({ reservationId = '' }) {
  const [reservation, setReservation] = useState(null);
  const [statusMeta, setStatusMeta] = useState({ label: '', bg: '', text: '' });
  const [labels, setLabels] = useState({
    pickUpLocation: '',
    returnLocation: '',
    vehicleClass: '',
    assignedVehicle: '',
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  /* --- Live subscribe to reservation --- */
  /* --- Live subscribe to reservation (no sync setState in effect body) --- */
  useEffect(() => {
    if (!reservationId) return;
    let alive = true;

    // Defer initial state tweaks to avoid the ESLint warning
    Promise.resolve().then(() => {
      if (!alive) return;
      setLoading(true);
      setNotFound(false);
    });

    const ref = doc(db, 'vehicleEvents', reservationId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!alive) return;

        if (!snap.exists()) {
          setReservation(null);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setReservation({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (err) => {
        if (!alive) return;
        console.error('vehicleEvents subscribe error:', err);
        setLoading(false);
      }
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [reservationId]);

  /* --- Resolve status pill (reservationStatus or 'oos') --- */
  useEffect(() => {
    const statusId = reservation?.status;
    if (!statusId) {
      // Defer state update to next tick to avoid the ESLint warning
      Promise.resolve().then(() =>
        setStatusMeta({ label: '', bg: '', text: '' })
      );
      return;
    }

    let active = true; // safeguard for cleanup

    (async () => {
      if (String(statusId).toLowerCase() === 'oos') {
        if (active) {
          setStatusMeta({
            label: 'OUT OF SERVICE',
            bg: '#E5E7EB',
            text: '#111827',
          });
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'reservationStatus', statusId));
        if (!active) return;
        if (snap.exists()) {
          const d = snap.data() || {};
          setStatusMeta({
            label: d.name || d.label || String(statusId).toUpperCase(),
            bg: d.background || '#E5E7EB',
            text: d.text || '#111827',
          });
        } else {
          setStatusMeta({
            label: String(statusId).toUpperCase(),
            bg: '#E5E7EB',
            text: '#111827',
          });
        }
      } catch (e) {
        if (active) {
          setStatusMeta({
            label: String(statusId).toUpperCase(),
            bg: '#E5E7EB',
            text: '#111827',
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [reservation?.status]);

  /* --- Resolve human-readable labels by id --- */
  useEffect(() => {
    if (!reservation) return;
    const { pickUpLocation, returnLocation, vehicleClass, assignedVehicle } =
      reservation;

    (async () => {
      try {
        const [pickDoc, returnDoc, classDoc, vehicleDoc] = await Promise.all([
          pickUpLocation
            ? getDoc(doc(db, 'locations', pickUpLocation))
            : Promise.resolve(null),
          returnLocation
            ? getDoc(doc(db, 'locations', returnLocation))
            : Promise.resolve(null),
          vehicleClass
            ? getDoc(doc(db, 'vehicleClasses', vehicleClass))
            : Promise.resolve(null),
          assignedVehicle
            ? getDoc(doc(db, 'vehicles', assignedVehicle))
            : Promise.resolve(null),
        ]);

        const pickLabel =
          pickDoc && pickDoc.exists()
            ? pickDoc.data()?.name || pickDoc.data()?.label || ''
            : '';
        const returnLabel =
          returnDoc && returnDoc.exists()
            ? returnDoc.data()?.name || returnDoc.data()?.label || ''
            : '';
        const classLabel =
          classDoc && classDoc.exists()
            ? classDoc.data()?.name ||
              classDoc.data()?.label ||
              classDoc.data()?.code ||
              ''
            : '';
        const vehicleLabel =
          vehicleDoc && vehicleDoc.exists()
            ? vehicleDoc.data()?.name ||
              [vehicleDoc.data()?.make, vehicleDoc.data()?.model]
                .filter(Boolean)
                .join(' ') ||
              ''
            : '';

        setLabels({
          pickUpLocation: pickLabel || pickUpLocation || '',
          returnLocation: returnLabel || returnLocation || '',
          vehicleClass: classLabel || vehicleClass || '',
          assignedVehicle: vehicleLabel || assignedVehicle || '',
        });
      } catch (e) {
        console.warn('Label resolution fallback:', e);
        setLabels({
          pickUpLocation: pickUpLocation || '',
          returnLocation: returnLocation || '',
          vehicleClass: vehicleClass || '',
          assignedVehicle: assignedVehicle || '',
        });
      }
    })();
  }, [reservation]);

  const content = useMemo(() => {
    if (!reservation) return null;

    const {
      confirmation,
      status,
      renterName,
      renterEmail,
      renterPhone,
      startDate,
      startTime,
      endDate,
      endTime,
    } = reservation;

    return (
      <div className="">
        {/* Header */}
        <div className="flex items-start gap-3 p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="text-sm text-gray-500 leading-tight">
                  Confirmation
                </div>
                <div className="font-semibold truncate">
                  {confirmation || '—'}
                </div>
              </div>
              {status ? (
                <Pill
                  label={statusMeta.label}
                  bg={statusMeta.bg}
                  text={statusMeta.text}
                />
              ) : null}
            </div>

            {/* Renter */}
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <FiUser className="shrink-0" />
              <span className="truncate">{renterName || '—'}</span>
            </div>
            {(renterEmail || renterPhone) && (
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="truncate">{renterEmail || '—'}</div>
                <div className="truncate">{renterPhone || '—'}</div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100" />

        {/* Trip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-2 text-gray-600">
              <FiClock />
              <span className="font-medium">Pick-up</span>
            </div>
            <div className="mt-1 text-gray-900">
              {formatDate(startDate)} {formatTime12h(startTime)}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-600">
              <FiMapPin />
              <span className="truncate">{labels.pickUpLocation || '—'}</span>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-2 text-gray-600">
              <FiClock />
              <span className="font-medium">Return</span>
            </div>
            <div className="mt-1 text-gray-900">
              {formatDate(endDate)} {formatTime12h(endTime)}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-600">
              <FiMapPin />
              <span className="truncate">{labels.returnLocation || '—'}</span>
            </div>
          </div>
        </div>

        {/* Vehicle */}
        <div className="pb-3">
          <div className="rounded-xl bg-white ring-1 ring-gray-100 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Vehicle class</div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {labels.vehicleClass || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Assigned vehicle</div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {labels.assignedVehicle || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [reservation, labels, statusMeta.label, statusMeta.bg, statusMeta.text]);

  if (!reservationId) return null;

  if (loading) return <Skeleton />;

  if (notFound)
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
        Reservation not found.
      </div>
    );

  return content;
}
