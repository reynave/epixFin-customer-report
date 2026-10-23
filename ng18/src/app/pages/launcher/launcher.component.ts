import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './launcher.component.html',
  styles: [
    `
      .launcher-card {
        max-width: 700px;
        margin: 24px auto;
        background: #fff;
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        color: #1f2937;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }
      h1 {
        margin-top: 0;
        margin-bottom: 8px;
      }
      p {
        margin-top: 0;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field.full {
        grid-column: 1 / -1;
      }
      label {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
      }
      select,
      input {
        border: 1px solid #d0d7e2;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 14px;
      }
      select:focus,
      input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      }
      button {
        margin-top: 20px;
        border: 0;
        border-radius: 10px;
        background: #2563eb;
        color: #fff;
        padding: 11px 16px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      .muted {
        font-size: 13px;
        color: #6b7280;
      }
      .error {
        margin-top: 12px;
        color: #b91c1c;
        font-size: 13px;
      }
      .api {
        margin-top: 18px;
        font-size: 13px;
      }
      .api code {
        background: #eef2ff;
        padding: 3px 7px;
        border-radius: 6px;
      }
      @media (max-width: 700px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LauncherComponent implements OnInit {
  databases: string[] = [];
  dbName = '';
  startDate = '';
  endDate = '';
  error = '';
  loading = true;

  constructor(private reportService: ReportService, private router: Router) {}

  ngOnInit(): void {
    this.setDefaultDates();
    this.loadDatabases();
  }

  setDefaultDates(): void {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.startDate = `${yyyy}-${mm}-01`;
    this.endDate = `${yyyy}-${mm}-${dd}`;
  }

  loadDatabases(): void {
    this.error = '';
    this.loading = true;
    this.reportService.listDatabases().subscribe({
      next: (payload) => {
        const dbList: string[] = Array.isArray(payload.data) ? payload.data : [];
        this.databases = dbList;
        this.loading = false;
        const preferred = dbList.find((name: string) => name === 'EpixFIN_RMM');
        if (preferred) {
          this.dbName = preferred;
        }
      },
      error: () => {
        this.databases = [];
        this.loading = false;
        this.error = 'Gagal memuat daftar database dari endpoint /databases. Pastikan server aktif.';
      },
    });
  }

  onSubmit(): void {
    this.error = '';
    if (!this.dbName) {
      this.error = 'Silakan pilih database terlebih dahulu.';
      return;
    }
    if (!this.startDate || !this.endDate) {
      this.error = 'Tanggal wajib diisi semua.';
      return;
    }
    this.router.navigate(['/customer'], {
      queryParams: {
        dbName: this.dbName,
        startDate: this.startDate,
        endDate: this.endDate,
      },
    });
  }
}

