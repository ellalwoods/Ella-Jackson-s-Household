/** Simple line icons for the main sections, drawn in the current text colour. */
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const HomeIcon = () => <svg {...base}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></svg>;
export const WeekIcon = () => <svg {...base}><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 4v4M8 10v4M8 16v4" /></svg>;
export const FoodIcon = () => <svg {...base}><path d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" /><path d="M9 8.5c0-1.5 1-1.8 1-3.3M13.5 8.5c0-1.5 1-1.8 1-3.3" /></svg>;
export const MoneyIcon = () => <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.2c-.5-.8-1.4-1.2-2.6-1.2-1.6 0-2.6.8-2.6 1.9 0 2.7 5.4 1.4 5.4 4.2 0 1.2-1.1 1.9-2.8 1.9-1.3 0-2.3-.5-2.8-1.4M12 6.5V8M12 16v1.5" /></svg>;
export const CalendarIcon = () => <svg {...base}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
