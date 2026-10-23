const express = require('express');
const router = express.Router({ mergeParams: true });
const reportController = require('../controllers/reportController');

// Middleware: tolak request jika tahun pada startDate kurang dari 2000
function validateStartDateYear(req, res, next) {
  const startDate = (req.query.startDate || '').toString().trim();

  // Jika startDate tidak dikirim, biarkan controller yang menangani validasi wajibnya.
  if (!startDate) {
    return next();
  }

  const year = parseInt(startDate.slice(0, 4), 10);

  if (Number.isNaN(year) || year < 2000) {
    const dbName = (req.params.dbName || process.env.DB_DATABASE || '').trim();
    return res.status(400).json({
      status: 'error',
      warning: 'Tahun startDate tidak valid (kurang dari 2000).',
      error: 'Parameter startDate harus memiliki tahun >= 2000 dengan format YYYY-MM-DD.',
      note: 'Silakan gunakan startDate dengan tahun 2000 atau lebih baru.',
      requestedDb: dbName || null,
      received: { startDate },
    });
  }

  return next();
}

router.get('/', (req, res) => {
  const dbName = (req.params.dbName || process.env.DB_DATABASE || '').trim();
  const baseUrl = req.baseUrl || '';
  return res.json({
    status: 'ok',
    message: 'Report API endpoint',
    requestedDb: dbName || null,
    endpoints: {
      report: `${baseUrl}/report`,
      customer: `${baseUrl}/customer`,
      customerReport: `${baseUrl}/customer/report`,
    },
    usage: {
      query: {
        startDate: 'YYYY-MM-DD',
        endDate: 'YYYY-MM-DD',
        lastPaymentDate: 'YYYY-MM-DD',
      },
      example: `${baseUrl}/customer/report?startDate=2026-01-01&endDate=2026-01-31&lastPaymentDate=2026-01-31`,
    },
  });
});
router.get('/getCustomer', reportController.getCustomer); 
router.get('/customer', validateStartDateYear, reportController.getReportPage);  
router.get('/customer/detail', validateStartDateYear, reportController.getReportDetail);  
router.get('/yearly',   reportController.getYearlyReport);  
router.get('/getJournalAp',   reportController.getJournalAp);  
router.get('/getJournalAmount',   reportController.getJournalAmount);  

module.exports = router;
