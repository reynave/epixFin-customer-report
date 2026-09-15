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


function QuerySaldoAwal(start = '2026-01-01') {
  const q0 = `
      Declare @startDate DateTime 
        
      Set @startDate = '${start}'  

      select t1.SupplierID, sum(t1.Invoice - t1.Paid) 'saldoAwal' from (

        -- TAGIHAN berdasrkan GRN
        select g.SupplierID , g.ReceivedDate 'Date',  g.TranxID,  g.TotalAmount 'Invoice',
         0 as 'Paid' , 'GRN' as 'ID'
        from FinMsGRN g
        where g.ReceivedDate < @startDate 

         UNION ALL 
       -- GRN SUDAH DIBAYAR (1 baris per TranxID, tidak dobel walau invoice/payment detail-nya banyak)
        select g.SupplierID,
          MAX(p.PaymentDate) as 'Date',
          g.TranxID, 0 as 'Invoice', g.TotalAmount as 'Paid', 
          MIN(CAST(appd.PaymentID as varchar(20))) as 'ID'
        from FinMsGRN as g
        join FinApInvoiceDetail as apid on apid.TranxID = g.TranxID
        join FinApPaymentDetail as appd on apid.InvID = appd.InvID
        left join FinApPayment as p on p.PaymentID = appd.PaymentID
        where p.PaymentDate < @startDate
        group by g.SupplierID, g.TranxID, g.TotalAmount

      ) t1
      group by t1.SupplierID
      order by t1.SupplierID 
    `;
  return q0;
}
 
