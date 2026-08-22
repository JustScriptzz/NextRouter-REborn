'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminRefresh() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      await fetch('/api/admin/refresh', { method: 'POST' });
      router.refresh();
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  }

  return (
    <button type="button" onClick={refresh} disabled={busy} className="btn-primary shrink-0">
      {busy ? 'Refreshing...' : 'Refresh catalog'}
    </button>
  );
}
