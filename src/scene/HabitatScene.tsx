import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import * as THREE from 'three';
import { xrStore } from '../store/xrStore';
import type { DiveSite } from '../types/domain';
import { RovRig } from './RovRig';
import { TerrainModel, type TerrainReadyInfo } from './TerrainModel';
import { UnderwaterEnv } from './UnderwaterEnv';
import { Waypoints3D } from './Waypoints3D';

export interface HabitatSceneProps {
  dive: DiveSite;
  vrUiSlot?: ReactNode;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onRetry: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class HabitatErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error captured in state for user-friendly recovery UI
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '24px',
            background: '#040d14',
            color: '#e6f4ff',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            3D Scene Error
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85, maxWidth: '420px' }}>
            {this.state.error.message || 'Unable to initialize the underwater 3D viewport.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #38bdf8',
              background: '#0c2738',
              color: '#e6f4ff',
              cursor: 'pointer',
            }}
          >
            Retry 3D View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_FLOOR_Y = -5;
const DEFAULT_MOVE_SPEED = 12;

export function HabitatScene({ dive, vrUiSlot }: HabitatSceneProps) {
  const [terrainInfo, setTerrainInfo] = useState<{
    collider: TerrainReadyInfo['collider'] | null;
    floorY: number;
    baseMoveSpeedPerSec: number;
  }>({
    collider: null,
    floorY: DEFAULT_FLOOR_Y,
    baseMoveSpeedPerSec: DEFAULT_MOVE_SPEED,
  });

  const [contextLost, setContextLost] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const canvasCleanupRef = useRef<(() => void) | null>(null);

  // Reset collider reference when switching dive sites
  useEffect(() => {
    setTerrainInfo({
      collider: null,
      floorY: DEFAULT_FLOOR_Y,
      baseMoveSpeedPerSec: DEFAULT_MOVE_SPEED,
    });
  }, [dive.slug]);

  useEffect(() => {
    return () => {
      canvasCleanupRef.current?.();
      canvasCleanupRef.current = null;
    };
  }, []);

  const handleTerrainReady = useCallback((info: TerrainReadyInfo) => {
    setTerrainInfo(info);
  }, []);

  const handleRetry = useCallback(() => {
    setContextLost(false);
    setRetryKey((k) => k + 1);
  }, []);

  const handleCanvasCreated = useCallback((state: RootState) => {
    canvasCleanupRef.current?.();
    const dom = state.gl.domElement;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };

    dom.addEventListener('webglcontextlost', onContextLost);
    dom.addEventListener('webglcontextrestored', onContextRestored);

    canvasCleanupRef.current = () => {
      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <HabitatErrorBoundary onRetry={handleRetry}>
        <Canvas
          key={retryKey}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
          }}
          camera={{ fov: 80, near: 0.05, far: 250 }}
          onCreated={handleCanvasCreated}
        >
          <XR store={xrStore}>
            <UnderwaterEnv dive={dive} floorY={terrainInfo.floorY} />
            <TerrainModel dive={dive} onReady={handleTerrainReady} />
            <RovRig
              dive={dive}
              collider={terrainInfo.collider}
              floorY={terrainInfo.floorY}
              baseMoveSpeedPerSec={terrainInfo.baseMoveSpeedPerSec}
            />
            <Waypoints3D dive={dive} />
            {vrUiSlot}
          </XR>
        </Canvas>
      </HabitatErrorBoundary>

      {contextLost ? (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '24px',
            background: 'rgba(4, 13, 20, 0.92)',
            color: '#e6f4ff',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            WebGL2 Graphics Context Lost
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85, maxWidth: '420px' }}>
            The browser paused or reset the 3D graphics context. Reload the 3D viewport to continue exploring.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #38bdf8',
              background: '#0c2738',
              color: '#e6f4ff',
              cursor: 'pointer',
            }}
          >
            Reload 3D Scene
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default HabitatScene;
