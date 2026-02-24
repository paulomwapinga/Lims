const TIMEZONE = 'Africa/Nairobi';

export function getTodayStart(): string {
  const now = new Date();
  const eatDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));

  const year = eatDate.getFullYear();
  const month = eatDate.getMonth();
  const day = eatDate.getDate();

  const utcOffset = getTimezoneOffset();
  const eatMidnightInUTC = new Date(Date.UTC(year, month, day, 0, 0, 0) - utcOffset);

  return eatMidnightInUTC.toISOString();
}

export function getDateStart(date: Date): string {
  const eatDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));

  const year = eatDate.getFullYear();
  const month = eatDate.getMonth();
  const day = eatDate.getDate();

  const utcOffset = getTimezoneOffset();
  const eatMidnightInUTC = new Date(Date.UTC(year, month, day, 0, 0, 0) - utcOffset);

  return eatMidnightInUTC.toISOString();
}

export function getDateEnd(date: Date): string {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return getDateStart(nextDay);
}

export function getCurrentDateTime(): string {
  return new Date().toISOString();
}

export function formatDateTimeForInput(date: Date): string {
  const eatDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const year = eatDate.getFullYear();
  const month = String(eatDate.getMonth() + 1).padStart(2, '0');
  const day = String(eatDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimezoneOffset(): number {
  return 3 * 60 * 60 * 1000;
}

export function getTimezoneInfo() {
  return {
    timezone: TIMEZONE,
    name: 'East Africa Time',
    abbreviation: 'EAT',
    offset: '+03:00'
  };
}
