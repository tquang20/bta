import React, { useEffect, useRef } from 'react';
import { NormalizedLandmark, LANDMARKS } from '../lib/cv/MotionFSM';

interface SkeletalOverlayProps {
  landmarks: NormalizedLandmark[] | null;
  mode: 'full' | 'game';
  isCalibrating: boolean;
  calibrationProgress: number;
  dArm: number;
  dTorso: number;
  currentState: 0 | 1 | 2;
  nextExpectedHand?: 'left' | 'right' | 'any';
  mirror: boolean;
  width: number;
  height: number;
}

// Full 33-point MediaPipe pose connections for Lobby mode
const POSE_CONNECTIONS: [number, number][] = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27],
  // Right leg
  [24, 26], [26, 28],
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
];

export const SkeletalOverlay: React.FC<SkeletalOverlayProps> = ({
  landmarks,
  mode,
  isCalibrating,
  calibrationProgress,
  dArm,
  currentState,
  nextExpectedHand = 'any',
  mirror,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) {
      if (isCalibrating) {
        drawGhostSilhouette(ctx, width, height, calibrationProgress);
      }
      return;
    }

    const transformX = (normX: number) => {
      // Invert X if mirrored
      return (mirror ? 1 - normX : normX) * width;
    };

    const transformY = (normY: number) => normY * height;

    // 1. In calibration mode: draw T-Pose guide & progress indicator
    if (isCalibrating) {
      drawGhostSilhouette(ctx, width, height, calibrationProgress);
    }

    // 2. Draw Target Threshold Lines and Zones for "Six Seven" rhythm
    const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
    const leftWrist = landmarks[LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[LANDMARKS.RIGHT_WRIST];

    if (leftShoulder && rightShoulder && (mode === 'game' || isCalibrating)) {
      const dynamicOffset = Math.max(0.045, 0.28 * dArm);
      const targetThresholdNormY = ((leftShoulder.y + rightShoulder.y) / 2) - dynamicOffset;
      const targetCanvasY = transformY(targetThresholdNormY);

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = currentState !== 0 ? 'rgba(52, 211, 153, 0.85)' : 'rgba(6, 182, 212, 0.5)';
      ctx.beginPath();
      ctx.moveTo(width * 0.08, targetCanvasY);
      ctx.lineTo(width * 0.92, targetCanvasY);
      ctx.stroke();

      // Label on the threshold
      ctx.fillStyle = currentState !== 0 ? '#34d399' : '#06b6d4';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('ĐƯỜNG MỤC TIÊU 6 7 (TARGET PEAK)', width * 0.1, targetCanvasY - 8);

      // Target Rings above shoulders for Left (6) and Right (7)
      const ringRadius = Math.max(26, width * 0.05);
      const leftTargetX = transformX(leftShoulder.x);
      const rightTargetX = transformX(rightShoulder.x);

      const isLeftExpected = nextExpectedHand === 'any' || nextExpectedHand === 'left';
      const isRightExpected = nextExpectedHand === 'any' || nextExpectedHand === 'right';

      // Left Target (6)
      const isLeftHit = currentState === 1 || (leftWrist && leftWrist.y < targetThresholdNormY);
      ctx.setLineDash([]);
      ctx.lineWidth = isLeftExpected ? (isLeftHit ? 4.5 : 3) : 1.5;
      ctx.strokeStyle = isLeftHit
        ? '#10b981'
        : isLeftExpected
        ? 'rgba(16, 185, 129, 0.9)'
        : 'rgba(148, 163, 184, 0.25)';
      ctx.fillStyle = isLeftHit
        ? 'rgba(16, 185, 129, 0.35)'
        : isLeftExpected
        ? 'rgba(16, 185, 129, 0.12)'
        : 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(leftTargetX, targetCanvasY, ringRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLeftExpected ? '#10b981' : 'rgba(148, 163, 184, 0.4)';
      ctx.textAlign = 'center';
      ctx.font = isLeftExpected ? 'bold 12px "JetBrains Mono", monospace' : '10px "JetBrains Mono", monospace';
      ctx.fillText(isLeftExpected ? 'TAY TRÁI (6)' : 'ĐỢI', leftTargetX, targetCanvasY + 4);

      // Right Target (7)
      const isRightHit = currentState === 2 || (rightWrist && rightWrist.y < targetThresholdNormY);
      ctx.lineWidth = isRightExpected ? (isRightHit ? 4.5 : 3) : 1.5;
      ctx.strokeStyle = isRightHit
        ? '#06b6d4'
        : isRightExpected
        ? 'rgba(6, 182, 212, 0.9)'
        : 'rgba(148, 163, 184, 0.25)';
      ctx.fillStyle = isRightHit
        ? 'rgba(6, 182, 212, 0.35)'
        : isRightExpected
        ? 'rgba(6, 182, 212, 0.12)'
        : 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(rightTargetX, targetCanvasY, ringRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isRightExpected ? '#06b6d4' : 'rgba(148, 163, 184, 0.4)';
      ctx.font = isRightExpected ? 'bold 12px "JetBrains Mono", monospace' : '10px "JetBrains Mono", monospace';
      ctx.fillText(isRightExpected ? 'TAY PHẢI (7)' : 'ĐỢI', rightTargetX, targetCanvasY + 4);
      ctx.textAlign = 'start';

      ctx.restore();
    }

    // 3. Render Skeleton
    if (mode === 'game') {
      // GAME MODE: Draw ONLY wrists, elbows, and shoulders with thick neon strokes to minimize visual clutter
      const gameJoints = [
        LANDMARKS.LEFT_SHOULDER,
        LANDMARKS.RIGHT_SHOULDER,
        LANDMARKS.LEFT_ELBOW,
        LANDMARKS.RIGHT_ELBOW,
        LANDMARKS.LEFT_WRIST,
        LANDMARKS.RIGHT_WRIST,
      ];

      // Draw Upper Body Lines
      const gameConnections: [number, number][] = [
        [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
        [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
        [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
        [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
        [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
      ];

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 12;

      for (const [i, j] of gameConnections) {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        if (!p1 || !p2) continue;

        let strokeColor = '#06b6d4'; // Cyan default
        if (currentState === 1 && (i === LANDMARKS.LEFT_WRIST || j === LANDMARKS.LEFT_WRIST)) {
          strokeColor = '#10b981'; // Emerald Left Peak
        } else if (currentState === 2 && (i === LANDMARKS.RIGHT_WRIST || j === LANDMARKS.RIGHT_WRIST)) {
          strokeColor = '#3b82f6'; // Bright Blue Right Peak
        }

        ctx.strokeStyle = strokeColor;
        ctx.shadowColor = strokeColor;
        ctx.beginPath();
        ctx.moveTo(transformX(p1.x), transformY(p1.y));
        ctx.lineTo(transformX(p2.x), transformY(p2.y));
        ctx.stroke();
      }

      // Draw Key Joint Nodes
      for (const idx of gameJoints) {
        const p = landmarks[idx];
        if (!p) continue;

        const isWrist = idx === LANDMARKS.LEFT_WRIST || idx === LANDMARKS.RIGHT_WRIST;
        const radius = isWrist ? 10 : 7;
        const isLeftWrist = idx === LANDMARKS.LEFT_WRIST;
        const isRightWrist = idx === LANDMARKS.RIGHT_WRIST;

        let fillColor = '#06b6d4';
        if (isLeftWrist && currentState === 1) fillColor = '#10b981';
        if (isRightWrist && currentState === 2) fillColor = '#3b82f6';

        ctx.fillStyle = fillColor;
        ctx.shadowColor = fillColor;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(transformX(p.x), transformY(p.y), radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner white dot for precision feel
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(transformX(p.x), transformY(p.y), isWrist ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // FULL MODE (Lobby / Pre-check): Draw full 33 landmarks
      ctx.save();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineCap = 'round';

      for (const [i, j] of POSE_CONNECTIONS) {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        if (!p1 || !p2) continue;

        ctx.beginPath();
        ctx.moveTo(transformX(p1.x), transformY(p1.y));
        ctx.lineTo(transformX(p2.x), transformY(p2.y));
        ctx.stroke();
      }

      // Draw nodes
      for (let i = 0; i < landmarks.length; i++) {
        const p = landmarks[i];
        if (!p) continue;

        const isImportant =
          i === LANDMARKS.LEFT_WRIST ||
          i === LANDMARKS.RIGHT_WRIST ||
          i === LANDMARKS.LEFT_SHOULDER ||
          i === LANDMARKS.RIGHT_SHOULDER;

        ctx.fillStyle = isImportant ? '#06b6d4' : 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(transformX(p.x), transformY(p.y), isImportant ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }, [landmarks, mode, isCalibrating, calibrationProgress, dArm, currentState, nextExpectedHand, mirror, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};

// Ghost silhouette helper for T-Pose calibration
function drawGhostSilhouette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);

  const cx = width / 2;
  const cy = height * 0.45;
  const armSpan = width * 0.38;

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - height * 0.22, height * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  // Torso
  ctx.beginPath();
  ctx.moveTo(cx, cy - height * 0.14);
  ctx.lineTo(cx, cy + height * 0.18);
  ctx.stroke();

  // Arms horizontal in T-Pose
  ctx.beginPath();
  ctx.moveTo(cx - armSpan, cy - height * 0.08);
  ctx.lineTo(cx + armSpan, cy - height * 0.08);
  ctx.stroke();

  // Calibration progress ring in center
  if (progress > 0) {
    const ringRadius = 45;
    ctx.setLineDash([]);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(
      cx,
      cy - height * 0.08,
      ringRadius,
      -Math.PI / 2,
      -Math.PI / 2 + (Math.PI * 2 * (progress / 100))
    );
    ctx.stroke();
  }

  ctx.restore();
}
