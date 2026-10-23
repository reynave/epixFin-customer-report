import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReportService } from '../../services/report.service';
import { formatMoney, monthLabel } from '../../shared/format.utils';

@Component({
  selector: 'app-yearly',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './yearly.component.html',
})
export class YearlyComponent implements OnInit {
  dbName = '';
  startDate = '2026-01-01';
  endDate = '2026-12-31';

  data: any[] = [];
  loading = false;
  error = '';
  filter = { startDate: '', endDate: '' };
  totals = { grn: 0, invoice: 0, payment: 0, balance: 0 };

  constructor(private route: ActivatedRoute, private reportService: ReportService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.dbName = qp['dbName'] || 'EpixFIN_RMM';
      this.fetchYearly();
    });
  }

  fetchYearly(): void {
    this.error = '';
    if (!this.startDate || !this.endDate) {
      this.data = [];
      this.error = 'Silakan isi Start Date dan End Date terlebih dahulu.';
      return;
    }

    this.loading = true;
    this.reportService
      .getYearly(this.dbName, { startDate: this.startDate, endDate: this.endDate })
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
          this.data = res.data || [];
          this.computeTotals();
        },
        error: () => {
          this.loading = false;
          this.error = 'Gagal mengambil data dari server.';
          this.data = [];
        },
      });
  }

  computeTotals(): void {
    let grn = 0;
    let invoice = 0;
    let payment = 0;
    let balance = 0;
    for (const item of this.data) {
      grn += this.toNumber(item.GrnAmount);
      invoice += this.toNumber(item.totalInv);
      payment += this.toNumber(item.totalPayment);
      balance += this.toNumber(item.balance);
    }
    this.totals = { grn, invoice, payment, balance };
  }

  toNumber(value: any): number {
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  }

  money(value: any): string {
    return formatMoney(value);
  }

  label(item: any): string {
    return monthLabel(item.Year, item.Month);
  }

  balanceClass(item: any): string {
    if (item.balance === null || item.balance === undefined || item.balance === '') return 'text-muted';
    const b = Number(item.balance);
    if (b > 0) return 'text-success fw-semibold';
    if (b < 0) return 'text-danger fw-semibold';
    return '';
  }

  resetFilter(): void {
    this.startDate = '2026-01-01';
    this.endDate = '2026-12-31';
    this.fetchYearly();
  }

  goBack(): void {
    history.back();
  }

  print(): void {
    window.print();
  }

  exportToExcel(): void {
    if (!this.data || this.data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const exportData = this.data.map((item) => ({
      Tahun: item.Year || '',
      Bulan: this.label(item),
      'GRN Amount': item.GrnAmount,
      'Total Invoice': item.totalInv,
      'Total Payment': item.totalPayment,
      Balance: item.balance,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Tahunan');

    const safeDbName = (this.dbName || 'EpixFIN_RMM').replace(/[^a-z0-9_-]/gi, '_');
    XLSX.writeFile(workbook, `laporan-tahunan-${safeDbName}.xlsx`);
  }
}
