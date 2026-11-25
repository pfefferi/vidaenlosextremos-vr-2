import { Container, Text } from '@react-three/uikit';
import { useXR } from '@react-three/xr';
import { useTranslation } from 'react-i18next';
import { formatSpeedLevel, SPEED_LEVELS } from '../../engine/rovPhysics';
import { useRovStore } from '../../store/rovStore';

export interface VrCockpitHudProps {
  inXr: boolean;
}

interface HudButtonProps {
  label: string;
  onPress: () => void;
  active?: boolean;
  accent?: boolean;
  danger?: boolean;
  disabled?: boolean;
  minWidth?: number;
}

function HudButton({
  label,
  onPress,
  active = false,
  accent = false,
  danger = false,
  disabled = false,
  minWidth,
}: HudButtonProps) {
  let backgroundColor = 'rgba(13, 40, 61, 0.92)';
  let hoverBackground = 'rgba(20, 62, 92, 0.98)';
  let borderColor = 'rgba(0, 210, 255, 0.45)';
  let textColor = '#dff4ff';

  if (accent) {
    backgroundColor = '#009ec2';
    hoverBackground = '#00d2ff';
    borderColor = '#66ecff';
    textColor = '#031520';
  } else if (danger) {
    backgroundColor = 'rgba(84, 24, 36, 0.9)';
    hoverBackground = 'rgba(128, 34, 52, 0.96)';
    borderColor = 'rgba(255, 107, 129, 0.65)';
    textColor = '#ffe6ea';
  } else if (active) {
    backgroundColor = 'rgba(0, 140, 178, 0.42)';
    hoverBackground = 'rgba(0, 175, 216, 0.55)';
    borderColor = '#00d2ff';
    textColor = '#ffffff';
  }

  return (
    <Container
      paddingX={10}
      paddingY={6}
      minWidth={minWidth}
      borderRadius={8}
      borderWidth={1}
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      opacity={disabled ? 0.45 : 1}
      justifyContent="center"
      alignItems="center"
      cursor={disabled ? 'default' : 'pointer'}
      pointerEventsType={{ deny: 'grab' }}
      hover={disabled ? undefined : { backgroundColor: hoverBackground }}
      onClick={(event) => {
        event.stopPropagation?.();
        if (!disabled) {
          onPress();
        }
      }}
    >
      <Text
        fontSize={11}
        fontWeight={accent || active ? 'bold' : 'medium'}
        color={textColor}
      >
        {label}
      </Text>
    </Container>
  );
}

interface TelemetryCellProps {
  label: string;
  value: string;
}

function TelemetryCell({ label, value }: TelemetryCellProps) {
  return (
    <Container
      flexDirection="column"
      flexGrow={1}
      flexBasis={0}
      paddingX={10}
      paddingY={6}
      borderRadius={8}
      borderWidth={1}
      borderColor="rgba(0, 210, 255, 0.28)"
      backgroundColor="rgba(5, 17, 27, 0.85)"
      gap={2}
    >
      <Text fontSize={9} fontWeight="bold" color="#6bcce6">
        {label}
      </Text>
      <Text fontSize={14} fontWeight="bold" color="#f0fbff">
        {value}
      </Text>
    </Container>
  );
}

/**
 * Spatial ROV cockpit dash rendered via @react-three/uikit for WebXR and 3D Preview.
 */
