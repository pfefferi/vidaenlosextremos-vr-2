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
  let backgroundColor = 'rgba(255, 255, 255, 0.08)';
  let hoverBackground = 'rgba(255, 255, 255, 0.2)';
  let borderColor = 'rgba(255, 255, 255, 0.45)';
  let textColor = '#ffffff';

  if (accent) {
    backgroundColor = 'rgba(0, 163, 224, 0.25)';
    hoverBackground = 'rgba(0, 163, 224, 0.45)';
    borderColor = '#00aaff';
    textColor = '#ffffff';
  } else if (danger) {
    backgroundColor = 'rgba(255, 85, 85, 0.16)';
    hoverBackground = 'rgba(255, 85, 85, 0.35)';
    borderColor = '#ff5555';
    textColor = '#ff8888';
  } else if (active) {
    backgroundColor = '#ffffff';
    hoverBackground = '#e6e6e6';
    borderColor = '#ffffff';
    textColor = '#050508';
  }

  return (
    <Container
      paddingX={10}
      paddingY={6}
      minWidth={minWidth}
      borderRadius={4}
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
  valueColor?: string;
}

function TelemetryCell({ label, value, valueColor = '#ffffff' }: TelemetryCellProps) {
  return (
    <Container
      flexDirection="column"
      flexGrow={1}
      flexBasis={0}
      paddingX={10}
      paddingY={6}
      borderRadius={4}
      borderWidth={1}
      borderColor="rgba(255, 255, 255, 0.2)"
      backgroundColor="rgba(5, 8, 12, 0.72)"
      gap={2}
    >
      <Text fontSize={9} fontWeight="bold" color="rgba(255, 255, 255, 0.65)">
        {label}
      </Text>
      <Text fontSize={14} fontWeight="bold" color={valueColor}>
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
  const depthText = `${Math.round(telemetryLive.depthMeters)} M`;
  const tempText = activeDive ? `${activeDive.telemetry.temp.toFixed(2)} °C` : '-- °C';

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
      backgroundColor="rgba(5, 8, 12, 0.9)"
      borderColor="rgba(255, 255, 255, 0.3)"
      borderWidth={1.5}
      borderRadius={4}
      padding={12}
      flexDirection="column"
      justifyContent="space-between"
      gap={8}
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
            borderRadius={3}
            backgroundColor="rgba(0, 163, 224, 0.14)"
            borderWidth={1}
            borderColor="rgba(0, 163, 224, 0.45)"
          >
            <Text fontSize={10} fontWeight="bold" color="#00a3e0">
              {`ID ${activeDive?.id ?? '---'}`}
            </Text>
          </Container>
          <Text fontSize={13} fontWeight="bold" color="#ffffff">
            {activeDive ? t(activeDive.titleKey) : 'ROV SuBastian'}
          </Text>
        </Container>

        <Container
          paddingX={10}
          paddingY={4}
          borderRadius={4}
          borderWidth={1}
          borderColor={missionComplete ? '#00ff88' : 'rgba(255, 255, 255, 0.2)'}
          backgroundColor={
            missionComplete
              ? 'rgba(0, 255, 136, 0.18)'
              : gamifiedMode
                ? 'rgba(0, 0, 0, 0.5)'
                : 'rgba(0, 0, 0, 0.4)'
          }
        >
          <Text
            fontSize={10}
            fontWeight="bold"
            color={missionComplete ? '#00ff88' : '#ffffff'}
          >
            {`${t('ui.mission_analyzed')}: ${visitedCount} / ${siteWaypoints.length}`}
          </Text>
        </Container>
      </Container>

      {/* Telemetry & speed control row */}
      <Container flexDirection="row" alignItems="stretch" gap={8}>
        <TelemetryCell label="DEPTH" value={depthText} />
        <TelemetryCell label="TEMP." value={tempText} />
        <TelemetryCell label="HEADING" value={`${headingDeg} °`} />

        <Container
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          flexGrow={1.35}
          flexBasis={0}
          paddingX={10}
          paddingY={6}
          borderRadius={4}
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.2)"
          backgroundColor="rgba(5, 8, 12, 0.72)"
          gap={6}
        >
          <Container flexDirection="column" gap={2}>
            <Text fontSize={9} fontWeight="bold" color="rgba(255, 255, 255, 0.65)">
              {t('ui.speed')}
            </Text>
            <Text fontSize={14} fontWeight="bold" color="#00ff00">
              {formatSpeedLevel(speedLevel)}
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
