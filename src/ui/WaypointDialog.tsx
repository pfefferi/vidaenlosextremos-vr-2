import { X } from 'lucide-react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { type SyntheticEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getAssetEntry, resolveAssetUrl } from '../engine/assetUrl';
import { useRovStore } from '../store/rovStore';

export function WaypointDialog() {
  const { t } = useTranslation();

  const activeDiveSlug = useRovStore((s) => s.activeDiveSlug);
  const waypointsBySite = useRovStore((s) => s.waypointsBySite);
  const openModalWaypointId = useRovStore((s) => s.openModalWaypointId);
  const language = useRovStore((s) => s.language);
  const setLanguage = useRovStore((s) => s.setLanguage);
  const closeWaypointModal = useRovStore((s) => s.closeWaypointModal);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const pswpOpenRef = useRef(false);

  const siteWaypoints = activeDiveSlug ? (waypointsBySite[activeDiveSlug] ?? []) : [];
  const activeWaypoint = openModalWaypointId
    ? siteWaypoints.find((wp) => wp.id === openModalWaypointId) ?? null
    : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activeWaypoint) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [activeWaypoint]);

  useEffect(() => {
    const galleryEl = galleryRef.current;
    const dialogEl = dialogRef.current;
    const galleryItems = activeWaypoint?.content.gallery;

    if (!activeWaypoint || !galleryEl || !galleryItems?.length) {
      return;
    }

    const lightbox = new PhotoSwipeLightbox({
      gallery: galleryEl,
      children: 'a[data-pswp-width]',
      pswpModule: () => import('photoswipe'),
      appendToEl: dialogEl ?? undefined,
      wheelToZoom: true,
    });

    lightbox.on('openingAnimationStart', () => {
      pswpOpenRef.current = true;
    });
    lightbox.on('close', () => {
      pswpOpenRef.current = false;
    });
    lightbox.on('destroy', () => {
      pswpOpenRef.current = false;
    });

    lightbox.init();

    return () => {
      pswpOpenRef.current = false;
      lightbox.destroy();
    };
  }, [activeWaypoint?.id, activeWaypoint?.content.gallery?.length]);

  const handleCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (pswpOpenRef.current) {
      return;
    }
    closeWaypointModal();
  };

  return (
    <dialog
      ref={dialogRef}
      className="wp-dialog"
      aria-labelledby={activeWaypoint ? 'wp-dialog-title' : undefined}
      onCancel={handleCancel}
      onClick={(e) => {
        if (e.target === dialogRef.current && !pswpOpenRef.current) {
          closeWaypointModal();
        }
      }}
      data-testid="waypoint-dialog"
    >
      {activeWaypoint ? (
        <div className="wp-dialog__shell">
          <header className="wp-dialog__header">
            <h2 id="wp-dialog-title" className="wp-dialog__title">
              {t(activeWaypoint.titleKey)}
            </h2>
            <div className="wp-dialog__header-actions">
              <div
                className="lang-toggle"
                role="group"
                aria-label={t('menu.language')}
                data-testid="dialog-lang-toggle"
              >
                <button
                  type="button"
                  className={`lang-toggle__btn${language === 'es' ? ' is-active' : ''}`}
                  aria-pressed={language === 'es'}
                  onClick={() => setLanguage('es')}
                >
                  ES
                </button>
                <button
                  type="button"
                  className={`lang-toggle__btn${language === 'en' ? ' is-active' : ''}`}
                  aria-pressed={language === 'en'}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
              </div>
              <button
                type="button"
                className="wp-dialog__close"
                onClick={closeWaypointModal}
                aria-label={t('controls.close')}
                data-testid="btn-close-waypoint"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="wp-dialog__body">
            <p className="wp-dialog__description">{t(activeWaypoint.content.descriptionKey)}</p>

            {activeWaypoint.content.youtubeId ? (
              <div className="wp-dialog__video">
                <div className="wp-dialog__video-frame">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${activeWaypoint.content.youtubeId}?rel=0`}
                    title={t(activeWaypoint.titleKey)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {activeWaypoint.content.videoCaptionKey ? (
                  <p className="wp-dialog__caption">{t(activeWaypoint.content.videoCaptionKey)}</p>
                ) : null}
              </div>
            ) : null}

            {activeWaypoint.content.gallery?.length ? (
              <div ref={galleryRef} className="wp-gallery" data-testid="waypoint-gallery">
                {activeWaypoint.content.gallery.map((item) => {
                  const thumbEntry = getAssetEntry(item.thumbKey);
                  const fullEntry = getAssetEntry(item.fullKey);
                  const thumbUrl = resolveAssetUrl(item.thumbKey);
                  const fullUrl = resolveAssetUrl(item.fullKey);
                  const caption = t(item.captionKey);

                  return (
                    <figure key={item.fullKey} className="wp-gallery__item">
                      <a
                        className="wp-gallery__link"
                        href={fullUrl}
                        data-pswp-width={fullEntry.width ?? 1600}
                        data-pswp-height={fullEntry.height ?? 900}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={thumbUrl}
                          alt={caption}
                          width={thumbEntry.width ?? 400}
                          height={thumbEntry.height ?? 266}
                          loading="lazy"
                          decoding="async"
                        />
                      </a>
                      <figcaption className="wp-gallery__caption">{caption}</figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

export default WaypointDialog;
