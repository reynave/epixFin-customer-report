import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Kontrak API backend TIDAK diubah. Semua response diketik `any`
// (sesuai aturan project) agar tidak ada overhead maintenance interface
// selama shape response belum final.
@Injectable({ providedIn: 'root' })
export class ReportService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listDatabases(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/databases`);
  }

  getCustomer(dbName: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${dbName}/getCustomer`);
  }

  getReportPage(
    dbName: string,
    params: { startDate: string; endDate: string; lastPaymentDate?: string }
  ): Observable<any> {
    let p = new HttpParams()
      .set('startDate', params.startDate)
      .set('endDate', params.endDate);
    if (params.lastPaymentDate) {
      p = p.set('lastPaymentDate', params.lastPaymentDate);
    }
    return this.http.get<any>(`${this.apiUrl}/${dbName}/customer`, { params: p });
  }

  getReportDetail(
    dbName: string,
    params: { supplierId: string; startDate: string; endDate: string; lastPaymentDate?: string }
  ): Observable<any> {
    let p = new HttpParams()
      .set('supplierId', params.supplierId)
      .set('startDate', params.startDate)
      .set('endDate', params.endDate);
    if (params.lastPaymentDate) {
      p = p.set('lastPaymentDate', params.lastPaymentDate);
    }
    return this.http.get<any>(`${this.apiUrl}/${dbName}/customer/detail`, { params: p });
  }

  getYearly(dbName: string, params: { startDate: string; endDate: string }): Observable<any> {
    const p = new HttpParams()
      .set('startDate', params.startDate)
      .set('endDate', params.endDate);
    return this.http.get<any>(`${this.apiUrl}/${dbName}/yearly`, { params: p });
  }

  getJournalAp(dbName: string, params: { startDate: string; endDate: string }): Observable<any> {
    const p = new HttpParams()
      .set('startDate', params.startDate)
      .set('endDate', params.endDate);
    return this.http.get<any>(`${this.apiUrl}/${dbName}/getJournalAp`, { params: p });
  }

  getJournalAmount(dbName: string, params: { id: string; prefix: string }): Observable<any> {
    const p = new HttpParams()
      .set('id', params.id)
      .set('prefix', params.prefix);
    return this.http.get<any>(`${this.apiUrl}/${dbName}/getJournalAmount`, { params: p });
  }

  getSaldoAwal(
    dbName: string,
    params: { startDate: string; endDate: string; lastPaymentDate?: string }
  ): Observable<any> {
    let p = new HttpParams()
      .set('startDate', params.startDate)
      .set('endDate', params.endDate);
    if (params.lastPaymentDate) {
      p = p.set('lastPaymentDate', params.lastPaymentDate);
    }
    return this.http.get<any>(`${this.apiUrl}/${dbName}/saldoAwal`, { params: p });
  }
}
