# RULES ANGULAR

Dokumen ini adalah aturan wajib untuk pengembangan frontend Angular pada proyek ini.

##  Aturan Wajib Angular membership

Ikuti aturan ini tanpa pengecualian:

1. Dilarang pakai fitur Angular experimental/preview.
2. Dilarang pakai `loadChildren`.
3. Request API wajib generic `any`:

```ts
this.http.get<any>(url, options)
this.http.post<any>(url, body, options)
```

4. Aksi back wajib `history.back()`.
5. Jangan ubah kontrak API backend tanpa instruksi eksplisit.
6. Jangan ubah task owner lain yang sedang `IN_PROGRESS`.

### Catatan: Penggunaan `<any>` vs Interface/Class

Karena semua request HTTP wajib `<any>`, **interface TypeScript untuk response API ditiadakan** selama kontrak API belum final. Ini disengaja agar tidak ada overhead maintenance ketika shape response berubah.

Yang **boleh** tetap pakai interface/type:
- Model form input (contoh: `LoginForm`, `FilterParams`) — karena ini kontrak internal komponen, bukan dari API.
- State lokal yang kompleks di dalam komponen (opsional, jika membantu keterbacaan).

Yang **tidak perlu** dibuat:
- Interface untuk response HTTP (`MemberResponse`, `PointData`, dll.) — cukup akses properti langsung dari `response.data`.

Contoh benar:

```ts
// ✅ form model internal — boleh pakai interface
interface LoginForm {
  email: string;
  password: string;
}

// ✅ HTTP call — wajib <any>
this.http.post<any>(`${this.baseUrl}/auth/login`, payload)
  .subscribe(res => {
    const token = res.data.token; // akses langsung, tanpa cast
  });
```