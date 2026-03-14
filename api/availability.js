// Google Calendar availability check
// Returns simple available/busy status without revealing schedule details.
//
// ENV VARS:
//   GOOGLE_CALENDAR_ID    = your calendar ID (e.g. primary or email@gmail.com)
//   GOOGLE_CALENDAR_KEY   = Google API key with Calendar API enabled
//
// Setup: console.cloud.google.com → APIs → Enable "Google Calendar API"
//        → Credentials → Create API Key (restrict to Calendar API)
//        → Calendar must be set to "See all event details" or "See only free/busy"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const apiKey = process.env.GOOGLE_CALENDAR_KEY;

  if (!calendarId || !apiKey) {
    // Fallback to availability.json status if no calendar configured
    return res.status(200).json({
      available: null,
      source: 'manual',
      note: 'Calendar not configured. Using manual availability status.'
    });
  }

  try {
    // Check if busy in the next 2 hours
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const url = `https://www.googleapis.com/calendar/v3/freeBusy?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: twoHoursLater.toISOString(),
        items: [{ id: calendarId }]
      })
    });

    if (!response.ok) {
      return res.status(200).json({
        available: null,
        source: 'calendar-error',
        note: 'Could not check calendar'
      });
    }

    const data = await response.json();
    const busySlots = data.calendars?.[calendarId]?.busy || [];

    // Only return available/not available. No schedule details.
    return res.status(200).json({
      available: busySlots.length === 0,
      source: 'google-calendar',
      // Deliberately no details about what the events are
      note: busySlots.length === 0
        ? 'Available right now'
        : 'Currently not available'
    });

  } catch (e) {
    return res.status(200).json({
      available: null,
      source: 'error',
      note: 'Could not check availability'
    });
  }
}
