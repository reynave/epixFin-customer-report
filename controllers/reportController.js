const { sql, getPool, isSafeDbName } = require('../config/db');

function resolveDbName(req) {
  return (req.params.dbName || process.env.DB_DATABASE || '').trim();
}

function validateDbNameOrRespond(req, res) {
  const dbName = resolveDbName(req);

  if (!dbName) {
    res.status(400).json({
      status: 'error',
      error: 'Database belum ditentukan. Gunakan URL /:dbName/... atau set DB_DATABASE.',
    });
    return null;
  }

  if (!isSafeDbName(dbName)) {
    res.status(400).json({
      status: 'error',
      requestedDb: dbName,
      error: 'Nama database tidak valid.',
    });
    return null;
  }

  return dbName;
}

// List database yang tersedia di SQL Server
exports.listDatabases = async (req, res) => {
  try {
    const includeSystem = req.query.includeSystem === '1';
    const pool = await getPool('master');
    const request = pool.request();
    request.input('includeSystem', sql.Bit, includeSystem ? 1 : 0);

    const result = await request.query(`
      SELECT name
      FROM sys.databases
      WHERE state_desc = 'ONLINE'
        AND (@includeSystem = 1 OR database_id > 4)
      ORDER BY name ASC;
    `);

    return res.json({
      status: 'ok',
      total: result.recordset.length,
      data: result.recordset.map((row) => row.name),
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      error: 'Gagal mengambil daftar database: ' + err.message,
    });
  }
};
 

// Health check koneksi database (async controller)
exports.healthDb = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    const pool = await getPool(dbName);
    const result = await pool.request().query('SELECT @@VERSION AS version, DB_NAME() AS currentDb');
    return res.json({
      status: 'ok',
      message: 'Koneksi database berhasil',
      requestedDb: dbName,
      database: result.recordset[0].currentDb,
      version: result.recordset[0].version,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Koneksi database gagal',
      requestedDb: dbName,
      error: err.message,
    });
  }
};

