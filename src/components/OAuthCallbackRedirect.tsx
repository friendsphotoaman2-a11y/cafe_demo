'use client';

import { useEffect } from 'react';
import { withBasePath } from '@/lib/base-path';

export function OAuthCallbackRedirect() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        const next = searchParams.get('next') || '/manager';
        window.location.href = `${withBasePath('/auth/callback')}?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
      }
    }
  }, []);

  return null;
}