exports.getCustomer = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    
    const pool = await getPool(dbName);
    const q = `
        SELECT SupplierName, SupplierID
        FROM finMsSupplier 
        ORDER BY SupplierName ASC;
      `;
    const result = await pool
      .request()
      .query(q);

 
    return res.json({
      requestedDb: dbName, 
      data: result.recordset, 
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
 

exports.getReportPage = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    const { startDate, endDate, lastPaymentDate } = req.query;

    const start = startDate;
    const end = endDate;
    const lastPay = lastPaymentDate || end;


    if (!start || !end) {
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

        select 
          a.SupplierID,  
          sum(ISNULL(a.InvAmt,a.TotalAmount)) as 'balance'  
        from (
          select g.TranxID, g.ReceivedDate, g.TotalAmount, id.InvID, id.InvAmt, g.SupplierID
          from FinMsGRN as g
          left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
          where  g.ReceivedDate between @startDate and @endDate 
        ) a
        left join (
          select pd.InvID, SUM(pd.PayAmt + pd.AmtAdj) as 'TotalPaid'
          from FinApPaymentDetail as pd
          join FinApPayment as p on p.PaymentID = pd.PaymentID
          where p.PaymentDate < @lastPaymentDate 
          and p.Status = 'CLOSED'
          group by pd.InvID
        ) b on b.InvID = a.InvID
        where  ( ((a.InvAmt - ISNULL(b.TotalPaid, 0)) > 0 or ISNULL(b.TotalPaid, 0) <= 0 ) or 
          ISNULL(a.InvAmt,a.TotalAmount) < 0 )  
        group by a.SupplierID
        order by a.SupplierID ASC
      `;
    const result = await pool
      .request()
      .query(q);


    const q0 = QuerySaldoAwal(start);
    const q_saldoAwal = await pool
      .request()
      .query(q0);
 
    for (const row of result.recordset) {
      const saldoAwalRow = q_saldoAwal.recordset.find(r => r.SupplierID === row.SupplierID);
      row.saldoAwal = saldoAwalRow ? saldoAwalRow.saldoAwal : 0; 
    }



     const s = `
        SELECT SupplierName, SupplierID
        FROM finMsSupplier 
        ORDER BY SupplierName ASC;
      `;
    const supplierResult = await pool
      .request()
      .query(s);

    for (const supplier of supplierResult.recordset) {
      const row = result.recordset.find(r => r.SupplierID === supplier.SupplierID);
      if (row) {
        row.SupplierName = supplier.SupplierName;
      }
    }



    let totalSaldoAwal = result.recordset.reduce((sum, row) => sum + (row.saldoAwal || 0), 0);
    return res.json({
      requestedDb: dbName,
      filter: { startDate: start, endDate: end, lastPaymentDate: lastPay },
      total: result.recordset.length,
      summary: {
        totalSaldoAwal: totalSaldoAwal,
        totalInvoice: result.recordset.reduce((sum, row) => sum + (row.invoice || 0), 0),
        totalPayment: result.recordset.reduce((sum, row) => sum + (row.paidTotal || 0), 0),
        totalBalance: result.recordset.reduce((sum, row) => sum + (row.balance || 0), 0),
      },
      data: result.recordset, 

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
 
// ver 2
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

    const start = startDate;
    const end = endDate;
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
         
        select 
          a.TranxID, 
          a.ReceivedDate, 
          a.TotalAmount,
          a.InvID, 
          ISNULL(a.InvAmt,a.TotalAmount) as 'Invoice', 
          b.TotalPaid as 'Payment', 
          a.InvAmt - ISNULL(b.TotalPaid, 0) as 'Outstanding'
        from (
          select g.TranxID, g.ReceivedDate, g.TotalAmount, id.InvID, id.InvAmt
          from FinMsGRN as g
          left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
          where g.SupplierID = '${supplierId}'
          and g.ReceivedDate between '${start}' and '${end}' 
        ) a
        left join (
          select pd.InvID, SUM(pd.PayAmt + pd.AmtAdj) as 'TotalPaid'
          from FinApPaymentDetail as pd
          join FinApPayment as p on p.PaymentID = pd.PaymentID
          where pd.SupplierID = '${supplierId}' 
          and p.PaymentDate < '${lastPay}' 
          and p.Status = 'CLOSED'
          group by pd.InvID
        ) b on b.InvID = a.InvID
        where 
          ((a.InvAmt - ISNULL(b.TotalPaid, 0)) > 0 or ISNULL(b.TotalPaid, 0) <= 0 ) 
          or   ISNULL(a.InvAmt,a.TotalAmount) < 0 
        order by a.ReceivedDate ASC, a.TranxID ASC
      `;
    const result = await pool.query(q);
  
    let balance = 0; // dari query terpisah

    const recordset = result.recordset.map(row => {
      balance += row.Invoice || 0;
      return {
        ...row,
        balance: balance 
      };
    });

    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { supplierId, startDate: start, endDate: end, lastPaymentDate: lastPay },

      total: recordset.length,
      summary: {
        totalSaldoAwal:0,
        totalInvoice: recordset.reduce((sum, row) => sum + (row.Invoice || 0), 0),
        totalPayment: recordset.reduce((sum, row) => sum + (row.Payment || 0), 0),
        totalBalance: 0,
      },
      data: recordset,
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

    const start = startDate;
    const lastPay = lastPaymentDate || start;

    const pool = await getPool(dbName);
    const q = `
    Declare @startDate DateTime 

    Set @startDate = '${start}' 
     
      -- TAGIHAN berdasrkan GRN
      select g.ReceivedDate 'Date', 'Received' as 'Source', g.TranxID,  g.TotalAmount 'Invoice', 0 as 'Paid' , 'GRN' as 'ID'
        from FinMsGRN g
      where g.SupplierID = '${supplierId}' 
      and g.ReceivedDate < @startDate

      UNION 
      -- GRN SUDAH DIBAYAR
     select Date, Source, TranxID, Invoice, Paid, PaymentID
from (
	select 
		p.PaymentDate as 'Date', 
		'Payment' as 'Source', 
		g.TranxID, 
		0 as 'Invoice',    
		g.TotalAmount as 'Paid',   
		appd.PaymentID,
		ROW_NUMBER() OVER (PARTITION BY g.TranxID ORDER BY p.PaymentDate DESC) as rn
	from FinMsGRN as g
		join FinApInvoiceDetail as apid on apid.TranxID = g.TranxID
		join FinApPaymentDetail as appd on apid.InvID = appd.InvID
		left join FinApPayment as p on p.PaymentID = appd.PaymentID
	where g.SupplierID = '${supplierId}'
		and p.PaymentDate < @startDate  
) t
where rn = 1 

        order by TranxID DESC
     `;
    const result = await pool.query(q);

    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { supplierId, startDate: start, lastPaymentDate: lastPay },

      total: result.recordset.length,
      summary: {
        totalInvoice: result.recordset.reduce((sum, row) => sum + (row.Invoice || 0), 0),
        totalPayment: result.recordset.reduce((sum, row) => sum + (row.Paid || 0), 0),
        totalBalance: result.recordset.reduce((sum, row) => sum + ((row.Invoice || 0) - (row.Paid || 0)), 0),
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

exports.getUninvoiceGrn = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    const { startDate, lastDate, lastPaymentDate } = req.query;


    const allSupplier = [];
    const qSup = `select   SupplierID, SupplierName from FinMsSupplier `;
    const pool = await getPool(dbName);
    const resultSup = await pool.query(qSup);

    const query = {
      qGRN: '',
      qInvoice: ''
    }
    for (const row of resultSup.recordset) {

      const supplierId = row.SupplierID;

      const qGRN = `
   
Declare @startDate DateTime 
Declare @lastDate DateTime  
Declare @lastPaymentDate DateTime  

Set @startDate = '${startDate}' 
Set @lastDate = '${lastDate}' 
Set @lastPaymentDate = '${lastPaymentDate}' 
     
select  g.SupplierID, 'GRN' as 'type', g.TranxID as 'no' , g.ReceivedDate, g.Status,  
g.TotalAmount, 0 as InvAmt,  ISNULL(
	(
		select  pd.PayAmt -  id.InvAmt as 'change'  
from FinApInvoiceDetail id
join FinApPaymentDetail as pd on pd.InvID = id.InvID
join FinApInvoice as i on i.InvID = id.InvID
join FinApPayment as p on p.PaymentID = pd.PaymentID
where    p.PaidDate < @lastPaymentDate  and id.TranxID = g.TranxID  and p.Status = 'CLOSED'
	),0) as 'change'

from FinMsGRN g 
where g.ReceivedDate between @startDate and @lastDate and g.SupplierID = '${supplierId}' 
and ISNULL(
	(
		select  pd.PayAmt -  id.InvAmt as 'change'  
from FinApInvoiceDetail id
join FinApPaymentDetail as pd on pd.InvID = id.InvID
join FinApInvoice as i on i.InvID = id.InvID
join FinApPayment as p on p.PaymentID = pd.PaymentID
where    p.PaidDate < @lastPaymentDate  and id.TranxID = g.TranxID  and p.Status = 'CLOSED'
	),0) <= 0
order by g.ReceivedDate ASC, g.TranxID ASC; 

     `;
      query.qGRN = qGRN;
      const result = await pool.query(qGRN);


      const qInvoice = `
      Declare @startDate DateTime 
      Declare @lastDate DateTime  
      Declare @lastPaymentDate DateTime  

      Set @startDate = '${startDate}' 
      Set @lastDate = '${lastDate}' 
      Set @lastPaymentDate = '${lastPaymentDate}' 
        
      select g.SupplierID, 'INV' as 'type',  id.InvID as 'no' , 0 as 'TotalAmount', sum(id.InvAmt)  as 'InvAmt' ,
        (
        select  sum(pd.PayAmt)
        from FinApPaymentDetail as pd
        LEFT JOIN FinApPayment as p on p.PaymentID = pd.PaymentID
        where p.Status = 'CLOSED'
        and p.PaymentDate <= @lastPaymentDate and pd.InvID = id.InvID
        ) as 'PayAmt' 
      FROM FinMsGRN g
      LEFT JOIN FinApInvoiceDetail as id on id.TranxID = g.TranxID
      where g.ReceivedDate between @startDate and @lastDate and g.SupplierID = '${supplierId}'
      group by g.SupplierID, id.InvID

     `;
      query.qInvoice = qInvoice;
      const resultInvoice = await pool.query(qInvoice);


      for (const row of resultInvoice.recordset) {
        row.changes = row.InvAmt - row.PayAmt;

        if (row.changes <= 0) {
          // remove array row tersebut
          const index = resultInvoice.recordset.indexOf(row);
          if (index > -1) {
            resultInvoice.recordset.splice(index, 1);
          }
        }
      }

      // saya mau gabungkan array recordset dari GRN dan Invoice menjadi satu array
      const combinedRecordset = [...result.recordset, ...resultInvoice.recordset];

      const summary = {
        TotalAmount: combinedRecordset.reduce((acc, curr) => acc + (curr.TotalAmount || 0), 0),
        InvAmt: combinedRecordset.reduce((acc, curr) => acc + (curr.InvAmt || 0), 0),
        unInvoice: combinedRecordset.reduce((acc, curr) => acc + (curr.TotalAmount || 0), 0) - combinedRecordset.reduce((acc, curr) => acc + (curr.InvAmt || 0), 0),
        PayAmt: combinedRecordset.reduce((acc, curr) => acc + (curr.PayAmt || 0), 0),
      }

      const data = {
        supplierId: supplierId,
        supplierName: row.SupplierName,
        recordset: combinedRecordset,
        summary: summary,
        TotalBalance: summary.TotalAmount - summary.PayAmt,
      }
      // jika combinedRecordset tidak kosong, baru push ke allSupplier
      if (combinedRecordset.length === 0) continue;
      allSupplier.push(data);
    }


    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { startDate, lastDate, lastPaymentDate },

      data: allSupplier,
      query: query

    });
  }
  catch (err) {
    return res.status(500).json({
      status: 'error',
      requestedDb: dbName,
      error: 'Gagal ambil detail laporan: ' + err.message,
    });
  }
};