import { STATUS_LABELS } from '../constants/statuses.js';

export default function StatusBadge({ status }) {
  if (!status) return <span className="badge badge-neutral">—</span>;
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
