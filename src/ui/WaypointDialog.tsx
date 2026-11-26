import { X } from 'lucide-react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
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
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);
  const pswpOpenRef = useRef(false);
  const lastPswpCloseAtRef = useRef(0);

  const [featuredIndex, setFeaturedIndex] = useState(0);

  const siteWaypoints = activeDiveSlug ? (waypointsBySite[activeDiveSlug] ?? []) : [];
  const activeWaypoint = openModalWaypointId
    ? siteWaypoints.find((wp) => wp.id === openModalWaypointId) ?? null
    : null;

  useEffect(() => {
    setFeaturedIndex(0);
  }, [activeWaypoint?.id]);

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

    lightbox.on('beforeOpen', () => {
      pswpOpenRef.current = true;
    });
    lightbox.on('openingAnimationStart', () => {
      pswpOpenRef.current = true;
    });
    lightbox.on('close', () => {
      if (pswpOpenRef.current) {
        lastPswpCloseAtRef.current = performance.now();
      }
      pswpOpenRef.current = false;
    });
    lightbox.on('destroy', () => {
      pswpOpenRef.current = false;
    });

    lightbox.init();
    lightboxRef.current = lightbox;

    return () => {
      pswpOpenRef.current = false;
      lightboxRef.current = null;
      lightbox.destroy();
    };
  }, [activeWaypoint?.id, activeWaypoint?.content.gallery?.length]);

  const handleCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (pswpOpenRef.current) {
      lightboxRef.current?.pswp?.close();
      return;
    }
    if (performance.now() - lastPswpCloseAtRef.current < 150) {
      return;
    }
    closeWaypointModal();
  };

  const gallery = activeWaypoint?.content.gallery ?? [];
  const safeFeaturedIndex =
    gallery.length > 0 ? Math.min(featuredIndex, gallery.length - 1) : 0;
  const featuredItem = gallery.length > 0 ? gallery[safeFeaturedIndex] : undefined;

  return (
    <dialog
      ref={dialogRef}
      id="modal-card"
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
          <header className="modal-header">
            <h2 id="wp-dialog-title" className="modal-title">
              {t(activeWaypoint.titleKey)}
            </h2>
            <div className="modal-header-actions">
              <div
                className="lang-selector modal-lang-selector"
                role="group"
                aria-label={t('menu.language')}
                data-testid="dialog-lang-toggle"
              >
                <button
                  type="button"
                  className={`lang-btn${language === 'es' ? ' active' : ''}`}
                  aria-pressed={language === 'es'}
                  onClick={() => setLanguage('es')}
                >
                  ES
                </button>
                <button
                  type="button"
                  className={`lang-btn${language === 'en' ? ' active' : ''}`}
                  aria-pressed={language === 'en'}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeWaypointModal}
                aria-label={t('controls.close')}
                data-testid="btn-close-waypoint"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="modal-body">
            {activeWaypoint.content.youtubeId ? (
              <>
                <div className="video-wrapper">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${activeWaypoint.content.youtubeId}?rel=0&modestbranding=1`}
                    title={t(activeWaypoint.titleKey)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {activeWaypoint.content.videoCaptionKey ? (
                  <div className="media-caption">{t(activeWaypoint.content.videoCaptionKey)}</div>
                ) : null}
              </>
            ) : null}

            {gallery.length > 0 && featuredItem ? (
              <>
                <div className="modal-gallery-v2">
                  <button
                    type="button"
                    className="gallery-main"
                    onClick={() => lightboxRef.current?.loadAndOpen(safeFeaturedIndex)}
                    aria-label={t(featuredItem.captionKey)}
                  >
                    <img
                      src={resolveAssetUrl(featuredItem.fullKey)}
                      alt={t(featuredItem.captionKey)}
                      decoding="async"
                    />
                    <div className="gallery-caption">{t(featuredItem.captionKey)}</div>
                  </button>

                  <div
                    ref={galleryRef}
                    className="gallery-thumbs-row"
                    data-testid="waypoint-gallery"
                  >
                    {gallery.map((item, idx) => {
                      const thumbEntry = getAssetEntry(item.thumbKey);
                      const fullEntry = getAssetEntry(item.fullKey);
                      const thumbUrl = resolveAssetUrl(item.thumbKey);
                      const fullUrl = resolveAssetUrl(item.fullKey);
                      const caption = t(item.captionKey);

                      return (
                        <a
                          key={item.fullKey}
                          className={`gallery-thumb${idx === safeFeaturedIndex ? ' active' : ''}`}
                          href={fullUrl}
                          data-pswp-width={fullEntry.width ?? 1600}
                          data-pswp-height={fullEntry.height ?? 900}
                          onMouseEnter={() => setFeaturedIndex(idx)}
                          onFocus={() => setFeaturedIndex(idx)}
                          onClick={() => setFeaturedIndex(idx)}
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
                      );
                    })}
                  </div>
                </div>

                <div className="gallery-credits">
                  <span>{t('credits.assets')}</span>{' '}
                  <a
                    href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                    target="_blank"
                    rel="license noopener noreferrer"
                  >
                    CC BY-NC-SA 4.0
                  </a>
                  <span>{t('credits.sharealike')}</span>
                </div>
              </>
            ) : null}

            <p className="wp-dialog__description modal-desc">
              {t(activeWaypoint.content.descriptionKey)}
            </p>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

export default WaypointDialog;
