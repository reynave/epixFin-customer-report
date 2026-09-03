const express = require('express');
const router = express.Router({ mergeParams: true });
const reportController = require('../controllers/reportController');

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
 
router.get('/customer', reportController.getReportPage); 
router.get('/customer/detail', reportController.getReportDetail);
router.get('/customer/unInvoiceGrn', reportController.getUninvoiceGrn);

router.get('/customer/detail/all', reportController.getReportDetailAll);

router.get('/customer/detail/saldo-awal', reportController.getReportDetailSaldoAwal);

module.exports = router;
