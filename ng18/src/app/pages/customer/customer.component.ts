import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReportService } from '../../services/report.service';
import { formatRupiah, numClass } from '../../shared/format.utils';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer.component.html',
})
export class CustomerComponent implements OnInit {
  dbName = '';
  startDate = '';
  endDate = '';
  lastPaymentDate = '';

  data: any[] = [];
  filtered: any[] = [];
  summary: any = {};
  total = 0;
  query = '';
  showQuery = false;

  loading = false;
  error = '';
  keyword = '';

  footTotals = { saldoAwal: 0, grn: 0, invoice: 0, paid: 0, result: 0 };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.dbName = qp['dbName'] || 'EpixFIN_RMM';
      this.startDate = qp['startDate'] || '';
      this.endDate = qp['endDate'] || '';
      this.lastPaymentDate = qp['lastPaymentDate'] || this.endDate;
      this.fetchReport();
    });
  }

  fetchReport(): void {
    this.loading = true;
    this.error = '';
    this.reportService
      .getReportPage(this.dbName, {
        startDate: this.startDate,
        endDate: this.endDate,
        lastPaymentDate: this.lastPaymentDate,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.dbName = res.requestedDb || this.dbName;
          this.query = res.q || '';
          this.summary = res.summary || {};
          this.total = res.total || 0;
          this.data = res.data || [];
          this.applyFilter();
        },
        error: () => {
          this.loading = false;
          this.error = 'Gagal mengambil data dari server.';
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
            (item.SupplierName && item.SupplierName.toLowerCase().includes(kw)) ||
            (item.SupplierID && item.SupplierID.toLowerCase().includes(kw))
        )
      : this.data;

    let saldoAwal = 0;
    let grn = 0;
    let invoice = 0;
    let paid = 0;
    let result = 0;
    for (const item of this.filtered) {
      saldoAwal += Number(item.saldoAwal) || 0;
      grn += Number(item.totalGRN ?? item.GrnAmount ?? 0);
      invoice += Number(item.totalInv) || 0;
      paid += Number(item.totalPayment) || 0;
      result += Number(item.balance) || 0;
    }
    this.footTotals = { saldoAwal, grn, invoice, paid, result };
  }

  fmt(n: any): string {
    return formatRupiah(n);
  }

  neg(n: any): string {
    return numClass(n);
  }

  statusLabel(balance: number): string {
    if (balance === 0) return 'Lunas';
    return balance > 0 ? 'Sisa Utang' : 'Lebih Bayar';
  }

  statusClass(balance: number): string {
    if (balance === 0) return 'bg-success-subtle text-success border border-success-subtle rounded-pill';
    if (balance > 0) return 'bg-warning-subtle text-warning border border-warning-subtle rounded-pill';
    return 'bg-danger-subtle text-danger border border-danger-subtle rounded-pill';
  }

  resultClass(balance: number): string {
    return balance < 0 ? 'text-danger fw-bold' : '';
  }

  saldoAwalClass(saldoAwal: number): string {
    if (saldoAwal === 0) return 'text-muted';
    return saldoAwal > 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
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

  goToDetailAll(): void {
    this.router.navigate(['/customer-detail-all'], {
      queryParams: {
        dbName: this.dbName,
        startDate: this.startDate,
        endDate: this.endDate,
        lastPaymentDate: this.lastPaymentDate,
      },
    });
  }

  goToNextMonth(): void {
    const base = this.startDate ? new Date(this.startDate + 'T00:00:00') : new Date();
    const firstDay = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 2, 0);

    const startDate = this.toYmd(firstDay);
    const endDate = this.toYmd(lastDay);

    this.router.navigate(['/customer'], {
      queryParams: {
        dbName: this.dbName,
        startDate,
        endDate,
        lastPaymentDate: endDate,
      },
    });
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  exportToExcel(): void {
    if (!this.data.length) {
      alert('Tidak ada data supplier untuk diexport.');
      return;
    }

    const exportData = this.data.map((item) => {
      const saldoAwal = Number(item.saldoAwal) || 0;
      const totalGrn = Number(item.totalGRN ?? item.GrnAmount ?? 0);
      const totalInv = Number(item.totalInv) || 0;
      const totalPayment = Number(item.totalPayment) || 0;
      const balance = Number(item.balance) || 0;

      return {
        Supplier: item.SupplierName || '',
        'ID Supplier': item.SupplierID || '',
        'Saldo Awal': saldoAwal,
        'Total GRN': totalGrn,
        'Total Invoice': totalInv,
        'Total Payment': totalPayment,
        Balance: balance,
        Status: balance === 0 ? 'Lunas' : balance > 0 ? 'Sisa Utang' : 'Lebih Bayar',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Utang');

    const safeDbName = (this.dbName || 'EpixFIN_RMM').replace(/[^a-z0-9_-]/gi, '_');
    XLSX.writeFile(workbook, `laporan-utang-supplier-${safeDbName}.xlsx`);
  }
}
