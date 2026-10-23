import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-list.component.html',
})
export class CustomerListComponent implements OnInit {
  dbName = '';
  data: any[] = [];
  filtered: any[] = [];
  keyword = '';
  loading = false;
  error = '';

  constructor(private route: ActivatedRoute, private reportService: ReportService) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((qp) => {
      this.dbName = qp['dbName'] || 'EpixFIN_RMM';
      this.fetch();
    });
  }

  fetch(): void {
    this.loading = true;
    this.error = '';
    this.reportService.getCustomer(this.dbName).subscribe({
      next: (res) => {
        this.loading = false;
        this.dbName = res.requestedDb || this.dbName;
        this.data = res.data || [];
        this.applyFilter();
      },
      error: () => {
        this.loading = false;
        this.error = `Gagal mengambil data dari server (${this.dbName}/getCustomer).`;
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

  goBack(): void {
    history.back();
  }
}
