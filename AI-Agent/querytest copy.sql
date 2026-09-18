Declare @startDate DateTime
Declare @endDate DateTime
Declare @lastPaymentDate DateTime
Declare @supplierId varchar(50)
              
Set @startDate = '2024-01-01'
Set @endDate ='2026-01-01'
set @lastPaymentDate = '2027-01-01'
 set @supplierId = 'H.0001'

select 'GRN' as 'Type ID', g.TranxID as 'Id',  g.ReceivedDate as 'date',  
g.TotalAmount 'GRN Amount',  0 as 'totalInv', '' as 'paymentId', 0 'totalPayment' , 
g.TotalAmount  as 'sisaHutang' 
from FinMsGRN as g
left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
where  (g.ReceivedDate between  @startDate and @endDate)
and id.InvID is null and  g.SupplierID = @supplierId
 
 union all

select 
	'INV' as 'Type ID', t1.InvID as 'Id' , (select a.InvDate from FinApInvoice a where a.InvID = t1.InvID) as 'date', 
	0 as 'GRN Amount',   t1.totalInvoice 'totalInv',  pd.PaymentID, (pd.PayAmt+pd.AmtAdj) as 'totalPayment' , 
	t1.totalInvoice - (pd.PayAmt+pd.AmtAdj) as 'sisaHutang' 
 from (
		select   id.InvID, sum(id.InvAmt) as 'totalInvoice'
		from FinMsGRN as g
		left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
		where  g.ReceivedDate between  @startDate and @lastPaymentDate
			and g.SupplierID = @supplierId
		group by id.InvID 
	) as t1
left join FinApPaymentDetail as pd on pd.InvID = t1.InvID