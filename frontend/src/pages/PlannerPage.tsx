import { useState, useEffect } from 'react';
import { Calendar, Loader2, Target, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';

interface PlanDay {
  day: string;
  focus: string;
  tasks: string[];
}

export default function PlannerPage() {
  const lang = useLang();
  const isTa = lang === 'ta';
  const [examDate, setExamDate] = useState('2026-05-04');
  const [weakSubjects, setWeakSubjects] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<PlanDay[] | null>(null);
  const [error, setError] = useState('');

  // Load existing plan on mount
  useEffect(() => {
    api.get<{ studyPlan: { planJson: { plan: PlanDay[] }; examDate: string; weakSubjects: string[] } | null }>('/api/planner')
      .then((data) => {
        if (data.studyPlan) {
          setPlan(data.studyPlan.planJson.plan);
          setExamDate(data.studyPlan.examDate.split('T')[0]);
          setWeakSubjects(data.studyPlan.weakSubjects.join(', '));
        }
      })
      .catch(() => {/* no plan yet, that's fine */})
      .finally(() => setIsLoading(false));
  }, []);

  const generatePlan = async () => {
    if (!weakSubjects.trim()) {
      setError(isTa ? 'குறைந்தது ஒரு பலவீன பாடத்தை உள்ளிடவும்.' : 'Please enter at least one weak subject.');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    
    try {
      const data = await api.post<{ studyPlan: { planJson: { plan: PlanDay[] } } }>('/api/planner/generate', {
        examDate,
        language: lang,
        weakSubjects: weakSubjects.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setPlan(data.studyPlan.planJson.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-loading-center">
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Calendar size={28} className="page-icon" />
        <div>
          <h1 className="page-title">{isTa ? 'AI படிப்பு திட்டமிடல்' : 'AI Study Planner'}</h1>
          <p className="page-desc">{isTa ? 'AI மூலம் இயங்கும் உங்கள் தனிப்பயன் தினசரி அட்டவணை' : 'Your personalized daily schedule powered by AI'}</p>
        </div>
      </div>

      <div className="planner-grid">
        {/* Onboarding / Setup Card */}
        <div className="auth-card panel-card panel-card--dark" style={{ maxWidth: '100%', animation: 'none', marginBottom: '24px' }}>
          <h2 className="section-heading">{isTa ? 'திட்ட அளவுருக்கள்' : 'Plan Parameters'}</h2>
          
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-form form-panel" style={{ maxWidth: '500px' }}>
            <div className="input-group input-group--compact">
              <label htmlFor="examDate">{isTa ? 'இலக்கு தேர்வு தேதி' : 'Target Exam Date'}</label>
              <div className="input-wrap">
                <Target size={16} className="input-icon" />
                <input
                  id="examDate"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group input-group--compact">
              <label htmlFor="subjects">{isTa ? 'பலவீனமான பாடங்கள்/தலைப்புகள் (கமாவால் பிரிக்கவும்)' : 'Weakest Subjects/Topics (comma separated)'}</label>
              <div className="input-wrap">
                <input
                  id="subjects"
                  type="text"
                  placeholder={isTa ? 'எ.கா. ஒளியியல், கரிம வேதியியல், மனித உடலியல்' : 'e.g. Optics, Organic Chemistry, Human Physiology'}
                  value={weakSubjects}
                  onChange={(e) => setWeakSubjects(e.target.value)}
                />
              </div>
            </div>

            <button 
              className="btn-primary btn-accent" 
              onClick={generatePlan} 
              disabled={isGenerating}
            >
              {isGenerating ? (
                <><Loader2 size={16} className="spin" /> {isTa ? 'திட்டம் உருவாக்கப்படுகிறது...' : 'Generating Plan...'}</>
              ) : (
                isTa ? '7-நாள் உத்தியை உருவாக்கு' : 'Generate 7-Day Strategy'
              )}
            </button>
          </div>
        </div>

        {/* Visualized Plan Canvas */}
        {plan && (
          <div className="plan-timeline">
            <h2 className="section-heading" style={{ marginBottom: '20px' }}>{isTa ? 'உங்கள் தனிப்பயன் 7-நாள் உத்தி' : 'Your Personalized 7-Day Strategy'}</h2>
            <div className="plan-stack">
              {plan.map((dayPlan, i) => (
                <div key={i} className="quick-card plan-day-card">
                  <div className="plan-day-head">
                    <div className="plan-day-marker">
                      {dayPlan.day.split(' ')[1] || i + 1}
                    </div>
                    <div>
                      <h3 className="plan-day-title">{dayPlan.day}</h3>
                      <p className="plan-day-subtitle">{dayPlan.focus}</p>
                    </div>
                  </div>
                  
                  <ul className="task-list">
                    {dayPlan.tasks.map((task, j) => (
                      <li key={j} className="task-item">
                        <CheckCircle2 size={16} className="task-icon" />
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
