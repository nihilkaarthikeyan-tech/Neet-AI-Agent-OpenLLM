import { useState, useEffect } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

interface DayData { date: string; count: number; }
interface HeatmapData { days: DayData[]; activeDays: number; totalActivity: number; maxCount: number; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cellColor(count: number, max: number): string {
  if (count === 0) return '#0f172a';
  const intensity = Math.min(count / Math.max(max * 0.6, 1), 1);
  if (intensity < 0.25) return '#1e3a5f';
  if (intensity < 0.5)  return '#1d4ed8';
  if (intensity < 0.75) return '#3b82f6';
  return '#60a5fa';
}

function tooltip(day: DayData): string {
  if (day.count === 0) return `${day.date} — No activity`;
  return `${day.date} — ${day.count} activity points`;
}

export default function HeatmapPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/heatmap`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: HeatmapData) => setData(d))
      .catch(() => {/* show nothing */})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#64748b', padding: '40px 0' }}><Loader2 size={22} className="spin" /> Loading heatmap…</div>
    </div>
  );

  if (!data || !Array.isArray(data.days) || data.days.length === 0) return (
    <div className="page-container">
      <div style={{ color: '#64748b', padding: '40px 0' }}>No heatmap data available yet.</div>
    </div>
  );

  // Build 52-week grid (Sunday-start)
  // Align the days array to start at first Sunday on or before first day
  const firstDate = new Date(data.days[0]?.date ?? '');
  const dayOfWeek = firstDate.getDay(); // 0 = Sunday
  const paddedDays: (DayData | null)[] = [
    ...Array(dayOfWeek).fill(null),
    ...data.days,
  ];
  // Pad end to complete last week
  while (paddedDays.length % 7 !== 0) paddedDays.push(null);
  const weeks: (DayData | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) weeks.push(paddedDays.slice(i, i + 7));

  // Month labels — find where each month starts in the week grid
  const monthLabels: Array<{ week: number; month: string }> = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstReal = week.find((d) => d !== null);
    if (firstReal) {
      const month = new Date(firstReal.date).getMonth();
      if (month !== lastMonth) { monthLabels.push({ week: wi, month: MONTHS[month] }); lastMonth = month; }
    }
  });

  const CELL = 13;
  const GAP = 3;
  const totalWidth = weeks.length * (CELL + GAP);

  return (
    <div className="page-container">
      <div className="page-header">
        <CalendarDays size={28} className="page-icon" />
        <div>
          <h1 className="page-title">Revision Heatmap</h1>
          <p className="page-desc">Your study activity over the last 365 days — darker = more active</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Active Days', value: data.activeDays, color: '#60a5fa' },
          { label: 'Total Activity', value: data.totalActivity, color: '#22c55e' },
          { label: 'Inactive Days', value: 365 - data.activeDays, color: '#475569' },
          { label: 'Activity Score', value: `${Math.round((data.activeDays / 365) * 100)}%`, color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#1e293b', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '24px', fontWeight: 800, color: s.color, margin: '0 0 4px' }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: '#64748b' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div style={{ background: '#1e293b', borderRadius: '14px', padding: '24px', overflowX: 'auto' }}>
        {/* Month labels */}
        <div style={{ display: 'flex', marginLeft: '28px', marginBottom: '4px', width: `${totalWidth}px` }}>
          {Array.from({ length: weeks.length }, (_, wi) => {
            const ml = monthLabels.find((m) => m.week === wi);
            return (
              <div key={wi} style={{ width: CELL + GAP, flexShrink: 0, fontSize: '10px', color: '#475569', fontWeight: ml ? 600 : 400 }}>
                {ml?.month ?? ''}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0' }}>
          {/* Day labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, marginRight: '6px', paddingTop: '1px' }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{ height: CELL, fontSize: '10px', color: '#334155', lineHeight: `${CELL}px`, display: i % 2 === 1 ? 'block' : 'none' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'flex', gap: `${GAP}px` }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                {week.map((day, di) => (
                  <div key={di}
                    title={day ? tooltip(day) : ''}
                    onMouseEnter={() => day && setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={{
                      width: CELL, height: CELL, borderRadius: '2px',
                      background: day ? cellColor(day.count, data.maxCount) : 'transparent',
                      cursor: day ? 'default' : 'default',
                      transition: 'opacity 0.1s',
                    }} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend + tooltip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          {hoveredDay && hoveredDay.count > 0 ? (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{hoveredDay.date} — {hoveredDay.count} activity points</span>
          ) : <span />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569' }}>
            Less
            {[0, 0.2, 0.4, 0.7, 1].map((v, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: '2px', background: v === 0 ? '#0f172a' : cellColor(Math.round(v * data.maxCount), data.maxCount) }} />
            ))}
            More
          </div>
        </div>
      </div>

      {/* Monthly breakdown */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Monthly Breakdown</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
          {MONTHS.map((month, mi) => {
            const monthDays = data.days.filter((d) => new Date(d.date).getMonth() === mi);
            const activeMDays = monthDays.filter((d) => d.count > 0).length;
            const totalMActivity = monthDays.reduce((s, d) => s + d.count, 0);
            return (
              <div key={month} style={{ background: '#0f172a', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: activeMDays > 0 ? '#60a5fa' : '#334155', marginBottom: '2px' }}>{month}</p>
                <p style={{ fontSize: '20px', fontWeight: 800, color: activeMDays > 15 ? '#22c55e' : activeMDays > 7 ? '#f59e0b' : '#ef4444' }}>{activeMDays}</p>
                <p style={{ fontSize: '10px', color: '#475569' }}>active days</p>
                {totalMActivity > 0 && <p style={{ fontSize: '10px', color: '#334155', marginTop: '2px' }}>{totalMActivity} pts</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
