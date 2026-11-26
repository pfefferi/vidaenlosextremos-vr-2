import { useTranslation } from 'react-i18next';
import { resolveAssetUrl } from '../engine/assetUrl';
import { useRovStore } from '../store/rovStore';

export function MissionMenu() {
  const { t } = useTranslation();
  const view = useRovStore((s) => s.view);
  const dives = useRovStore((s) => s.dives);
  const language = useRovStore((s) => s.language);
  const setLanguage = useRovStore((s) => s.setLanguage);
  const launchDive = useRovStore((s) => s.launchDive);

  if (view !== 'menu') {
    return null;
  }

  const diveList = Object.values(dives);

  return (
    <div className="mission-menu" data-testid="mission-menu">
      <div className="bg-overlay" aria-hidden="true" />

      <div
        className="lang-selector"
        role="group"
        aria-label={t('menu.language')}
        data-testid="menu-lang-toggle"
      >
        <button
          type="button"
          className={`lang-btn${language === 'en' ? ' active' : ''}`}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
          data-testid="menu-lang-en"
        >
          EN
        </button>
        <button
          type="button"
          className={`lang-btn${language === 'es' ? ' active' : ''}`}
          aria-pressed={language === 'es'}
          onClick={() => setLanguage('es')}
          data-testid="menu-lang-es"
        >
          ES
        </button>
      </div>

      <header className="mission-menu__header">
        <h1>{t('menu.title')}</h1>
        <div className="expedition-tag">{t('menu.expedition')}</div>
      </header>

      <main className="mission-grid" aria-label={t('menu.expedition')}>
        {diveList.map((dive) => {
          const isComingSoon = dive.status === 'coming_soon';
          const env600 = resolveAssetUrl(dive.cards.env600);
          const env1200 = resolveAssetUrl(dive.cards.env1200);
          const close600 = resolveAssetUrl(dive.cards.close600);
          const close1200 = resolveAssetUrl(dive.cards.close1200);

          return (
            <article
              key={dive.slug}
              className={`mission-card${isComingSoon ? ' disabled' : ''}`}
              onClick={isComingSoon ? undefined : () => launchDive(dive.slug)}
              data-testid={`dive-card-${dive.slug}`}
            >
              <div className="card-img-container">
                <img
                  src={env600}
                  srcSet={`${env600} 600w, ${env1200} 1200w`}
                  sizes="(max-width: 768px) 92vw, 300px"
                  width={600}
                  height={360}
                  alt={t(dive.titleKey)}
                  className="card-img img-env"
                  loading="eager"
                  decoding="async"
                />
                <img
                  src={close600}
                  srcSet={`${close600} 600w, ${close1200} 1200w`}
                  sizes="(max-width: 768px) 92vw, 300px"
                  width={600}
                  height={360}
                  alt=""
                  aria-hidden="true"
                  className="card-img img-closeup"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="card-body">
                <div className="dive-id">
                  {t('menu.dive_id')} {dive.id}
                </div>
                <div className="dive-title">{t(dive.titleKey)}</div>
                <div className="dive-stats">
                  <span>
                    {t('menu.depth')}: {dive.telemetry.depth} m
                  </span>
                </div>
                {isComingSoon ? (
                  <button
                    type="button"
                    className="launch-btn"
                    disabled
                    aria-disabled="true"
                    data-testid={`launch-${dive.slug}`}
                  >
                    {t('menu.coming_soon')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="launch-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      launchDive(dive.slug);
                    }}
                    data-testid={`launch-${dive.slug}`}
                  >
                    {t('menu.launch')}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </main>

      <footer className="mission-menu__footer">
        <p>{t('menu.footer')}</p>
        <p className="credits">
          <span>{t('credits.assets')}</span>{' '}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="license noopener noreferrer"
          >
            CC BY-NC-SA 4.0
          </a>
          <span>{t('credits.sharealike')}</span>
        </p>
        <details className="credits-models">
          <summary>{t('credits.models_title')}</summary>
          <ul>
            <li>
              “-WF-” by{' '}
              <a
                href="https://sketchfab.com/DeepSeaBEE"
                target="_blank"
                rel="noopener noreferrer"
              >
                DeepSeaBEE
              </a>{' '}
              (
              <a
                href="https://sketchfab.com/3d-models/wf-2639e4d3e6a14db1ba6fbe65c2f92481"
                target="_blank"
                rel="noopener noreferrer"
              >
                Sketchfab
              </a>
              ) — CC BY 4.0
            </li>
            <li>
              “FKt Clam Bed - Partial Survey Render” by{' '}
              <a
                href="https://sketchfab.com/DeepSeaBEE"
                target="_blank"
                rel="noopener noreferrer"
              >
                DeepSeaBEE
              </a>{' '}
              (
              <a
                href="https://sketchfab.com/3d-models/fkt-clam-bed-partial-survey-render-d55a372d074a45b99c03e46d7c70aae5"
                target="_blank"
                rel="noopener noreferrer"
              >
                Sketchfab
              </a>
              ) — CC BY 4.0
            </li>
          </ul>
        </details>
      </footer>
    </div>
  );
}

export default MissionMenu;
