import { storeLabel } from './performance';
import type { MonthStoreRow } from './upload-performance';

/** The label the weekly report uses for a store of the upload feed ("Profesor Dashboard - store"). Client-safe. */
export const reportLabel = (r: Pick<MonthStoreRow, 'project' | 'store' | 'workspace'>) => storeLabel({ source: r.project === 'profesor' ? 'dashboard' : 'reline', store: r.store, workspace: r.workspace });
