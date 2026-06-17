/**
 * UI translations — English and Tamil for every label in the app shell.
 * Tamil is the official first language of this govt platform.
 * Usage: const { t } = useTranslation()
 */
import { useAuthStore } from '../store/authStore';

const TRANSLATIONS = {
  en: {
    // Sidebar groups
    nav_overview: 'Overview',
    nav_study: 'Study',
    nav_intelligence: 'Intelligence',
    nav_tn_guidance: 'TN Guidance',
    nav_tools: 'Tools',
    nav_teachers: 'Teachers',

    // Sidebar links
    dashboard: 'Dashboard',
    study_planner: 'Study Planner',
    ai_tutor: 'AI Tutor',
    mock_tests: 'Mock Tests',
    flashcards: 'Flashcards',
    pyq_bank: 'PYQ Bank',
    ncert_coverage: 'NCERT Coverage',
    exam_strategy: 'Exam Strategy',
    progress_heatmap: 'Progress & Heatmap',
    nta_simulator: 'NTA Simulator',
    daily_lesson: 'Daily 5-Min Lesson',
    diagnostic_test: 'Diagnostic Test',
    samacheer_neet: 'Samacheer → NEET',
    tn_counselling: 'TN Counselling',
    career_paths: 'Career Paths',
    wellbeing: 'Wellbeing',
    analytics: 'Analytics',
    photo_doubt: 'Photo Doubt',
    voice_tutor: 'Voice Tutor',
    motivation: 'Motivation',
    teacher_portal: 'Teacher Portal',
    outcomes: 'Outcomes',
    snap_textbook: 'Snap Textbook',
    vocabulary_trainer: 'Vocabulary Trainer',
    ncert_exceptions: 'NCERT Exceptions',
    learning_tools: 'AI Learning Tools',
    rank_predictor: 'Rank & Colleges',
    performance: 'Performance',
    gamification: 'Progress & Rewards',
    chapter_tracker: 'Chapter Tracker',
    study_notes: 'Notes & Highlights',
    pomodoro: 'Pomodoro Timer',
    revision_heatmap: 'Revision Heatmap',
    quick_revise: 'Quick Revise',
    nav_community: 'Community',
    community: 'Community Hub',
    study_pods: 'Study Pods',
    parent_link: 'Parent Dashboard',

    // Language switcher
    lang_label: 'Language',

    // Footer
    footer_initiative: 'An initiative of the Government of Tamil Nadu',
    footer_privacy: 'Privacy Policy',
    footer_support: 'Support',

    // Branding
    app_name: 'NEET AI',
    app_tagline: 'AI-powered NEET preparation platform',
    tn_initiative: 'An initiative of the Government of Tamil Nadu',

    // Common actions
    logout: 'Logout',
    submit: 'Submit',
    save: 'Save',
    cancel: 'Cancel',
    next: 'Next',
    previous: 'Previous',
    loading: 'Loading…',
    try_again: 'Try Again',
  },

  ta: {
    // Sidebar groups
    nav_overview: 'கண்ணோட்டம்',
    nav_study: 'படிப்பு',
    nav_intelligence: 'திறன் பகுப்பாய்வு',
    nav_tn_guidance: 'TN வழிகாட்டுதல்',
    nav_tools: 'கருவிகள்',
    nav_teachers: 'ஆசிரியர்கள்',

    // Sidebar links
    dashboard: 'டாஷ்போர்டு',
    study_planner: 'படிப்பு திட்டமிடல்',
    ai_tutor: 'AI ஆசிரியர்',
    mock_tests: 'மாதிரி தேர்வுகள்',
    flashcards: 'ஃபிளாஷ்கார்டுகள்',
    pyq_bank: 'கடந்தகால கேள்விகள்',
    ncert_coverage: 'NCERT பாடங்கள்',
    exam_strategy: 'தேர்வு திட்டம்',
    progress_heatmap: 'முன்னேற்றம் & பலவீனங்கள்',
    nta_simulator: 'NTA சிமுலேட்டர்',
    daily_lesson: 'தினசரி 5 நிமிட பாடம்',
    diagnostic_test: 'கண்டறிதல் தேர்வு',
    samacheer_neet: 'சமச்சீர் → NEET',
    tn_counselling: 'TN கவுன்சிலிங்',
    career_paths: 'வாழ்க்கை வழிகள்',
    wellbeing: 'மன நலம்',
    analytics: 'பகுப்பாய்வு',
    photo_doubt: 'புகைப்பட சந்தேகம்',
    voice_tutor: 'குரல் ஆசிரியர்',
    motivation: 'உந்துதல்',
    teacher_portal: 'ஆசிரியர் போர்டல்',
    outcomes: 'பயண மைல்கற்கள்',
    snap_textbook: 'பாடப்புத்தக OCR',
    vocabulary_trainer: 'சொல்லகராதி பயிற்சி',
    ncert_exceptions: 'NCERT விதிவிலக்குகள்',
    learning_tools: 'AI கற்றல் கருவிகள்',
    rank_predictor: 'தர & கல்லூரி கணிப்பு',
    performance: 'செயல்திறன்',
    gamification: 'முன்னேற்றம் & பரிசுகள்',
    chapter_tracker: 'அத்தியாய கண்காணிப்பு',
    study_notes: 'குறிப்புகள் & சிறப்பம்சங்கள்',
    pomodoro: 'பொமோடோரோ கடிகாரம்',
    revision_heatmap: 'மறுவாசிப்பு வரைபடம்',
    quick_revise: 'விரைவு மறுவாசிப்பு',
    nav_community: 'சமூகம்',
    community: 'சமூக மையம்',
    study_pods: 'படிப்பு குழுக்கள்',
    parent_link: 'பெற்றோர் டாஷ்போர்டு',

    // Language switcher
    lang_label: 'மொழி',

    // Footer
    footer_initiative: 'தமிழ்நாடு அரசின் முன்முயற்சி',
    footer_privacy: 'தனியுரிமைக் கொள்கை',
    footer_support: 'உதவி',

    // Branding
    app_name: 'NEET AI',
    app_tagline: 'AI-சக்தி வாய்ந்த NEET தேர்வு தயாரிப்பு தளம்',
    tn_initiative: 'தமிழ்நாடு அரசின் முன்முயற்சி',

    // Common actions
    logout: 'வெளியேறு',
    submit: 'சமர்ப்பி',
    save: 'சேமி',
    cancel: 'ரத்து செய்',
    next: 'அடுத்தது',
    previous: 'முந்தையது',
    loading: 'ஏற்றுகிறது…',
    try_again: 'மீண்டும் முயற்சி',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS['en'];
export type Translations = typeof TRANSLATIONS['en'];

export function useTranslation() {
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const t = (key: TranslationKey): string => dict[key] ?? TRANSLATIONS.en[key] ?? key;
  return { t, lang, isTa: lang === 'ta' };
}
