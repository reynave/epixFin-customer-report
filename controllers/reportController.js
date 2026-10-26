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
  //start date dikurangin 1 hari untuk saldo awal, karena saldo awal adalah saldo sebelum start date
  const startDate = new Date(start);
  startDate.setDate(startDate.getDate() - 1);
  const formattedStartDate = startDate.toISOString().split('T')[0];

  const q0 = `
 
      Declare @startDate date
      Declare @endDate date

      Set @startDate = '2000-01-01'
      Set @endDate = '${formattedStartDate}'  
 
      select t1.SupplierID, sum(t1.Invoice - t1.Paid) 'saldoAwal' from (

        -- TAGIHAN berdasrkan GRN
        select g.SupplierID , g.ReceivedDate 'Date',  g.TranxID,  g.TotalAmount 'Invoice',
         0 as 'Paid' , 'GRN' as 'ID'
        from FinMsGRN g
        where g.ReceivedDate between @startDate and @endDate

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
        where p.PaymentDate between @startDate and @endDate
        group by g.SupplierID, g.TranxID, g.TotalAmount

      ) t1
      group by t1.SupplierID
      order by t1.SupplierID 
    `;
    console.log('QuerySaldoAwal:', q0);
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

 
 
 // ver 4 
 // URL http://localhost:3000/EpixFIN_RMM/customer/
