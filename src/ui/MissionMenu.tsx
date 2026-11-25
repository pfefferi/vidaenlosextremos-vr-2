import { Compass, Lock, Play } from 'lucide-react';
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
  const logoUrl = resolveAssetUrl('brand.logo');

  return (
    <div className="mission-menu" data-testid="mission-menu">
      <header className="mission-menu__header">
        <div className="mission-menu__brand">
          <img
            className="mission-menu__logo"
            src={logoUrl}
            alt={t('menu.title')}
            width={256}
            height={256}
            decoding="async"
          />
          <div>
            <h1 className="mission-menu__title">{t('menu.title')}</h1>
            <p className="mission-menu__expedition">{t('menu.expedition')}</p>
          </div>
        </div>

        <div
          className="lang-toggle"
          role="group"
          aria-label={t('menu.language')}
          data-testid="menu-lang-toggle"
        >
          <button
            type="button"
            className={`lang-toggle__btn${language === 'es' ? ' is-active' : ''}`}
            aria-pressed={language === 'es'}
            onClick={() => setLanguage('es')}
            data-testid="menu-lang-es"
          >
            ES
          </button>
          <button
            type="button"
            className={`lang-toggle__btn${language === 'en' ? ' is-active' : ''}`}
            aria-pressed={language === 'en'}
            onClick={() => setLanguage('en')}
            data-testid="menu-lang-en"
          >
            EN
          </button>
        </div>
      </header>

      <main className="mission-menu__main">
        <section className="dive-grid" aria-label={t('menu.expedition')}>
          {diveList.map((dive) => {
            const isComingSoon = dive.status === 'coming_soon';
            const env600 = resolveAssetUrl(dive.cards.env600);
            const env1200 = resolveAssetUrl(dive.cards.env1200);

            return (
              <article
                key={dive.slug}
                className={`dive-card${isComingSoon ? ' dive-card--coming-soon' : ''}`}
                data-testid={`dive-card-${dive.slug}`}
              >
                <div className="dive-card__media">
                  <img
                    className="dive-card__image"
                    src={env600}
                    srcSet={`${env600} 600w, ${env1200} 1200w`}
                    sizes="(max-width: 768px) 92vw, 360px"
                    width={600}
                    height={360}
                    alt={t(dive.titleKey)}
                    loading="eager"
                    decoding="async"
                  />
                  <div className="dive-card__badges">
                    <span className="dive-card__id">
                      {t('menu.dive_id')} {dive.id}
                    </span>
                    {isComingSoon ? (
                      <span className="dive-card__status">{t('menu.coming_soon')}</span>
                    ) : null}
                  </div>
                </div>

                <div className="dive-card__body">
                  <h2 className="dive-card__title">{t(dive.titleKey)}</h2>

                  <dl className="dive-card__telemetry">
                    <div className="dive-card__metric">
                      <dt>{t('telemetry.depth')}</dt>
                      <dd>{dive.telemetry.depth} m</dd>
                    </div>
                    <div className="dive-card__metric">
                      <dt>{t('telemetry.temp')}</dt>
                      <dd>{dive.telemetry.temp.toFixed(2)} °C</dd>
                    </div>
                    <div className="dive-card__metric">
                      <dt>{t('telemetry.salinity')}</dt>
                      <dd>{dive.telemetry.salinity.toFixed(2)} PSU</dd>
                    </div>
                    <div className="dive-card__metric">
                      <dt>{t('telemetry.o2')}</dt>
                      <dd>{dive.telemetry.o2} µmol/kg</dd>
                    </div>
                  </dl>

                  {isComingSoon ? (
                    <button
                      type="button"
                      className="dive-card__cta dive-card__cta--disabled"
                      disabled
                      aria-disabled="true"
                      data-testid={`launch-${dive.slug}`}
                    >
                      <Lock size={16} aria-hidden="true" />
                      <span>{t('menu.coming_soon')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="dive-card__cta"
                      onClick={() => launchDive(dive.slug)}
                      data-testid={`launch-${dive.slug}`}
                    >
                      <Play size={16} aria-hidden="true" />
                      <span>{t('menu.launch')}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <footer className="mission-menu__footer">
        <div className="mission-menu__footer-primary">
          <Compass size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} aria-hidden="true" />
          {t('menu.footer')}
        </div>
        <p className="mission-menu__credits">
          {t('credits.assets')}{' '}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">
            CC BY-NC-SA 4.0
          </a>
          {t('credits.sharealike')}
        </p>
        <p className="mission-menu__credits">
          {t('credits.models_title')}: Schmidt Ocean Institute (Sketchfab) —{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </p>
      </footer>
    </div>
  );
}

export default MissionMenu;
