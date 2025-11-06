/* eslint-disable @next/next/no-img-element */
import { useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const CLOSED_STATUS_ID = 'W6TBsaDUeLB9R6POm9Hf';

// Respect the "show closed" toggle
function filterEventsByClosed(allEvents = [], showClosed) {
  if (showClosed) return allEvents;
  return allEvents.filter(
    (e) =>
      String(e?.status || '').toLowerCase() === 'oos' ||
      e?.status !== CLOSED_STATUS_ID
  );
}

export default function VehicleModal({
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