exports.getReportPage = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    const { startDate, endDate,   } = req.query;

    const start = startDate;
    const end = endDate; 


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
        
        Set @startDate = '${start}'
        Set @endDate = '${end}' 
 
      select 
        a1.SupplierID,
        sum(a1.GrnAmount)  as 'GrnAmount',
        sum(a1.totalInv) as 'totalInv',
        sum(a1.totalPayment) as 'totalPayment',
        sum(a1.totalInv - a1.totalPayment)  as 'balance'
        
      from (

          select  g.SupplierID , sum(g.TotalAmount) as 'GrnAmount' , 0  as 'totalInv', 0 as 'totalPayment' 
        from FinMsGRN as g
        left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
        where  g.ReceivedDate between  @startDate and @endDate
          and id.InvID is null 
          group by g.SupplierID

          union all

        select i.SupplierID, 0  as 'GrnAmount', sum(i.InvTotal ) as 'totalInv', 0 as 'totalPayment'
        from FinApInvoice as i
        where i.InvDate between  @startDate and @endDate
        group by  i.SupplierID

        union all

        select p.SupplierID,  0  as 'GrnAmount', 0  as 'totalInv',sum( pd.PayAmt) as 'totalPayment' 
        from FinApPaymentDetail  pd
        join FinApPayment as p on p.PaymentID = pd.PaymentID
        where  p.PaymentDate between  @startDate and @endDate and  p.Status = 'CLOSED'
        group by p.SupplierID

      ) as a1
      group by 	a1.SupplierID
      
      
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

    for (const row of result.recordset) {
      row.totalInv = row.totalInv || 0;
      row.totalPayment = row.totalPayment || 0;
      row.balance = row.saldoAwal + row.GrnAmount + row.totalInv - row.totalPayment;

    }


    let totalSaldoAwal = q_saldoAwal.recordset.reduce((sum, row) => sum + (row.saldoAwal || 0), 0);


    let totalInvoice = result.recordset.reduce((sum, row) => sum + (row.totalInv || 0), 0);
    let totalPayment = result.recordset.reduce((sum, row) => sum + (row.totalPayment || 0), 0);
    let totalBalance = result.recordset.reduce((sum, row) => sum + (row.balance || 0), 0);

    return res.json({
      requestedDb: dbName,
      filter: { startDate: start, endDate: end,   },
     // q_saldoAwal : q_saldoAwal.recordset,
      total: result.recordset.length,
      summary: {
        totalSaldoAwal: totalSaldoAwal,
        totalInvoice: totalInvoice,
        totalPayment: totalPayment,
        totalBalance: totalBalance,
      },
      data: result.recordset, 
      q : q,

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

 
// ver 3
exports.getReportDetail = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    const { supplierId, startDate, endDate } = req.query;
    if (!supplierId || !startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        requestedDb: dbName,
        error: 'Parameter supplierId, startDate, dan endDate diperlukan untuk detail laporan.',
      });
    }

    const start = startDate;
    const end = endDate;
   

    const pool = await getPool(dbName);
    const q = `
        Declare @supplierId varchar(50)
        Declare @startDate DateTime
        Declare @endDate DateTime

        Set @supplierId = '${supplierId}'
        Set @startDate = '${start}'
        Set @endDate = '${end}'
         
         
select t1.TypeID, t1.id as 'Id', 

      STUFF((
      select ', ' + pd.PaymentID
      from FinApPaymentDetail pd
      join FinApPayment as p on p.PaymentID = pd.PaymentID
      where pd.InvID = t1.id  and  p.PaymentDate between  @startDate and @endDate
      for xml path('')
    ), 1, 2, '') as 'paymentId', 
    (select a.InvDate from FinApInvoice a where InvID = t1.id )  'date',

      sum(t1.GrnAmount) as 'GrnAmount', sum(t1.totalInv) as 'totalInv', sum( t1.totalPayment) as 'totalPayment' ,
      sum((t1.totalInv + t1.GrnAmount)  -t1.totalPayment )  as 'balance'
      from (

      select  'GRN' as 'TypeID', g.TranxID as 'id', (g.TotalAmount) as 'GrnAmount' , 0  'totalInv', 0 'totalPayment' 
      from FinMsGRN as g
      left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
      where  g.ReceivedDate between  @startDate and @endDate
      and id.InvID is null 
      and   g.SupplierID = @supplierId

      union all

      select 'INV' as 'TypeID', i.InvID as 'id',    0  as 'GrnAmount', (i.InvTotal ) as 'totalInv', 0 'totalPayment'
      from FinApInvoice as i
      where i.InvDate between  @startDate and @endDate
      and   i.SupplierID = @supplierId

      union all

      select  'INV' as 'TypeID', pd.InvID,  0  as 'GrnAmount', 0  as 'totalInv',(pd.Amount) 'totalPayment' 
      from FinApPaymentDetail  pd
      join FinApPayment as p on p.PaymentID = pd.PaymentID
      where  p.PaymentDate between  @startDate and @endDate and  p.Status = 'CLOSED'
      and   p.SupplierID = @supplierId

      ) as t1 
      group by t1.id, t1.TypeID
      order by t1.id ASC;
      
      `;
    const result = await pool.query(q);

 

    const recordset = result.recordset; // balance sudah dihitung di query SQL, tidak dihitung ulang di sini

    for (const row of recordset) {
      if(row.totalInv == null)
        row.totalInv = 0;
      if(row.totalPayment == null)
        row.totalPayment = 0;
      if(row.balance == null)
        row.balance = 0;

      row.balance =  row.GrnAmount + row.totalInv - row.totalPayment;
    } 


    const totalGrn = recordset.reduce((sum, row) => sum + (row.GrnAmount || 0), 0);
    const totalInvoice = recordset.reduce((sum, row) => sum + (row.totalInv || 0), 0);
    const totalPayment = recordset.reduce((sum, row) => sum + (row.totalPayment || 0), 0);
 



     const q0 = `
      Declare @startDate DateTime 
        
      Set @startDate = '${start}'  

      select t1.SupplierID, sum(t1.Invoice - t1.Paid) 'saldoAwal' from (

        -- TAGIHAN berdasrkan GRN
        select g.SupplierID , g.ReceivedDate 'Date',  g.TranxID,  g.TotalAmount 'Invoice',
         0 as 'Paid' , 'GRN' as 'ID'
        from FinMsGRN g
        where g.ReceivedDate < @startDate     and g.SupplierID = '${supplierId}'

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
        where p.PaymentDate < @startDate          and g.SupplierID = '${supplierId}'
        group by g.SupplierID, g.TranxID, g.TotalAmount

      ) t1
      group by t1.SupplierID 
    `;
    const result0 = await pool.query(q0);
    const saldoAwal = result0.recordset.reduce((sum, row) => sum + (row.saldoAwal || 0), 0);
 

    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { supplierId, startDate: start, endDate: end,  },

      total: recordset.length,
      summary: {
        saldoAwal: saldoAwal,
        totalGrn: totalGrn,
        totalInvoice: totalInvoice,
        totalPayment: totalPayment,
        totalBalance: saldoAwal+ totalGrn + totalInvoice - totalPayment,
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
   
 
// ver 3
exports.getYearlyReport = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
    // Default laporan tahunan Jan s/d Des 2026, bisa di-override lewat query
    const startDate = req.query.startDate || '2026-01-01';
    const endDate = req.query.endDate || '2026-12-31';

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        status: 'error',
        requestedDb: dbName,
        error: 'Format startDate/endDate tidak valid. Gunakan YYYY-MM-DD.',
      });
    }

    // Bangun daftar bulan dari startDate s/d endDate (mis. 2026-01 s/d 2026-12)
    const months = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= lastMonth) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const pool = await getPool(dbName);
    const q = `
      select   
        @year as 'Year',  @month as 'Month',
        sum(a1.GrnAmount)  as 'GrnAmount',
        sum(a1.totalInv) as 'totalInv',
        sum(a1.totalPayment) as 'totalPayment',
        sum(a1.totalInv - a1.totalPayment)  as 'balance'
              
      from (

          select  g.SupplierID , sum(g.TotalAmount) as 'GrnAmount' , 0  as 'totalInv', 0 as 'totalPayment' 
          from FinMsGRN as g
          left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
          where  YEAR(g.ReceivedDate)  = @year and  MONTH(g.ReceivedDate)  = @month  
          and id.InvID is null 
          group by g.SupplierID

          union all

          select i.SupplierID, 0  as 'GrnAmount', sum(i.InvTotal ) as 'totalInv', 0 as 'totalPayment'
          from FinApInvoice as i
          where YEAR(i.InvDate) = @year and  MONTH(i.InvDate)  = @month  
          group by  i.SupplierID

          union all

          select p.SupplierID,  0  as 'GrnAmount', 0  as 'totalInv',sum(pd.Amount) as 'totalPayment' 
          from FinApPaymentDetail  pd
          join FinApPayment as p on p.PaymentID = pd.PaymentID
          where  Year(p.PaymentDate) = @year and  MONTH(p.PaymentDate)  = @month  and 
          p.Status = 'CLOSED'
          group by p.SupplierID

      ) as a1
      `;

    const data = [];

    // Loop (foreach) tiap bulan, query dijalankan per tahun + bulan
    for (const m of months) {
      const result = await pool
        .request()
        .input('year', sql.Int, m.year)
        .input('month', sql.Int, m.month)
        .query(q);

      for (const row of result.recordset) {

        const qSaldoawal =  '';





        row.saldoAwal = 0; // saldo awal per bulan tidak dihitung di sini, bisa ditambahkan jika diperlukan
        data.push(row);
      }
    }

    // Saldo awal (opening balance) sebelum startDate, pakai QuerySaldoAwal
    const q0 = QuerySaldoAwal(startDate);
    const q_saldoAwal = await pool
      .request()
      .query(q0);
    const saldoAwal = q_saldoAwal.recordset.reduce(
      (sum, row) => sum + (Number(row.saldoAwal) || 0),
      0
    );

    const totalGrn = data.reduce((sum, row) => sum + (Number(row.GrnAmount) || 0), 0);
    const totalInv = data.reduce((sum, row) => sum + (Number(row.totalInv) || 0), 0);
    const totalPayment = data.reduce((sum, row) => sum + (Number(row.totalPayment) || 0), 0);

    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { startDate, endDate },
      total: data.length,
      saldoAwal,
      summary: {
        saldoAwal,
        totalGrn,
        totalInvoice: totalInv,
        totalPayment,
        totalBalance: saldoAwal + totalGrn + totalInv - totalPayment,
      },
      data,
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
    
 
exports.getJournalAp = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
       const pool = await getPool(dbName);
    // Default laporan tahunan Jan s/d Des 2026, bisa di-override lewat query
    const startDate = req.query.startDate || '2026-01-01';
    const endDate = req.query.endDate || '2026-12-31';

   // const start = new Date(startDate);
   // const end = new Date(endDate);

    const q = `
      Declare @startDate DateTime 
      Declare @endDate DateTime 
        
      Set @startDate = '${startDate}'  
      set @endDate = '${endDate}'

      select t1.* from (
        select  'APR' as 'prefix',  g.TranxID as 'id', g.TotalAmount as 'amount', g.SupplierID , s.SupplierName, g.ReceivedDate as 'date'
        from FinMsGRN as g
        left join FinMsSupplier as s on s.SupplierID = g.SupplierID
        where g.ReceivedDate between @startDate and @endDate  union all

        select 'API' as 'prefix', i.InvID as 'id', i.InvTotal as 'amount', i.SupplierID ,s.SupplierName, i.InvDate as 'date'
        from FinApInvoice i 
        left join FinMsSupplier as s on s.SupplierID = i.SupplierID
        where i.InvDate   between @startDate and @endDate

        union all
        select 'APP' as 'prefix', p.PaymentID as 'id', p.Amount as 'amount',  p.SupplierID ,s.SupplierName, p.PaymentDate as 'date'
        from FinApPayment p 
        left join FinMsSupplier as s on s.SupplierID = p.SupplierID
        where  p.PaymentDate   between @startDate and @endDate and p.status = 'CLOSED'
      ) as t1 
  
    `;



    const qGRN = `
      Declare @startDate DateTime 
      Declare @endDate DateTime 
        
      Set @startDate = '${startDate}'  
      set @endDate = '${endDate}' 

      select sum(g.TotalAmount) as 'amount'
      from FinMsGRN as g
      left join FinMsSupplier as s on s.SupplierID = g.SupplierID
      where g.ReceivedDate between @startDate and @endDate    
    `; 
  const GRN = await pool.query(qGRN);


   const qAPI = `
      Declare @startDate DateTime 
      Declare @endDate DateTime 
        
      Set @startDate = '${startDate}'  
      set @endDate = '${endDate}' 

       select sum(i.InvTotal) as 'amount' 
        from FinApInvoice i 
        left join FinMsSupplier as s on s.SupplierID = i.SupplierID
        where i.InvDate   between @startDate and @endDate 
    `; 
  const API = await pool.query(qAPI);


   const qAPP = `
      Declare @startDate DateTime 
      Declare @endDate DateTime 
        
      Set @startDate = '${startDate}'  
      set @endDate = '${endDate}' 

      select  sum(p.Amount) as 'amount'
        from FinApPayment p 
        left join FinMsSupplier as s on s.SupplierID = p.SupplierID
        where  p.PaymentDate   between @startDate and @endDate and p.status = 'CLOSED'
    `; 
  const APP = await pool.query(qAPP);



  const result = await pool.query(q);

    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: { startDate, endDate },
      q :q,
      summary : {
        grn : GRN.recordsets[0][0]['amount'],
        api : API.recordsets[0][0]['amount'],
 app : APP.recordsets[0][0]['amount'],

      },
      result : result.recordsets[0],
    });
  }
  catch (err) {
    return res.status(500).json({
      status: 'error getJournalAp',
      requestedDb: dbName,
      error: 'Gagal ambil detail laporan: ' + err.message,
    });
  }
}


