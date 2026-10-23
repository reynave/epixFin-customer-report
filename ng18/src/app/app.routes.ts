import { Routes } from '@angular/router';
import { LauncherComponent } from './pages/launcher/launcher.component';
import { CustomerComponent } from './pages/customer/customer.component';
import { CustomerDetailComponent } from './pages/customer-detail/customer-detail.component';
import { CustomerDetailAllComponent } from './pages/customer-detail-all/customer-detail-all.component';
import { CustomerListComponent } from './pages/customer-list/customer-list.component';
import { YearlyComponent } from './pages/yearly/yearly.component';
import { JournalComponent } from './pages/journal/journal.component';

export const routes: Routes = [
  { path: '', component: LauncherComponent },
  { path: 'customer', component: CustomerComponent },
  { path: 'journal', component: JournalComponent },
  
  { path: 'customer-detail', component: CustomerDetailComponent },
  { path: 'customer-detail-all', component: CustomerDetailAllComponent },
  { path: 'customer-list', component: CustomerListComponent },
  { path: 'yearly', component: YearlyComponent },

  { path: '**', redirectTo: '' },
];

