const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. PERBAIKAN DOTENV: Membaca file .env di folder fisik luar (di sebelah file .exe)
dotenv.config({
  path: path.join(process.cwd(), '.env')
});

const reportRoutes = require('./routes/report');
const reportController = require('./controllers/reportController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Middleware Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 2. PERBAIKAN PUBLIC FOLDER: Mengakses folder public di luar file .exe
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Global endpoints (tanpa dbName)
app.get('/databases', reportController.listDatabases);

// Routes dengan parameter :dbName
app.use('/:dbName', reportRoutes);

// Health check umum
app.get('/health/db', reportController.healthDb);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Epix Report API',
    endpoints: {
      reportCustomerWithDb: '/:dbName/report/customer',
      reportCustomerDefault: '/report/customer',
      listDatabases: '/databases',
      healthWithDb: '/:dbName/health/db',
      healthDefault: '/health/db',
    },
  });
});

// 404 Handler (Penanganan Endpoint Tidak Ditemukan)
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint tidak ditemukan',
    path: req.originalUrl,
  });
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});