exports.getJournalAmount = async (req, res) => {
  const dbName = validateDbNameOrRespond(req, res);
  if (!dbName) return;

  try {
       const pool = await getPool(dbName);
    // Default laporan tahunan Jan s/d Des 2026, bisa di-override lewat query
    const id = req.query.id ;
    const prefix = req.query.prefix ;

   // const start = new Date(startDate);
   // const end = new Date(endDate);

    const q = `
        select * from FinJurnalVoucher as v
        where v.voucherno like '%${id}' and v.voucherno like '${prefix}%' ;   
    `;



  let result = await pool.query(q);

    // Kalau query utama (prefix + id) tidak menghasilkan data,
    // fallback ke pencarian yang lebih longgar (top 1 berdasarkan id saja).
    if (!result.recordset || result.recordset.length === 0) {
      const q2 = `
        select top 1 * from FinJurnalVoucher as v
        where v.voucherno like '%${id}%' ;
      `;

      result = await pool.query(q2);

      return res.json({
        status: 'ok',
        requestedDb: dbName,
        filter: req.query,
        q: q2,
        result: result.recordsets[0],
      });
    }

    return res.json({
      status: 'ok',
      requestedDb: dbName,
      filter: req.query,
      q: q,
      result: result.recordsets[0],
    });
  }
  catch (err) {
    return res.status(500).json({
      status: 'error getJournalAmount',
      requestedDb: dbName,
      error: 'Gagal ambil detail laporan: ' + err.message,
    });
  }
}
