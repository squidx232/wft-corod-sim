import React, { useState } from 'react';
import { useT } from '../i18n';
import { soundManager } from '../utils/audio';
import { Play } from 'lucide-react';

interface IntroSplashProps {
  /** Called after the swoosh-out animation completes, to reveal the dashboard. */
  onEnter: () => void;
}

/**
 * Full-screen intro/buffer page shown before the dashboard. A blurred hero image
 * backdrop, the product branding, and a big Start/Enter button. Clicking Start
 * plays a swoosh-out transition (whole screen slides/zooms away) and then calls
 * `onEnter` to mount the dashboard.
 */
export const IntroSplash: React.FC<IntroSplashProps> = ({ onEnter }) => {
  const { t } = useT();
  const [leaving, setLeaving] = useState(false);

  const handleEnter = () => {
    if (leaving) return;
    soundManager.playMetalTap();
    setLeaving(true);
    // Match the CSS swoosh duration (700ms) before revealing the dashboard.
    window.setTimeout(onEnter, 720);
  };

  return (
    <div className={`intro-splash ${leaving ? 'intro-splash--leaving' : ''}`}>
      {/* Blurred hero backdrop */}
      <div
        className="intro-splash__bg"
        style={{ backgroundImage: "url('/branding/intro-bg.jfif')" }}
      />
      <div className="intro-splash__scrim" />

      {/* Foreground content */}
      <div className="intro-splash__content">
        <img
          src="/branding/wft-logo.jfif"
          alt="Weatherford"
          className="w-20 h-20 rounded-2xl object-cover shadow-2xl bg-white/90 mb-6"
        />
        <div className="text-red-500 font-semibold tracking-[0.3em] text-xs uppercase mb-2">
          {t('intro.eyebrow')}
        </div>
        <h1 className="text-white text-3xl sm:text-5xl font-black text-center drop-shadow-lg max-w-3xl leading-tight">
          {t('intro.title')}
        </h1>
        <p className="text-slate-200 text-sm sm:text-base text-center mt-4 max-w-xl">
          {t('intro.subtitle')}
        </p>

        <button
          type="button"
          onClick={handleEnter}
          className="intro-splash__cta group mt-10 inline-flex items-center gap-3 px-10 py-4 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-lg uppercase tracking-wider shadow-2xl active:scale-95 transition-all"
        >
          <Play className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          {t('intro.start')}
        </button>

        <div className="mt-10 text-slate-300/80 text-xs font-mono text-center">
          Developed by{' '}
          <a
            href="https://linkedin.com/in/whereishassan"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:text-red-300 hover:underline font-semibold"
          >
            @whereishassan
          </a>{' '}
          — ALS Egypt Team
        </div>
      </div>
    </div>
  );
};