// API report customer - contoh ambil data dengan filter tanggal
exports.getReportPage = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    const { startDate, endDate, lastPaymentDate } = req.query;

    const start = startDate  ;
    const end = endDate  ;
    const lastPay = lastPaymentDate || end;


    if(!start || !end) {
      return res.status(400).json({
        status: 'error',
        requestedDb: dbName,
        error: 'Parameter startDate dan endDate diperlukan. Format: YYYY-MM-DD',
      });
    }


    const pool = await getPool(dbName);
    const q = `
        Declare @startDate DateTime
	Declare @endDate DateTime
	Declare @lastPaymentDate DateTime
	
	Set @startDate = '${start}'
	Set @endDate = '${end}'
	set @lastPaymentDate = '${lastPay}'

      SELECT s.SupplierName, t1.SupplierID, sum(t1.invStart - t1.paidStart) as 'saldoAwal',
 sum(t1.Invoice) as 'invoiceTotal', sum(t1.Payment) as 'paidTotal', 
 
          SUM(t1.Invoice - t1.Payment) as 'result'
        FROM (
          SELECT grn.SupplierID,
                 0 AS invStart,
                 0 AS paidStart,
                 SUM(apid.InvAmt) AS Invoice,
                 0 AS Payment
          FROM FinMsGRN AS grn
          LEFT JOIN FinApInvoiceDetail AS apid ON apid.TranxID = grn.TranxID
          WHERE CONVERT(VARCHAR(10), grn.ReceivedDate, 23) BETWEEN @startDate AND @endDate
          GROUP BY grn.SupplierID

          UNION ALL

          SELECT appd.SupplierID,
                 0 AS invStart,
                 0 AS paidStart,
                 0 AS Invoice,
                 SUM(appd.PayAmt) AS Payment
          FROM FinApPaymentDetail AS appd
          LEFT JOIN FinApPayment AS app ON app.PaymentID = appd.PaymentID
          WHERE app.PaymentDate BETWEEN @startDate AND @lastPaymentDate
            AND app.Status = 'CLOSED'
          GROUP BY appd.SupplierID
        ) t1
        LEFT JOIN FinMsSupplier AS s ON s.SupplierID = t1.SupplierID
        GROUP BY t1.SupplierID, s.SupplierName
        ORDER BY s.SupplierName;
      `;
    const result = await pool
      .request() 
      .query(q);


    const q0 = `
      Declare @startDate DateTime
      Declare @endDate DateTime
      Declare @lastPaymentDate DateTime
        
      Set @startDate = '${start}'
      Set @endDate = '${end}'
      set @lastPaymentDate = '${lastPay}'

      select s.SupplierName, t1.SupplierID, 
      
      SUM(t1.Invoice - t1.Payment) as 'saldoAwal'
      from 
      (
        select grn.SupplierID, 0 as 'invStart', 0 as 'paidStart', sum(apid.InvAmt) as 'Invoice', 0 as 'Payment'
        from FinMsGRN as grn
        left join FinApInvoiceDetail as apid on apid.TranxID = grn.TranxID
        where CONVERT(VARCHAR(10), grn.ReceivedDate, 23) < @endDate
        group by grn.SupplierID

        union all

        select appd.SupplierID, 0 as 'invStart', 0 as 'paidStart', 0 as 'Invoice', sum(appd.PayAmt) as 'Payment'  
        from FinApPaymentDetail as appd 
        left join FinApPayment as app on app.PaymentID = appd.PaymentID
        where app.PaymentDate <  @lastPaymentDate and app.Status = 'CLOSED'
        group by appd.SupplierID  
      ) t1
      left join FinMsSupplier as s on s.SupplierID = t1.SupplierID
      group by t1.SupplierID, s.SupplierName
      order by s.SupplierName;
    `; 
  const result0 = await pool
      .request() 
      .query(q0);


  for (const row of result.recordset) {
    const saldoAwalRow = result0.recordset.find(r => r.SupplierID === row.SupplierID);
    row.saldoAwal = saldoAwalRow ? saldoAwalRow.saldoAwal : 0;
  } 
 

    return res.json({ 
      requestedDb: dbName, 
      filter : { startDate: start, endDate: end, lastPaymentDate: lastPay },
      total: result.recordset.length,
      summary : {
        totalSaldoAwal: result.recordset.reduce((sum, row) => sum + (row.saldoAwal || 0), 0),
        totalInvoice: result.recordset.reduce((sum, row) => sum + (row.invoiceTotal || 0), 0),
        totalPayment: result.recordset.reduce((sum, row) => sum + (row.paidTotal || 0), 0),
        totalBalance: result.recordset.reduce((sum, row) => sum + ((row.invoiceTotal || 0) - (row.paidTotal || 0)), 0),
      },
      data: result.recordset,
      query: {
        reportQuery: q,
        saldoAwalQuery: q0
      }, 
      
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 'error',
      requestedDb: dbName,
      error: 'Gagal ambil data: ' + err.message,
    });
  }
};

