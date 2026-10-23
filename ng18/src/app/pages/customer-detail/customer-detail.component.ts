import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReportService } from '../../services/report.service';
import { formatRupiah, numClass, formatDateShort, typeBadgeClass } from '../../shared/format.utils';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-detail.component.html',
})
export class CustomerDetailComponent implements OnInit {
  supplierId = '';
  dbName = '';
  startDate = '';
  endDate = '';
  lastPaymentDate = '';

  data: any[] = [];
  filtered: any[] = [];
  summary: any = {};
  filter: any = {};
  query = '';
  showQuery = false;

  loading = false;
  error = '';
  keyword = '';

  footTotals = { grn: 0, invoice: 0, payment: 0, balance: 0 };

  // History modal state
  historyRecords: any[] = [];
  historyTotal = 0;
  @ViewChild('historyModal') historyModalRef!: ElementRef;

  constructor(private route: ActivatedRoute, private reportService: ReportService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.supplierId = qp['id'] || 'AS.002';
      this.dbName = qp['dbName'] || 'EpixFIN_RMM';
      this.startDate = qp['startDate'] || '';
      this.endDate = qp['endDate'] || '';
      this.lastPaymentDate = qp['lastPaymentDate'] || this.endDate;
      this.fetchDetail();
    });
  }

  fetchDetail(): void {
    this.loading = true;
    this.error = '';
    this.reportService
      .getReportDetail(this.dbName, {
        supplierId: this.supplierId,
        startDate: this.startDate,
        endDate: this.endDate,
        lastPaymentDate: this.lastPaymentDate,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.dbName = res.requestedDb || this.dbName;
          this.filter = res.filter || {};
          this.query = res.query || '';
          this.summary = res.summary || {};
          this.data = res.data || [];
          this.applyFilter();
        },
        error: () => {
          this.loading = false;
          this.error = `Gagal mengambil data detail untuk Supplier ${this.supplierId} dari API.`;
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
            (item.Id && String(item.Id).toLowerCase().includes(kw)) ||
            (item.paymentId && String(item.paymentId).toLowerCase().includes(kw))
        )
      : this.data;

    let grn = 0;
    let invoice = 0;
    let payment = 0;
    let balance = 0;
    for (const item of this.filtered) {
      grn += Number(item.GrnAmount) || 0;
      invoice += Number(item.totalInv) || 0;
      payment += Number(item.totalPayment) || 0;
      balance += Number(item.balance) || 0;
    }
    this.footTotals = { grn, invoice, payment, balance };
  }

  fmt(n: any): string {
    return formatRupiah(n);
  }

  neg(n: any): string {
    return numClass(n);
  }

  dateStr(d: any): string {
    return formatDateShort(d);
  }

  badgeClass(typeId: any): string {
    return typeBadgeClass(typeId);
  }

  balanceClass(balAmt: number): string {
    if (balAmt < 0) return 'text-danger fw-bold';
    if (balAmt > 0) return 'fw-semibold';
    return 'text-muted';
  }

  showHistory(records: any[]): void {
    this.historyRecords = records || [];
    this.historyTotal = this.historyRecords.reduce((sum, h) => sum + (Number(h.InvAmt) || 0), 0);
    if (this.historyModalRef) {
      const modal = bootstrap.Modal.getOrCreateInstance(this.historyModalRef.nativeElement);
      modal.show();
    }
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
      alert('Tidak ada data transaksi untuk diexport.');
      return;
    }

    const exportData = this.data.map((item) => {
      const isGrn = item.TypeID === 'GRN';
      return {
        Tanggal: item.date ? new Date(item.date) : '',
        Type: item.TypeID || '',
        'Tranx ID': isGrn ? item.Id || '' : '',
        'Inv ID': !isGrn ? item.Id || '' : '',
        'Payment ID': item.paymentId || '',
        'GRN (Rp)': Number(item.GrnAmount) || 0,
        'Invoice (Rp)': Number(item.totalInv) || 0,
        'Payment (Rp)': Number(item.totalPayment) || 0,
        'Balance (Rp)': Number(item.balance) || 0,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detail Transaksi');

    const safeSupplierId = (this.supplierId || 'supplier').replace(/[^a-z0-9_-]/gi, '_');
    XLSX.writeFile(workbook, `detail-transaksi-${safeSupplierId}.xlsx`);
  }
}
