import React from 'react';
import QuickCommPage from './QuickCommPage';

interface DocsPageProps {
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

/**
 * Re-exporting QuickCommPage to replace the old Docs/SRT page seamlessly
 * while preserving backward compatibility across all routes and links.
 */
export default function DocsPage(props: DocsPageProps) {
  return <QuickCommPage {...props} />;
}
