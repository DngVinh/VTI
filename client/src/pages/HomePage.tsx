import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { featureFlags } from '../config/featureFlags';
import { AppShell } from '../layouts/AppShell';
import { useTranslation } from '../locales/I18nContext';

interface TrackItem {
  tag: string;
  tagBg: string;
  tagColor: string;
  titleKey: string;
  titleDefault: string;
  skillsKey: string;
  skillsDefault: string;
  param: string;
}

const TRACKS: TrackItem[] = [
  {
    tag: 'FE',
    tagBg: 'bg-indigo-50',
    tagColor: 'text-indigo-600',
    titleKey: 'home.trackFeTitle',
    titleDefault: 'Frontend Developer',
    skillsKey: 'home.trackFeSkills',
    skillsDefault: 'React, TypeScript, Next.js, Web Vitals, CSS Architecture, State Management',
    param: 'frontend',
  },
  {
    tag: 'BE',
    tagBg: 'bg-emerald-50',
    tagColor: 'text-emerald-600',
    titleKey: 'home.trackBeTitle',
    titleDefault: 'Backend Engineer',
    skillsKey: 'home.trackBeSkills',
    skillsDefault: 'Node.js, Go, Java, Microservices, SQL Optimization, Caching & Auth',
    param: 'backend',
  },
  {
    tag: 'OPS',
    tagBg: 'bg-sky-50',
    tagColor: 'text-sky-600',
    titleKey: 'home.trackOpsTitle',
    titleDefault: 'DevOps & Cloud',
    skillsKey: 'home.trackOpsSkills',
    skillsDefault: 'Docker, Kubernetes, CI/CD Pipelines, Terraform, AWS/GCP Reliability',
    param: 'devops',
  },
  {
    tag: 'SD',
    tagBg: 'bg-purple-50',
    tagColor: 'text-purple-600',
    titleKey: 'home.trackSdTitle',
    titleDefault: 'System Design & Arch',
    skillsKey: 'home.trackSdSkills',
    skillsDefault: 'High Concurrency, Message Queue, Sharding, CAP Theorem, CDN & Latency',
    param: 'system-design',
  },
];

interface StageItem {
  number: string;
  stageBadge: string;
  badgeClass: string;
  titleKey: string;
  titleDefault: string;
  descKey: string;
  descDefault: string;
}

const STAGES: StageItem[] = [
  {
    number: '01',
    stageBadge: 'STAGE 1',
    badgeClass: 'bg-indigo-50 text-indigo-700',
    titleKey: 'home.stage1Title',
    titleDefault: 'Nạp Đề & Giải Mã JD',
    descKey: 'home.stage1Desc',
    descDefault: 'Tùy biến theo vị trí tuyển dụng hoặc tải lên tệp JD. Bộ lọc ngữ nghĩa tự động trích xuất Tech Stack, độ khó và các câu hỏi thực tế sát tiêu chí doanh nghiệp.',
  },
  {
    number: '02',
    stageBadge: 'STAGE 2',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    titleKey: 'home.stage2Title',
    titleDefault: 'Phòng Thi Mô Phỏng Trực Chiến',
    descKey: 'home.stage2Desc',
    descDefault: 'Thực chiến với đồng hồ đếm ngược, trình gõ câu trả lời thời gian thực kèm tính năng lưu nháp tự động chống mất bài khi mạng gặp sự cố.',
  },
  {
    number: '03',
    stageBadge: 'STAGE 3',
    badgeClass: 'bg-purple-50 text-purple-700',
    titleKey: 'home.stage3Title',
    titleDefault: 'Hội Đồng Thẩm Định Đa Tác Tử',
    descKey: 'home.stage3Desc',
    descDefault: 'Đánh giá theo Rubric STAR nhiều tầng (Tech Lead, Bar Raiser), xuất biểu đồ Radar 5 trục và gợi ý chính xác tài liệu cần đọc để bù đắp lỗ hổng.',
  },
];

