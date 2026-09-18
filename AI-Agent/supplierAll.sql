Declare @startDate DateTime
Declare @endDate DateTime
Declare @lastPaymentDate DateTime
Declare @supplierId varchar(50)
               
Set @startDate = '2026-01-01'
Set @endDate ='2026-09-18'
set @lastPaymentDate = '2027-01-01' 
 
 select s.SupplierName, x1.SupplierID, sum(x1.GrnAmount) as 'GrnAmount' , sum(x1.totalInv) as 'totalInv', 
 sum(x1.totalPayment) as 'totalPayment',

  sum(x1.GrnAmount + x1.totalInv - x1.totalPayment) as 'Hutang'

 
 from (
	-- DATA GRN
 	select g.SupplierID,   
		g.TotalAmount 'GrnAmount',  0 as 'totalInv',  0 'totalPayment' 
	from FinMsGRN as g
	left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
	where  (g.ReceivedDate between  @startDate and @endDate)
		and id.InvID is null 
 
	union all

	select a1.* from (
		-- DATA INV
		select 
			t1.SupplierID,  
			0 as 'GrnAmount',   t1.totalInvoice 'totalInv',   0 as 'totalPayment'
		from (
				select g.SupplierID,  id.InvID, sum(id.InvAmt) as 'totalInvoice'
				from FinMsGRN as g
				left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
				where  g.ReceivedDate between  @startDate and @endDate 
				group by id.InvID ,  g.SupplierID
		) as t1
		join FinApInvoice as i on i.InvID = t1.InvID 
		where  i.InvDate between @startDate and @endDate
			
		union all 

		-- DATA PAYMENT
		select 
			t1.SupplierID, 
			 
			0 as 'GrnAmount',  0 'totalInv',  (pd.PayAmt+pd.AmtAdj) as 'totalPayment'

		from (
				select  g.SupplierID, id.InvID, sum(id.InvAmt) as 'totalInvoice'
				from FinMsGRN as g
				left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
				where  g.ReceivedDate between  @startDate and @endDate 
				group by id.InvID ,  g.SupplierID
			) as t1
		left join FinApInvoice as i on i.InvID = t1.InvID
		left join FinApPaymentDetail as pd on pd.InvID = t1.InvID
		left join FinApPayment as p on  pd.PaymentID = p.PaymentID

		where p.Status = 'CLOSED'   and p.PaymentDate between @startDate and  @lastPaymentDate
	) a1 

) as x1 
join FinMsSupplier as s  on s.SupplierID = x1.SupplierID
group by x1.SupplierID, s.SupplierName
order by x1.SupplierID ASC

 