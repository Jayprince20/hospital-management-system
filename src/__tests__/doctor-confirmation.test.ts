import { describe, expect, it } from 'vitest';
import type { Appointment } from '@/lib/api';
import { confirmationBadge } from '@/lib/patient-extras';
import { pendingBookings } from '@/components/confirmation/pending-bookings';

const booking = (id: string, appointmentDate: string, startTime: string, status = 'SCHEDULED') =>
  ({ id, appointmentDate, startTime, status }) as unknown as Appointment;

describe('doctor confirmation', () => {
  const now = new Date(2026, 10, 26, 15, 30);

  it('lists only scheduled bookings that have not started, soonest first', () => {
    const list = pendingBookings(
      [
        booking('later', '2026-12-03', '10:00'),
        booking('started', '2026-11-26', '15:00'),
        booking('confirmed', '2026-11-27', '09:00', 'CONFIRMED'),
        booking('tonight', '2026-11-26', '17:00'),
        booking('tomorrow', '2026-11-27', '08:30'),
      ],
      now
    );
    expect(list.map((a) => a.id)).toEqual(['tonight', 'tomorrow', 'later']);
  });

  it('shows who confirmed: the doctor', () => {
    expect(confirmationBadge({ status: 'CONFIRMED', confirmedAt: '2026-11-26T14:00:00Z', confirmationChannel: 'DOCTOR' }, now)).toBe('DOCTOR');
  });
});