export const HomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="relative overflow-hidden bg-slate-50/80 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px),radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(99,102,241,0.06),transparent_70%)] [background-size:24px_24px,100%_100%]">
        {/* Hero Section: Engineering Cockpit */}
        <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24" aria-label={t('home.heroSection', 'Phần giới thiệu')}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Architectural Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200/90 text-slate-700 text-xs sm:text-sm font-mono mb-6 shadow-2xs">
              <span className="flex items-center justify-center w-4 h-4 rounded text-emerald-600" aria-hidden="true">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </span>
              <span>{t('home.heroBadge', 'Nền tảng phỏng vấn kỹ thuật thế hệ mới với Trí Tuệ Nhân Tạo')}</span>
            </div>

            {/* High-Contrast Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-[1.15] max-w-3xl mx-auto">
              <span className="block text-slate-900">
                {t('home.heroTitle1', 'Nâng tầm kỹ năng phỏng vấn')}
              </span>
              <span className="block mt-1 sm:mt-2 text-indigo-700">
                {t('home.heroTitle2', 'Chinh phục nhà tuyển dụng IT')}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
              {t('home.heroSubtitle', 'Hệ thống mô phỏng phỏng vấn thông minh, phân tích sâu 5 chiều năng lực chuyên môn và đề xuất lộ trình hoàn thiện kỹ năng cá nhân hóa.')}
            </p>

            {/* CTAs with tactile affordance */}
            <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <Link
                to="/setup"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 sm:px-7 sm:py-3.5 rounded-xl text-sm sm:text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-sm hover:shadow-md transition-all duration-150 gap-2"
              >
                <span>{t('home.startInterviewCta', 'Bắt đầu phỏng vấn ngay')}</span>
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>

              <Link
                to="/questions"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 sm:px-7 sm:py-3.5 rounded-xl text-sm sm:text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 active:scale-[0.98] shadow-2xs transition-all gap-2"
              >
                <span>{t('home.browseQuestionsCta', '📚 Thư viện câu hỏi & Lời giải')}</span>
              </Link>

              {user?.role === 'ADMIN' && featureFlags.questionBankAdminUi && (
                <Link
                  to="/admin/question-bank"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 sm:px-7 sm:py-3.5 rounded-xl text-sm sm:text-base font-semibold text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 transition-all"
                >
                  {t('home.adminManageCta', 'Quản lý Question Bank')}
                </Link>
              )}
            </div>

            {/* Product Proof: Interactive Studio Preview Window */}
            <div className="mt-12 sm:mt-14 max-w-4xl mx-auto text-left rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
              {/* macOS Style Window Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-slate-300 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="w-3 h-3 rounded-full bg-rose-500/90 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/90 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/90 inline-block" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-slate-400">interview-cockpit-live.tsx</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" aria-hidden="true" />
                  <span>SESSION #4892 · SYSTEM DESIGN ARCHITECT</span>
                </div>
              </div>

              {/* Window Body: 2 Columns Split */}
              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/50">
                {/* Left Column: AI Question & Live Answer */}
                <div className="md:col-span-7 p-5 sm:p-6 space-y-4 bg-white">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      AI Interviewer (Principal Architect)
                    </span>
                    <span className="text-slate-400 font-mono">Câu 3 / 8</span>
                  </div>

                  <div>
                    <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      "Làm thế nào bạn thiết kế hàng đợi phân tán chống mất thông điệp khi traffic đột biến 100k req/s?"
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                      Yêu cầu làm rõ: Idempotency keys, cơ chế Dead Letter Queue và đảm bảo Exactly-once processing.
                    </p>
                  </div>

                  {/* Simulated Code & Architecture Snippet */}
                  <div className="rounded-lg bg-slate-900 p-3.5 font-mono text-xs text-slate-200 overflow-x-auto">
                    <div className="text-slate-500 mb-1">// Candidate Live Implementation</div>
                    <div><span className="text-indigo-400">const</span> broker = <span className="text-amber-300">new</span> KafkaProducer({'{'} acks: <span className="text-emerald-400">'all'</span>, retries: <span className="text-cyan-400">5</span> {'}'});</div>
                    <div><span className="text-indigo-400">await</span> broker.<span className="text-sky-300">sendTransaction</span>({'{'} idempotencyKey, payload {'}'});</div>
                  </div>
                </div>

                {/* Right Column: Instant Rubric & Multi-Agent Feedback */}
                <div className="md:col-span-5 p-5 sm:p-6 bg-slate-50/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Rubric Assessment
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                      Điểm: 9.2 / 10
                    </span>
                  </div>

                  {/* STAR Matrix Pills */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs">
                      <span className="font-semibold text-slate-700">Tình huống (Situation)</span>
                      <span className="text-emerald-600 font-bold">Rõ ràng ✓</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs">
                      <span className="font-semibold text-slate-700">Hành động kỹ thuật (Action)</span>
                      <span className="text-emerald-600 font-bold">Sâu sắc ✓</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs">
                      <span className="font-semibold text-slate-700">Tối ưu chi phí (Result)</span>
                      <span className="text-indigo-600 font-bold">Thuyết phục ✓</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-950">
                    <div className="font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" aria-hidden="true" />
                      Tech Lead Nhận Xét
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Ứng viên phân biệt tốt giữa At-least-once và Exactly-once. Đề xuất Dead Letter Queue chính xác.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Metrics Strip: Seamless Benchmarks */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-14 sm:mb-18" aria-label={t('home.metricsSection', 'Thước đo năng lực')}>
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-2 sm:p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
              <div className="p-4">
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">{t('home.metricQuestions', '500+')}</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{t('home.metricQuestionsLabel', 'Câu hỏi chuẩn hóa')}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('home.metricQuestionsSub', 'Frontend, Backend, DevOps, System Design')}</div>
              </div>
              <div className="p-4">
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">{t('home.metricDimensions', '5')}</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{t('home.metricDimensionsLabel', 'Trục năng lực đánh giá')}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('home.metricDimensionsSub', 'Phân tích biểu đồ Radar chuyên sâu')}</div>
              </div>
              <div className="p-4">
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">{t('home.metricFeedback', '100%')}</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{t('home.metricFeedbackLabel', 'AI Feedback tức thì')}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('home.metricFeedbackSub', 'Chấm điểm đa tác tử theo Rubric')}</div>
              </div>
              <div className="p-4">
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">{t('home.metricBilingual', 'VI & EN')}</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{t('home.metricBilingualLabel', 'Song ngữ linh hoạt')}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('home.metricBilingualSub', 'Luyện phản xạ phỏng vấn quốc tế')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Flight Simulator: 3-Stage Experience */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 sm:mb-20" aria-label={t('home.featuresSection', 'Các tính năng cốt lõi')}>
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t('home.featuresTitle', 'Mọi tính năng cần thiết để bứt phá')}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-500">
              {t('home.featuresSubtitle', 'Mô hình huấn luyện phi công: Rèn luyện đối đáp kỹ thuật, bẫy kiến trúc và áp lực thời gian thực.')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {STAGES.map((stage) => (
              <div key={stage.number} className="relative rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-indigo-600/30">{stage.number}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold font-mono ${stage.badgeClass}`}>
                    {stage.stageBadge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t(stage.titleKey, stage.titleDefault)}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {t(stage.descKey, stage.descDefault)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Role Quick-Launch Tracker */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 sm:mb-20" aria-label={t('home.trackSection', 'Lộ trình luyện tập')}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600">Track Launchpad</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                {t('home.trackTitle', 'Chọn lộ trình, sẵn sàng thử sức ngay')}
              </h2>
            </div>
            <Link
              to="/setup"
              className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>{t('home.viewAllTracks', 'Xem toàn bộ chuyên môn')}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRACKS.map((track) => (
              <Link
                key={track.tag}
                to={`/setup?track=${track.param}`}
                className="group p-5 rounded-xl border border-slate-200/90 bg-white hover:border-indigo-400 hover:shadow-md transition-all text-left"
              >
                <div className={`w-9 h-9 rounded-lg ${track.tagBg} ${track.tagColor} flex items-center justify-center font-mono font-bold text-sm mb-3 group-hover:scale-105 transition-transform`}>
                  {track.tag}
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {t(track.titleKey, track.titleDefault)}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {t(track.skillsKey, track.skillsDefault)}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA Bottom Banner: Dark Studio Terminal */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-14 sm:mb-18" aria-label={t('home.ctaBannerSection', 'Bắt đầu phiên phỏng vấn')}>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 text-white p-7 sm:p-10 text-center relative overflow-hidden shadow-xl">
            <div className="relative z-10 max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-emerald-400 text-xs font-mono mb-4">
                <span>$</span>
                <span>ready --start interview-session</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {t('home.ctaTitle', 'Sẵn sàng bắt đầu buổi phỏng vấn thử?')}
              </h2>
              <p className="mt-3 text-slate-400 text-sm sm:text-base">
                {t('home.ctaSubtitle', 'Chỉ mất 2 phút để cấu hình và bạn có thể luyện tập ngay lập tức với hệ thống AI.')}
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  to="/setup"
                  className="inline-flex items-center px-6 py-3.5 sm:px-7 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md transition-all"
                >
                  {t('home.ctaButton', 'Tạo phiên phỏng vấn miễn phí')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
};
