// Helper format yang dipakai bersama di seluruh halaman laporan.
// Semua fungsi sengaja menerima `any` karena shape response API belum final.

export function formatRupiah(number: any): string {
  if (number === null || number === undefined) return '0';
  const n = Number(number);
  if (isNaN(n)) return '0';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
}

export function numClass(value: any): string {
  return Number(value) < 0 ? 'text-danger fw-semibold' : '';
}

export function formatDateShort(dateString: any): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function typeBadgeClass(typeId: any): string {
  if (typeId === 'GRN') return 'bg-info-subtle text-info border border-info-subtle';
  if (typeId === 'INV') return 'bg-primary-subtle text-primary border border-primary-subtle';
  if (typeId === 'PAYMENT') return 'bg-success-subtle text-success border border-success-subtle';
  return 'bg-light text-dark border';
}

export const MONTH_NAMES: string[] = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function monthLabel(year: any, month: any): string {
  const idx = (Number(month) || 1) - 1;
  const name = MONTH_NAMES[idx] || ('Bulan ' + month);
  return name + ' ' + (year || '');
}

// Untuk laporan yearly: nilai kosong ditampilkan sebagai '-' (bukan 0).
export function formatMoney(value: any): string {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (isNaN(n)) return '-';
  return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
}
