
SALDO AWAL

-- TAGIHAN berdasrkan GRN
select g.ReceivedDate 'Date', 'Received' as 'Source', g.TranxID,  g.TotalAmount 'Invoice', 0 as 'Paid' , 'GRN' as 'ID'
from FinMsGRN g
where g.SupplierID = 'CA001' 
and g.ReceivedDate < '2026-01-10'

UNION 
-- GRN SUDAH DIBAYAR
select 
	p.PaymentDate 'Date', 'Payment' as 'Source', 
 g.TranxID, 0 as 'Invoice',    g.TotalAmount 'Paid' , appd.PaymentID as 'Source'
	
from FinMsGRN as g
join FinApInvoiceDetail as apid on apid.TranxID = g.TranxID
 join FinApPaymentDetail as appd on apid.InvID = appd.InvID
left join FinApPayment as p on p.PaymentID = appd.PaymentID
where g.SupplierID = 'CA001'
and 	p.PaymentDate < '2026-01-10'
order by TranxID DESC
;
--select top 2 * from FinApPayment;
select top 2 * from FinApPaymentDetail;