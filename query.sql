select  g.SupplierID, g.TranxID , g.Status, g.SupplierID , g.ReceivedDate,  g.TotalAmount, 0 as InvAmt, 0 as uninvoice
from FinMsGRN g 
where g.ReceivedDate between '2026-01-01' and '2026-02-01' and g.SupplierID = 'AS.002';

select t1.SupplierID, sum(t1.TotalAmount) TotalAmount, sum(t1.InvAmt) InvAmt, sum(t1.TotalAmount - t1.InvAmt) as 'uninvoice'  from (
select  g.SupplierID, sum(g.TotalAmount) as 'TotalAmount' , 0 'InvAmt' 
from FinMsGRN g 
where g.ReceivedDate between '2026-01-01' and '2026-02-01' and g.SupplierID = 'AS.002'
group by g.SupplierID 
union all
select g.SupplierID, 0 'TotalAmount', sum(id.InvAmt) 'InvAmt' 
from FinMsGRN g
left join FinApInvoiceDetail as id on id.TranxID = g.TranxID
where g.ReceivedDate between '2026-01-01' and '2026-02-01' and g.SupplierID = 'AS.002'
group by g.SupplierID 
) as t1
group by t1.SupplierID
;


