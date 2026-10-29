import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReportService } from '../../services/report.service';
import { formatRupiah, numClass } from '../../shared/format.utils';

@Component({
  selector: 'app-saldo-awal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './saldo-awal.component.html',
})
export class SaldoAwalComponent implements OnInit {
  dbName = '';
  startDate = '';
  endDate = '';
  lastPaymentDate = '';

  data: any[] = [];
  filtered: any[] = [];
  totalSaldo = 0;
  loading = false;
  error = '';
  keyword = '';
  query = '';
  showQuery = false;

  constructor(private route: ActivatedRoute, private reportService: ReportService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.dbName = qp['dbName'] || 'EpixFIN_RMM';
      this.startDate = qp['startDate'] || '';
      this.endDate = qp['endDate'] || '';
      this.lastPaymentDate = qp['lastPaymentDate'] || this.endDate;
      this.fetchSaldoAwal();
    });
  }

  fetchSaldoAwal(): void {
    this.loading = true;
    this.error = '';
    this.reportService
      .getSaldoAwal(this.dbName, {
        startDate: this.startDate,
        endDate: this.endDate,
        lastPaymentDate: this.lastPaymentDate,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.dbName = res.requestedDb || this.dbName;
          this.query = res.q || '';
          this.data = res.data || [];
          this.totalSaldo = this.data.reduce(
            (sum, r) => sum + (Number(r['saldo awal']) || 0),
            0
          );
          this.applyFilter();
        },
        error: () => {
          this.loading = false;
          this.error = 'Gagal mengambil data saldo awal dari API.';
          this.data = [];
          this.filtered = [];
        },
      });
  }

  applyFilter(): void {
    const kw = this.keyword.toLowerCase().trim();
    this.filtered = kw
      ? this.data.filter(
          (item) =>
            (item.accountName && String(item.accountName).toLowerCase().includes(kw)) ||
            (item.ApAcc && String(item.ApAcc).toLowerCase().includes(kw)) ||
            (item.ApAccId && String(item.ApAccId).toLowerCase().includes(kw))
        )
      : this.data;
  }

  fmt(n: any): string {
    return formatRupiah(n);
  }

  saldoClass(n: any): string {
    return numClass(n);
  }

  goBack(): void {
    history.back();
  }

  print(): void {
    window.print();
  }

  toggleQuery(): void {
    this.showQuery = !this.showQuery;
  }

  exportToExcel(): void {
    if (!this.data.length) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const exportData = this.data.map((item) => ({
      'ID Account': item.ApAccId || '',
      'Kode Account': item.ApAcc || '',
      'Nama Account': item.accountName || '',
      'Saldo Awal': Number(item['saldo awal']) || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 16 }, // ID Account
      { wch: 20 }, // Kode Account
      { wch: 30 }, // Nama Account
      { wch: 18 }, // Saldo Awal
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Saldo Awal');

    const safeDbName = (this.dbName || 'EpixFIN_RMM').replace(/[^a-z0-9_-]/gi, '_');
    XLSX.writeFile(workbook, `saldo-awal-${safeDbName}.xlsx`);
  }
}
