/* eslint-disable @next/next/no-img-element */
import { useMemo } from 'react';

const now = Date.now();

/** Firestore Timestamp/seconds/number -> ms */
function tsToMillis(v) {
  if (typeof v === 'number') return v;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && typeof v.seconds === 'number') return v.seconds * 1000;
  return NaN;
}

function ymdToMdy(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null; // not strictly yyyy-mm-dd
  const [, yyyy, mm, dd] = m;
  // Basic sanity check (01–12, 01–31). For full validation, parse as a Date.
  const M = Number(mm),
    D = Number(dd);
  if (M < 1 || M > 12 || D < 1 || D > 31) return null;
  return `${mm}/${dd}/${yyyy}`;
}

const CLOSED_STATUS_ID = 'W6TBsaDUeLB9R6POm9Hf';

const locationMap = {
  '5czwtumKOwNiRLtfVNDw': 'Airport',
  dDuHdE9wXNVDtoKcNxhQ: 'Waikiki',
};

// Respect the "show closed" toggle
function filterEventsByClosed(allEvents = [], showClosed) {
  if (showClosed) return allEvents;
  return allEvents.filter(
    (e) =>
      String(e?.status || '').toLowerCase() === 'oos' ||
      e?.status !== CLOSED_STATUS_ID
  );
}

export default function VehicleCard({
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
            {ymdToMdy(evt?.startDate)} {evt?.startTime}
          </div>
        </div>
        <div className="">
          <div className="text-xs uppercase font-semibold">Return</div>
          <div className="text-xs">{locationMap[evt?.returnLocation]}</div>
          <div className="text-xs">
            {ymdToMdy(evt?.endDate)} {evt?.endTime}
          </div>
        </div>
      </div>
    </div>
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