exports.getReportDetail = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;
  
  try {
    const { supplierId, startDate, endDate, lastPaymentDate } = req.query;
    if (!supplierId || !startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        requestedDb: dbName,
        error: 'Parameter supplierId, startDate, dan endDate diperlukan untuk detail laporan.',
      });
    }
    
    const start = startDate ;
    const end = endDate ;
    const lastPay = lastPaymentDate || end;

    const pool = await getPool(dbName);
    const q = `
        Declare @supplierId varchar(50)
        Declare @startDate DateTime
        Declare @endDate DateTime
        Declare @lastPaymentDate DateTime

        Set @supplierId = '${supplierId}'
        Set @startDate = '${start}'
        Set @endDate = '${end}'
        set @lastPaymentDate = '${lastPay}'
        
       
 select *, 
CASE 
	WHEN t1.Invoice - t1.Payment < 0 then 0
	ELSE t1.Invoice - t1.Payment
	END AS  'balance' from (
	 select 
		grn.SupplierID, grn.TranxID, apid.ReceiverDate, apid.InvID, 
		apid.InvAmt as 'Invoice', 
		'' as PaymentID, 
		0 as 'Payment'
	 from FinMsGRN as grn
	 left join FinApInvoiceDetail as apid on apid.TranxID = grn.TranxID
	 where CONVERT(VARCHAR(10), grn.ReceivedDate, 23) between @startDate and @endDate and 
	   grn.SupplierID = @supplierId  
 
	 union 

	select 
		appd.SupplierID, '' as 'TranxID', ( 
		select top 1 ReceiverDate from FinApInvoiceDetail where InvID= appd.InvID order by ReceiverDate desc) as 'ReceiverDate', appd.InvID, 
		0 as 'Invoice', 
		appd.PaymentID,  
		appd.PayAmt as 'Payment'  
 
	from FinApPaymentDetail as appd 
	left join FinApPayment as app on app.PaymentID = appd.PaymentID

	where app.PaymentDate  between @startDate and @lastPaymentDate and app.Status = 'CLOSED'
	and appd.SupplierID = @supplierId
 ) t1 order by t1.ReceiverDate

      `;  
    const result = await pool.query(q);
      
    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { supplierId, startDate: start, endDate: end, lastPaymentDate: lastPay },
     
      total: result.recordset.length,
      summary : {
        totalInvoice: result.recordset.reduce((sum, row) => sum + (row.Invoice || 0), 0),
        totalPayment: result.recordset.reduce((sum, row) => sum + (row.Payment || 0), 0),
        totalBalance: result.recordset.reduce((sum, row) => sum + ((row.Invoice || 0) - (row.Payment || 0)), 0),
      },
 data: result.recordset,
      query: q,
    });
  }
  catch (err) {
    return res.status(500).json({
      status: 'error',
      requestedDb: dbName,
      error: 'Gagal ambil detail laporan: ' + err.message,
    });
  }
}

exports.getReportDetailSaldoAwal = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;
  
  try {
    const { supplierId, startDate, lastPaymentDate } = req.query;
    if (!supplierId || !startDate) {
      return res.status(400).json({
        status: 'error',
        requestedDb: dbName,
        error: 'Parameter supplierId dan startDate diperlukan untuk detail saldo awal.',
      });
    }
    
    const start = startDate ;
    const lastPay = lastPaymentDate || start;

    const pool = await getPool(dbName);
    const q = `
    Declare @startDate DateTime
    Declare @endDate DateTime
    Declare @lastPaymentDate DateTime

    Set @startDate = '${startDate}' 
    set @lastPaymentDate = '${lastPay}'

    select   t1.* from (

    select  grn.SupplierID,  grn.ReceivedDate, grn.TranxID, apid.InvID, apid.InvAmt as 'Invoice', '' as 'PaymentID', 0 as 'Payment'
      from FinMsGRN as grn
      left join FinApInvoiceDetail as apid on apid.TranxID = grn.TranxID
      where CONVERT(VARCHAR(10), grn.ReceivedDate, 23) < @startDate and 
      grn.SupplierID = '${supplierId}' 
      
      UNION  

      select 
        appd.SupplierID, '' as 'ReceivedDate', '' as 'TranxID',  appd.InvID, 0 as 'Invoice',
        appd.PaymentID,  
        appd.PayAmt as 'Payment'  
    
      from FinApPaymentDetail as appd 
      left join FinApPayment as app on app.PaymentID = appd.PaymentID

      where app.PaymentDate  < @lastPaymentDate and app.Status = 'CLOSED'
      and appd.SupplierID = '${supplierId}' 

    ) as t1
    order by t1.PaymentID ASC`;
    const result = await pool.query(q);
      
    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { supplierId, startDate: start, lastPaymentDate: lastPay },
     
      total: result.recordset.length,
      summary : {
        totalInvoice: result.recordset.reduce((sum, row) => sum + (row.Invoice || 0), 0),
        totalPayment: result.recordset.reduce((sum, row) => sum + (row.Payment || 0), 0),
        totalBalance: result.recordset.reduce((sum, row) => sum + ((row.Invoice || 0) - (row.Payment || 0)), 0),
      },
 data: result.recordset,
      query: q,
    });
  }
  catch (err) {
    return res.status(500).json({
      status: 'error',
      requestedDb: dbName,
      error: 'Gagal ambil detail laporan: ' + err.message,
    });
  }
}
