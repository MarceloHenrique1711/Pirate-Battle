export function formatDuration(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function formatDate(date: string): string {
  const value = new Date(date);
  return `${String(value.getDate()).padStart(2, '0')} ${value.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} · ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}
