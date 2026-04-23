import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type ReportFn = (metric: { name: string; value: number; rating: string }) => void;

function sendToSentry(metric: { name: string; value: number; rating: string }) {
  // Report to Sentry as a custom measurement if Sentry is loaded
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  import('@sentry/react').then(({ captureEvent }) => {
    captureEvent({
      message: `Web Vital: ${metric.name}`,
      level: metric.rating === 'poor' ? 'warning' : 'info',
      extra: { value: metric.value, rating: metric.rating },
    });
  }).catch(() => {});
}

export function reportWebVitals(report: ReportFn = sendToSentry) {
  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
}
