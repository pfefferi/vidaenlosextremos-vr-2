import { useEffect, useState } from 'react';
import { Container, Image, Text, Video } from '@react-three/uikit';
import { useTranslation } from 'react-i18next';
import { resolveAssetUrl } from '../../engine/assetUrl';
import { useRovStore } from '../../store/rovStore';

/**
 * Spatial 3D waypoint inspection modal rendered with @react-three/uikit.
 */
export function VrWaypointModal() {
  const { t } = useTranslation();

  const activeDiveSlug = useRovStore((s) => s.activeDiveSlug);
  const waypointsBySite = useRovStore((s) => s.waypointsBySite);
  const openModalWaypointId = useRovStore((s) => s.openModalWaypointId);
  const closeWaypointModal = useRovStore((s) => s.closeWaypointModal);

  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    setGalleryIndex(0);
  }, [openModalWaypointId]);

  if (!openModalWaypointId || !activeDiveSlug) {
    return null;
  }

  const waypoints = waypointsBySite[activeDiveSlug] ?? [];
  const waypoint = waypoints.find((wp) => wp.id === openModalWaypointId);
  if (!waypoint) {
    return null;
  }

  const gallery = waypoint.content.gallery ?? [];
  const hasGallery = gallery.length > 0;
  const hasVrVideo =
    typeof waypoint.content.vrVideoKey === 'string' && waypoint.content.vrVideoKey.length > 0;
  const hasVideoSection = Boolean(waypoint.content.youtubeId) || hasVrVideo;
  const hasMedia = hasGallery || hasVideoSection;

  const safeGalleryIndex = hasGallery ? Math.min(galleryIndex, gallery.length - 1) : 0;
  const activeGalleryItem = hasGallery ? gallery[safeGalleryIndex] : undefined;

  const handlePrev = () => {
    if (gallery.length <= 1) return;
    setGalleryIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  const handleNext = () => {
    if (gallery.length <= 1) return;
    setGalleryIndex((prev) => (prev + 1) % gallery.length);
  };

  return (
    <Container
      sizeX={1.25}
      maxHeight={380}
      pixelSize={0.0018}
      backgroundColor="rgba(7, 22, 34, 0.94)"
      borderColor="#00d2ff"
      borderWidth={2}
      borderRadius={16}
      padding={14}
      flexDirection="column"
      gap={10}
      panelMaterialClass="plastic"
    >
      {/* Header */}
      <Container
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        gap={12}
        flexShrink={0}
        paddingBottom={8}
        borderBottomWidth={1}
        borderColor="rgba(0, 210, 255, 0.35)"
      >
        <Text fontSize={18} fontWeight="bold" color="#66e3ff" flexGrow={1}>
          {t(waypoint.titleKey)}
        </Text>

        <Container
          width={34}
          height={34}
          borderRadius={8}
          borderWidth={1}
          borderColor="rgba(255, 107, 129, 0.65)"
          backgroundColor="rgba(84, 24, 36, 0.9)"
          justifyContent="center"
          alignItems="center"
          cursor="pointer"
          pointerEventsType={{ deny: 'grab' }}
          hover={{ backgroundColor: 'rgba(136, 36, 56, 0.96)' }}
          onClick={(event) => {
            event.stopPropagation?.();
            closeWaypointModal();
          }}
        >
          <Text fontSize={15} fontWeight="bold" color="#ffe6ea">
            ✕
          </Text>
        </Container>
      </Container>

      {/* Main Content */}
      <Container
        flexDirection={hasMedia ? 'row' : 'column'}
        gap={14}
        flexGrow={1}
        overflow="hidden"
      >
        {/* Scrollable description column */}
        <Container
          flexDirection="column"
          flexGrow={1}
          flexBasis={0}
          maxHeight={290}
          overflow="scroll"
          paddingRight={8}
          scrollbarColor="#00d2ff"
          scrollbarWidth={4}
        >
          <Text
            fontSize={13}
            lineHeight={1.48}
            color="#dceef7"
            flexShrink={0}
          >
            {t(waypoint.content.descriptionKey)}
          </Text>
        </Container>

        {/* Media column: Gallery & Video */}
        {hasMedia ? (
          <Container
            flexDirection="column"
            width={325}
            maxHeight={290}
            overflow="scroll"
            flexShrink={0}
            gap={10}
            scrollbarColor="#00d2ff"
            scrollbarWidth={4}
          >
            {activeGalleryItem ? (
              <Container flexDirection="column" gap={6} flexShrink={0}>
                <Container
                  width="100%"
                  height={172}
                  backgroundColor="#0b2234"
                  borderRadius={10}
                  borderWidth={1}
                  borderColor="rgba(0, 210, 255, 0.4)"
                  overflow="hidden"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Image
                    src={resolveAssetUrl(activeGalleryItem.fullKey)}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />
                </Container>

                <Container
                  flexDirection="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={8}
                >
                  <Container
                    paddingX={12}
                    paddingY={5}
                    borderRadius={7}
                    borderWidth={1}
                    borderColor="rgba(0, 210, 255, 0.45)"
                    backgroundColor="rgba(13, 40, 61, 0.92)"
                    opacity={gallery.length <= 1 ? 0.4 : 1}
                    cursor={gallery.length <= 1 ? 'default' : 'pointer'}
                    pointerEventsType={{ deny: 'grab' }}
                    hover={
                      gallery.length <= 1
                        ? undefined
                        : { backgroundColor: 'rgba(20, 62, 92, 0.98)' }
                    }
                    onClick={(event) => {
                      event.stopPropagation?.();
                      handlePrev();
                    }}
                  >
                    <Text fontSize={13} fontWeight="bold" color="#dff4ff">
                      ‹
                    </Text>
                  </Container>

                  <Text fontSize={11} fontWeight="bold" color="#9ee7ff">
                    {`${safeGalleryIndex + 1} / ${gallery.length}`}
                  </Text>

                  <Container
                    paddingX={12}
                    paddingY={5}
                    borderRadius={7}
                    borderWidth={1}
                    borderColor="rgba(0, 210, 255, 0.45)"
                    backgroundColor="rgba(13, 40, 61, 0.92)"
                    opacity={gallery.length <= 1 ? 0.4 : 1}
                    cursor={gallery.length <= 1 ? 'default' : 'pointer'}
                    pointerEventsType={{ deny: 'grab' }}
                    hover={
                      gallery.length <= 1
                        ? undefined
                        : { backgroundColor: 'rgba(20, 62, 92, 0.98)' }
                    }
                    onClick={(event) => {
                      event.stopPropagation?.();
                      handleNext();
                    }}
                  >
                    <Text fontSize={13} fontWeight="bold" color="#dff4ff">
                      ›
                    </Text>
                  </Container>
                </Container>

                <Text fontSize={11} lineHeight={1.35} color="#9bc7dd">
                  {t(activeGalleryItem.captionKey)}
                </Text>
              </Container>
            ) : null}

            {hasVideoSection ? (
              hasVrVideo && waypoint.content.vrVideoKey ? (
                <Container flexDirection="column" gap={6} flexShrink={0}>
                  <Container
                    width="100%"
                    height={190}
                    backgroundColor="#041019"
                    borderRadius={10}
                    borderWidth={1}
                    borderColor="rgba(0, 210, 255, 0.45)"
                    overflow="hidden"
                  >
                    <Video
                      src={resolveAssetUrl(waypoint.content.vrVideoKey)}
                      width="100%"
                      height="100%"
                      objectFit="cover"
                      autoplay
                      loop
                      muted={false}
                      crossOrigin="anonymous"
                    />
                  </Container>
                  {waypoint.content.videoCaptionKey ? (
                    <Text fontSize={11} lineHeight={1.35} color="#9bc7dd">
                      {t(waypoint.content.videoCaptionKey)}
                    </Text>
                  ) : null}
                </Container>
              ) : (
                <Container
                  flexDirection="column"
                  gap={8}
                  padding={14}
                  borderRadius={10}
                  borderWidth={1}
                  borderColor="rgba(0, 210, 255, 0.45)"
                  backgroundColor="rgba(10, 34, 52, 0.92)"
                  flexShrink={0}
                >
                  <Text fontSize={10} fontWeight="bold" color="#00d2ff">
                    {waypoint.content.youtubeId
                      ? `YOUTUBE · ${waypoint.content.youtubeId}`
                      : 'VIDEO'}
                  </Text>
                  <Text fontSize={13} fontWeight="bold" color="#f0f8ff" lineHeight={1.35}>
                    {t('vr.video_unavailable')}
                  </Text>
                  {waypoint.content.videoCaptionKey ? (
                    <Text fontSize={11} lineHeight={1.4} color="#9bc7dd">
                      {t(waypoint.content.videoCaptionKey)}
                    </Text>
                  ) : null}
                </Container>
              )
            ) : null}
          </Container>
        ) : null}
      </Container>
    </Container>
  );
}

export default VrWaypointModal;
