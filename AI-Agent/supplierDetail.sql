Declare @startDate DateTime
Declare @endDate DateTime
Declare @lastPaymentDate DateTime
Declare @supplierId varchar(50)
              
              
Set @startDate = '2026-01-01'
Set @endDate ='2026-09-18'
set @lastPaymentDate = '2027-01-01'
set @supplierId = 'A.0011'
 
 select x1.* from (
	-- DATA GRN
 	select 'GRN' as 'TypeID', g.TranxID as 'Id', '' as 'paymentId', g.ReceivedDate as 'date',  
		g.TotalAmount 'GrnAmount',  0 as 'totalInv',  0 'totalPayment' 
	from FinMsGRN as g
	left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
	where  (g.ReceivedDate between  @startDate and @endDate)
		and id.InvID is null and  g.SupplierID = @supplierId
 
	union all

	select a1.* from (
		-- DATA INV
		select 
			'INV' as 'TypeID', t1.InvID as 'Id' , '' as 'PaymentID', i.InvDate as 'date', 
			0 as 'GrnAmount',   t1.totalInvoice 'totalInv',   0 as 'totalPayment'
		from (
				select   id.InvID, sum(id.InvAmt) as 'totalInvoice'
				from FinMsGRN as g
				left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
				where  g.ReceivedDate between  @startDate and @endDate
					and g.SupplierID = @supplierId
				group by id.InvID 
		) as t1
		join FinApInvoice as i on i.InvID = t1.InvID 
		where  i.InvDate between @startDate and @endDate
			
		union all 

		-- DATA PAYMENT
		select 
			'PAYMENT' as 'TypeID', t1.InvID as 'Id' ,  pd.PaymentID, i.InvDate as 'date', 
			0 as 'GrnAmount',  0 'totalInv',  (pd.PayAmt+pd.AmtAdj) as 'totalPayment'

		from (
				select   id.InvID, sum(id.InvAmt) as 'totalInvoice'
				from FinMsGRN as g
				left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
				where  g.ReceivedDate between  @startDate and @endDate
					and g.SupplierID = @supplierId
				group by id.InvID 
			) as t1
		left join FinApInvoice as i on i.InvID = t1.InvID
		left join FinApPaymentDetail as pd on pd.InvID = t1.InvID
		left join FinApPayment as p on  pd.PaymentID = p.PaymentID

		where p.Status = 'CLOSED'   and p.PaymentDate between @startDate and  @lastPaymentDate
	) a1 

) as x1 
 order by x1.TypeID asc , x1.Id ASC, x1.date ASC

 