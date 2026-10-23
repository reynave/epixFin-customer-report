import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ReportService } from '../../services/report.service';
import { formatRupiah, formatDateShort } from '../../shared/format.utils';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './journal.component.html',
  styleUrl: './journal.component.css',
})
export class JournalComponent implements OnInit {
  dbName = '';
  startDate = '2026-01-01';
  endDate = '2026-01-31';

  data: any[] = [];
  filter = { startDate: '', endDate: '' };
  totalAmount = 0;
  loading = false;
  error = '';
  loadingAmount = false;
  amountProgress = '';

  constructor(private route: ActivatedRoute, private reportService: ReportService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.dbName = qp['dbName'] || 'EpixFIN_RMM';
      this.startDate = qp['startDate'] || '2026-01-01';
      this.endDate = qp['endDate'] || '2026-01-31';
      this.fetchJournal();
    });
  }

  fetchJournal(): void {
    this.error = '';
    if (!this.startDate || !this.endDate) {
      this.data = [];
      this.error = 'Silakan isi Start Date dan End Date terlebih dahulu.';
      return;
    }

    this.loading = true;
    this.reportService
      .getJournalAp(this.dbName, { startDate: this.startDate, endDate: this.endDate })
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.status === 'error') {
            this.error = res.error || 'Terjadi kesalahan pada server.';
            this.data = [];
            return;
          }
          this.dbName = res.requestedDb || this.dbName;
          this.filter = res.filter || { startDate: this.startDate, endDate: this.endDate };
          this.data = res.result || [];
          this.totalAmount = this.data.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        },
        error: () => {
          this.loading = false;
          this.error = 'Gagal mengambil data dari server.';
          this.data = [];
        },
      });
  }

  fmt(n: any): string {
    return formatRupiah(n);
  }

  dateStr(d: any): string {
    return formatDateShort(d);
  }

  prefixLabel(p: any): string {
    if (p === 'APR') return 'GRN';
    if (p === 'API') return 'Invoice';
    if (p === 'APP') return 'Payment';
    return p || '-';
  }

  prefixBadgeClass(p: any): string {
    if (p === 'APR') return 'bg-info-subtle text-info border border-info-subtle';
    if (p === 'API') return 'bg-primary-subtle text-primary border border-primary-subtle';
    if (p === 'APP') return 'bg-success-subtle text-success border border-success-subtle';
    return 'bg-light text-dark border';
  }

  goBack(): void {
    history.back();
  }

  print(): void {
    window.print();
  }

  exportToExcel(): void {
    const exportData = this.buildExportData();
    if (!exportData.length) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 14 }, // Tanggal
      { wch: 10 }, // Prefix
      { wch: 12 }, // Type
      { wch: 28 }, // ID
      { wch: 30 }, // Supplier
      { wch: 16 }, // ID Supplier
      { wch: 16 }, // Amount
      { wch: 16 }, // Debit
      { wch: 16 }, // Credit
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jurnal AP');
    XLSX.writeFile(workbook, this.buildFileName('xlsx'));
  }

  exportToCsv(): void {
    const exportData = this.buildExportData();
    if (!exportData.length) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    this.downloadText(csv, this.buildFileName('csv'), 'text/csv;charset=utf-8;');
  }

  private buildExportData(): any[] {
    return this.data.map((r) => ({
      Tanggal: this.dateStr(r.date),
      Prefix: r.prefix || '',
      Type: this.prefixLabel(r.prefix),
      ID: r.id || '',
      Supplier: r.SupplierName || '',
      'ID Supplier': r.SupplierID || '',
      Amount: Number(r.amount) || 0,
      Debit: r.amountLoaded ? Number(r.debit) || 0 : '',
      Credit: r.amountLoaded ? Number(r.credit) || 0 : '',
    }));
  }

  private buildFileName(ext: string): string {
    const db = (this.dbName || 'EpixFIN_RMM').replace(/[^a-z0-9_-]/gi, '_');
    const s = (this.startDate || '').replace(/[^0-9-]/g, '');
    const e = (this.endDate || '').replace(/[^0-9-]/g, '');
    return `jurnal-ap-${db}-${s}-${e}.${ext}`;
  }

  private downloadText(content: string, filename: string, mime: string): void {
    const blob = new Blob(['\uFEFF' + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Waterfall: panggil getJournalAmount satu per satu (berurutan) untuk tiap baris,
  // lalu isi debit & credit ke baris tersebut.
  async loadJournalAmounts(): Promise<void> {
    if (!this.data.length) {
      return;
    }

    this.loadingAmount = true;
    this.amountProgress = '';

    const total = this.data.length;
    for (let i = 0; i < total; i++) {
      const item = this.data[i];

      if (!item.id || !item.prefix) {
        item.debit = 0;
        item.credit = 0;
        item.amountLoaded = true;
        continue;
      }

      item.amountLoading = true;
      item.amountError = false;
      this.amountProgress = `Memproses ${i + 1} / ${total}: ${item.id || '-'}`;

      try {
        const res = await firstValueFrom(
          this.reportService.getJournalAmount(this.dbName, {
            id: item.id,
            prefix: item.prefix,
          })
        );

        const rows = res.result || [];
        let debit = 0;
        let credit = 0;
        for (const row of rows) {
          debit += this.pickDebit(row);
          credit += this.pickCredit(row);
        }

        item.debit = debit;
        item.credit = credit;
        item.amountLoaded = true;
        item.amountLoading = false;
      } catch (err) {
        item.amountLoading = false;
        item.amountLoaded = true;
        item.amountError = true;
      }
    }

    this.loadingAmount = false;
    this.amountProgress = `Selesai: ${total} baris diproses.`;
  }

  private toNum(v: any): number {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  // Nama kolom debit/credit pada FinJurnalVoucher belum final,
  // jadi dicoba beberapa kemungkinan. Sesuaikan jika nama kolom berbeda.
  private pickDebit(row: any): number {
    const val = row.Debit ?? row.debit ?? row.Debet ?? row.DebitAmount ?? row.DebitAmt;
    return this.toNum(val);
  }

  private pickCredit(row: any): number {
    const val = row.Credit ?? row.credit ?? row.Kredit ?? row.CreditAmount ?? row.CreditAmt;
    return this.toNum(val);
  }
}

