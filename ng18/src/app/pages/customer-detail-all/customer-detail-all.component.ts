import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ReportService } from '../../services/report.service';
import { formatRupiah, numClass, formatDateShort, typeBadgeClass } from '../../shared/format.utils';

@Component({
  selector: 'app-customer-detail-all',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-detail-all.component.html',
})
export class CustomerDetailAllComponent implements OnInit {
  dbName = '';
  startDate = '';
  endDate = '';
  lastPaymentDate = '';

  data: any[] = [];
  filtered: any[] = [];
  keyword = '';

  loading = false;
  error = '';
  processing = false;
  progress = '';

  grandTotals = { saldoAwal: 0, totalInvoice: 0, totalPayment: 0, totalBalance: 0 };

  constructor(private route: ActivatedRoute, private reportService: ReportService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.dbName = qp['dbName'] || 'EpixFIN_RMM';
      this.startDate = qp['startDate'] || '';
      this.endDate = qp['endDate'] || '';
      this.lastPaymentDate = qp['lastPaymentDate'] || this.endDate;
      this.fetchList();
    });
  }

  fetchList(): void {
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
          this.data = (res.data || []).map((item: any) => ({
            ...item,
            saldoAwal: 0,
            summary: {},
            saldoAwalDetail: [],
            detailLoaded: false,
            loadingDetail: false,
            detailError: false,
            expanded: false,
          }));
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
  }

  async fetchAllDetails(): Promise<void> {
    if (!this.startDate) {
      alert('Isi Start Date terlebih dahulu.');
      return;
    }
    if (!this.data.length) {
      return;
    }

    this.processing = true;
    this.progress = '';
    this.grandTotals = { saldoAwal: 0, totalInvoice: 0, totalPayment: 0, totalBalance: 0 };

    const total = this.data.length;
    for (let i = 0; i < total; i++) {
      const item = this.data[i];
      item.loadingDetail = true;
      item.detailError = false;
      this.progress = `Memproses ${i + 1} / ${total}: ${item.SupplierID || '-'}`;

      try {
        const res = await firstValueFrom(
          this.reportService.getReportDetail(this.dbName, {
            supplierId: item.SupplierID,
            startDate: this.startDate,
            endDate: this.endDate,
            lastPaymentDate: this.lastPaymentDate,
          })
        );

        const detail = res.data || [];
        const summary = res.summary || {};
        item.saldoAwal = Number(summary.saldoAwal) || 0;
        item.summary = summary;
        item.saldoAwalDetail = detail;
        item.detailLoaded = true;
        item.loadingDetail = false;
        this.updateGrandTotals();
      } catch (err) {
        item.loadingDetail = false;
        item.detailError = true;
      }
    }

    this.processing = false;
    this.progress = `Selesai: ${total} supplier diproses.`;
  }

  updateGrandTotals(): void {
    const t = { saldoAwal: 0, totalInvoice: 0, totalPayment: 0, totalBalance: 0 };
    for (const item of this.data) {
      t.saldoAwal += Number(item.saldoAwal) || 0;
      t.totalInvoice += Number(item.summary?.totalInvoice) || 0;
      t.totalPayment += Number(item.summary?.totalPayment) || 0;
      t.totalBalance += Number(item.summary?.totalBalance) || 0;
    }
    this.grandTotals = t;
  }

  toggleDetail(item: any): void {
    item.expanded = !item.expanded;
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

  goBack(): void {
    history.back();
  }

  get exportReady(): boolean {
    return this.data.some((item) => item.detailLoaded);
  }

  exportToExcel(): void {
    const suppliersWithDetail = this.data.filter(
      (item) => item.detailLoaded && Array.isArray(item.saldoAwalDetail)
    );

    if (suppliersWithDetail.length === 0) {
      alert('Tarik data terlebih dahulu sebelum export.');
      return;
    }

    const aoa: any[][] = [];

    suppliersWithDetail.forEach((item) => {
      const detail = item.saldoAwalDetail || [];
      const s = item.summary || {};

      aoa.push([`Supplier: ${item.SupplierName || '-'} (${item.SupplierID || '-'})`]);
      aoa.push([`Saldo Awal: ${s.saldoAwal || 0}`]);
      aoa.push(['Tanggal', 'Type', 'Tranx ID', 'Inv ID', 'Payment ID', 'GRN', 'Invoice', 'Payment', 'Balance']);

      detail.forEach((r: any) => {
        const isGrn = r.TypeID === 'GRN';
        aoa.push([
          r.date ? new Date(r.date).toLocaleDateString('id-ID') : '',
          r.TypeID || '',
          isGrn ? r.Id || '' : '',
          !isGrn ? r.Id || '' : '',
          r.paymentId || '',
          Number(r.GrnAmount) || 0,
          Number(r.totalInv) || 0,
          Number(r.totalPayment) || 0,
          Number(r.balance) || 0,
        ]);
      });

      aoa.push(['', '', '', '', 'Total', s.totalGrn || 0, s.totalInvoice || 0, s.totalPayment || 0, s.totalBalance || 0]);
      aoa.push([]);
      aoa.push([]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detail Invoice');

    const safeDbName = (this.dbName || 'EpixFIN_RMM').replace(/[^a-z0-9_-]/gi, '_');
    XLSX.writeFile(workbook, `detail-all-${safeDbName}.xlsx`);
  }
}

