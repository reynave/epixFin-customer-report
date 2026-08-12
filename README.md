## Exe in windows / PC direct
1. setting connection ada file .env wajib username dan password
2. click app.exe
pastikan port sql server 1433 dibuka, untuk cek bisa pakai promt dibawah

```
c:\> tnc localhost -p 1433


ComputerName     : localhost
RemoteAddress    : ::1
RemotePort       : 1433
InterfaceAlias   : Loopback Pseudo-Interface 1
SourceAddress    : ::1
TcpTestSucceeded : True
```

## SETTING JIKA PORT KE BLOCK (bisa tanya GPT / GEMINI )
# Panduan Mengaktifkan dan Membuka Port 1433 Microsoft SQL Server

Hasil `TcpTestSucceeded : False` menunjukkan bahwa port 1433 di komputer saat ini masih tertutup atau tidak merespons. 

Berikut adalah 3 langkah utama untuk mengaktifkan dan membuka port 1433 agar database dapat diakses:

---

### 1. Aktifkan Protokol TCP/IP di SQL Server
Secara default, instalasi SQL Server (terutama Express Edition) menonaktifkan koneksi jaringan melalui TCP/IP.
* Buka **SQL Server Configuration Manager** melalui *Start Menu*.
* Pilih menu **SQL Server Network Configuration** di panel kiri.
* Klik folder **Protocols for [Nama_Instance]** (contoh: *Protocols for MSSQLSERVER*).
* Pada panel sebelah kanan, klik kanan pada opsi **TCP/IP** lalu pilih **Enable**.

### 2. Atur Konfigurasi Port ke 1433
* Masih di panel kanan pada menu **TCP/IP**, klik kanan lalu pilih **Properties**.
* Buka tab **IP Addresses** pada jendela baru yang muncul.
* Gulir (*scroll*) ke paling bawah hingga menemukan bagian bernama **IPAll**.
* Kosongkan kolom **TCP Dynamic Ports** (jika terisi angka `0`, silakan dihapus).
* Isi kolom **TCP Port** dengan angka `1433`.
* Klik **Apply** lalu tekan **OK**.

### 3. Restart Layanan SQL Server
Perubahan konfigurasi jaringan di atas baru akan aktif setelah layanan database dimulai ulang.
* Pada *Configuration Manager*, klik menu **SQL Server Services** di panel paling kiri.
* Lihat ke panel sebelah kanan, klik kanan pada layanan **SQL Server (Nama_Instance)** yang Anda gunakan.
* Pilih opsi **Restart**.

---

### Pengujian Akhir
Setelah menyelesaikan ketiga langkah di atas, silakan jalankan kembali perintah verifikasi di **Windows PowerShell**:

```powershell
Test-NetConnection -ComputerName localhost -Port 1433
```

Jika konfigurasi berhasil, status pada baris akhir akan berubah menjadi **`TcpTestSucceeded : True`**.


### BUILD EXE
Untuk me-build kode tersebut menjadi file .exe
1. Jalankan Perintah Build (Terminal / PowerShell)
```
pkg app.js -o app.exe --targets node18-win-x64
```


📁 server-app/
 ├── 📄 server.exe      <-- Hasil build dari pkg
 ├── 📄 .env            <-- File konfigurasi (PORT, koneksi MySQL DB, dll)
 └── 📁 public/         <-- Folder aset publik (gambar/laporan)

# RUN on SERVER
### Prerequisites: Node.js and npm Installation Guide

To run this project, you need to have **Node.js** and **npm** (Node Package Manager) installed on your system. The official Node.js installer automatically includes npm.

---

## 🛠️ Step 1: Check Existing Installation

Before installing, check if you already have them by running these commands in your terminal or command prompt:

```bash
node -v
npm -v
```

If these commands return version numbers, you are ready to go! If not, proceed to the installation steps below.

---

## 🚀 Step 2: Choose Your Installation Method

### Option A: Using official Installers (Recommended for Windows & macOS)
1. Go to the official [Node.js Download Page](https://nodejs.org/en/download).
2. Download the installer for your Operating System.
3. Run the installer and follow the setup wizard (keep default settings).

### Option B: Using Node Version Manager (Recommended for Developers)
A version manager like `nvm` allows you to install, switch, and manage multiple versions of Node.js smoothly.

* **macOS / Linux:**
  ```bash
  # Download and install nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
  
  # Load nvm into your terminal
  \. "\$HOME/.nvm/nvm.sh"
  
  # Install the latest stable Node.js version
  nvm install 24
  ```

* **Windows:** Download and run the installer from the [nvm-windows repository](https://github.com).

### Option C: Using Linux Package Managers (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install nodejs npm -y
```

---

## 📦 Step 3: Project Setup & Package Installation

Once installed, navigate to your project directory and initialize/install dependencies:

```bash
# 1. Initialize a new project (if starting fresh)
npm init -y

# 2. Install project dependencies listed in package.json
npm install
```

---

## 🔄 Updating npm (Optional)
If you already have npm but want to update it to the latest version, run:
```bash
npm install -g npm@latest
```