export function VrCockpitHud({ inXr }: VrCockpitHudProps) {
  const { t } = useTranslation();
  const xrSession = useXR((s) => s.session);

  const activeDiveSlug = useRovStore((s) => s.activeDiveSlug);
  const dives = useRovStore((s) => s.dives);
  const waypointsBySite = useRovStore((s) => s.waypointsBySite);
  const language = useRovStore((s) => s.language);
  const setLanguage = useRovStore((s) => s.setLanguage);
  const gamifiedMode = useRovStore((s) => s.gamifiedMode);
  const speedIndex = useRovStore((s) => s.speedIndex);
  const stepSpeedIndex = useRovStore((s) => s.stepSpeedIndex);
  const comfortSnapTurn = useRovStore((s) => s.comfortSnapTurn);
  const setComfortSnapTurn = useRovStore((s) => s.setComfortSnapTurn);
  const setPreview3d = useRovStore((s) => s.setPreview3d);
  const activeWaypointId = useRovStore((s) => s.activeWaypointId);
  const openWaypointModal = useRovStore((s) => s.openWaypointModal);
  const visitedWaypointIds = useRovStore((s) => s.visitedWaypointIds);
  const telemetryLive = useRovStore((s) => s.telemetryLive);
  const triggerReset = useRovStore((s) => s.triggerReset);

  const activeDive = activeDiveSlug ? dives[activeDiveSlug] : undefined;
  const siteWaypoints = activeDiveSlug ? (waypointsBySite[activeDiveSlug] ?? []) : [];
  const visitedCount = siteWaypoints.filter((wp) => visitedWaypointIds.includes(wp.id)).length;

  const speedLevel = SPEED_LEVELS[speedIndex] ?? SPEED_LEVELS[0];
  const headingDeg = Math.round(((telemetryLive.headingDeg % 360) + 360) % 360)
    .toString()
    .padStart(3, '0');
  const depthText = `${Math.round(telemetryLive.depthMeters)} m`;
  const tempText = activeDive ? `${activeDive.telemetry.temp.toFixed(1)} °C` : '-- °C';

  const missionComplete = siteWaypoints.length > 0 && visitedCount >= siteWaypoints.length;

  const handleExit = () => {
    if (inXr) {
      void xrSession?.end();
    } else {
      setPreview3d(false);
    }
  };

  return (
    <Container
      sizeX={1.12}
      sizeY={0.34}
      pixelSize={0.0018}
      backgroundColor="rgba(7, 22, 34, 0.9)"
      borderColor="#00d2ff"
      borderWidth={2}
      borderRadius={14}
      padding={12}
      flexDirection="column"
      justifyContent="space-between"
      gap={8}
      panelMaterialClass="plastic"
    >
      {/* Top status bar: Dive ID + Site name + Mission counter */}
      <Container
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        gap={10}
      >
        <Container flexDirection="row" alignItems="center" gap={8}>
          <Container
            paddingX={8}
            paddingY={3}
            borderRadius={6}
            backgroundColor="rgba(0, 210, 255, 0.18)"
            borderWidth={1}
            borderColor="rgba(0, 210, 255, 0.5)"
          >
            <Text fontSize={10} fontWeight="bold" color="#66e3ff">
              {`${t('telemetry.id')} ${activeDive?.id ?? '---'}`}
            </Text>
          </Container>
          <Text fontSize={13} fontWeight="bold" color="#e8f7ff">
            {activeDive ? t(activeDive.titleKey) : 'ROV SuBastian'}
          </Text>
        </Container>

        <Container
          paddingX={10}
          paddingY={4}
          borderRadius={6}
          borderWidth={1}
          borderColor={missionComplete ? '#2ee59d' : 'rgba(0, 210, 255, 0.4)'}
          backgroundColor={
            missionComplete
              ? 'rgba(18, 92, 68, 0.55)'
              : gamifiedMode
                ? 'rgba(0, 120, 160, 0.32)'
                : 'rgba(6, 20, 32, 0.78)'
          }
        >
          <Text
            fontSize={10}
            fontWeight="bold"
            color={missionComplete ? '#7bffc9' : '#9ee7ff'}
          >
            {`${t('ui.mission_analyzed')}: ${visitedCount} / ${siteWaypoints.length}`}
          </Text>
        </Container>
      </Container>

      {/* Telemetry & speed control row */}
      <Container flexDirection="row" alignItems="stretch" gap={8}>
        <TelemetryCell label={t('telemetry.depth')} value={depthText} />
        <TelemetryCell label={t('telemetry.temp')} value={tempText} />
        <TelemetryCell label={t('telemetry.heading')} value={`${headingDeg}°`} />

        <Container
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          flexGrow={1.35}
          flexBasis={0}
          paddingX={10}
          paddingY={6}
          borderRadius={8}
          borderWidth={1}
          borderColor="rgba(0, 210, 255, 0.28)"
          backgroundColor="rgba(5, 17, 27, 0.85)"
          gap={6}
        >
          <Container flexDirection="column" gap={2}>
            <Text fontSize={9} fontWeight="bold" color="#6bcce6">
              {t('ui.speed')}
            </Text>
            <Text fontSize={14} fontWeight="bold" color="#f0fbff">
              {`${formatSpeedLevel(speedLevel)}x`}
            </Text>
          </Container>
          <Container flexDirection="row" gap={4} alignItems="center">
            <HudButton
              label="−"
              minWidth={28}
              disabled={speedIndex <= 0}
              onPress={() => stepSpeedIndex(-1)}
            />
            <HudButton
              label="+"
              minWidth={28}
              disabled={speedIndex >= SPEED_LEVELS.length - 1}
              onPress={() => stepSpeedIndex(1)}
            />
          </Container>
        </Container>
      </Container>

      {/* Bottom controls & contextual Explore CTA */}
      <Container
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        gap={8}
      >
        <Container flexDirection="row" alignItems="center" gap={6}>
          <HudButton
            label={`${t('vr.comfort_turn')}: ${comfortSnapTurn ? 'ON' : 'OFF'}`}
            active={comfortSnapTurn}
            onPress={() => setComfortSnapTurn(!comfortSnapTurn)}
          />
          <HudButton label={t('ui.reset_position')} onPress={triggerReset} />
          <HudButton
            label={language === 'es' ? 'ES | en' : 'es | EN'}
            active
            onPress={() => setLanguage(language === 'es' ? 'en' : 'es')}
          />
        </Container>

        <Container flexDirection="row" alignItems="center" gap={6}>
          {activeWaypointId ? (
            <HudButton
              label={t('ui.explore')}
              accent
              onPress={() => openWaypointModal(activeWaypointId)}
            />
          ) : null}
          <HudButton
            label={inXr ? t('vr.exit') : `${t('vr.preview_3d')} ✕`}
            danger
            onPress={handleExit}
          />
        </Container>
      </Container>
    </Container>
  );
}

export default VrCockpitHud;
