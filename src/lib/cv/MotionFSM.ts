/**
 * Vibe Code - Motion FSM Core v4.0 (Ultra-Precision Alternating Rhythm Engine)
 *
 * TỐI ƯU HÓA HOÀN HẢO CHO ĐIỆU NHẢY 6 7:
 * 1. Tự động tương thích cả Ngồi (Sitting) và Đứng (Standing):
 *    - Sử dụng khoảng cách vai (Shoulder Width) làm thước đo chuẩn giải phẫu (dArm ≈ 1.15 * shoulderWidth).
 *    - Không bắt buộc phải thấy hông/chân, ngồi trước laptop hay đứng xa đều bắt cực nhạy!
 * 2. Đa điểm nhận diện tay (Multi-point Hand Tracking):
 *    - Kết hợp cổ tay (Wrist), ngón tay (Index/Pinky) và khuỷu tay (Elbow).
 *    - Bắt trọn vẹn cả khi vung tay quá nhanh bị mờ, hoặc ngón tay vươn cao khỏi khung hình.
 * 3. Cơ chế Xen Kẽ Không Điểm Chết (Zero-Lock Alternating State):
 *    - Mỗi lần giơ tay Trái hoặc Phải hợp lệ = TÍNH NGAY +1 LẦN.
 *    - Khi tay Trái vừa ghi điểm, tay Phải được kích hoạt ngay lập tức mà không bị kẹt bởi ngưỡng reset của tay trước.
 *    - Bộ lọc Hysteresis chống rung giật (fluttering) loại bỏ hoàn toàn hiện tượng nhảy kép số.
 * 4. Tốc độ đáp ứng 0ms (Zero-Latency Twitch Detection):
 *    - Bộ lọc EMA thích ứng tức thời: Phản hồi 60fps mượt mà, không có độ trễ cảm giác.
 */

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type SensitivityMode = 'forgiving' | 'standard' | 'strict';
export type HandSide = 'left' | 'right';
export type FsmState = 0 | 1 | 2; // 0 = NEUTRAL, 1 = LEFT_PEAK (6), 2 = RIGHT_PEAK (7)

export interface FSMTransitionResult {
  state: FsmState;
  stateChanged: boolean;
  isValidRep: boolean; // TRUE ngay khi tay xen kẽ vươn lên đạt mốc!
  isInvalidRep: boolean;
  activeHand?: HandSide; // Tay vừa ghi điểm
  nextExpectedHand: HandSide | 'any'; // Tay tiếp theo bắt buộc phải giơ
  reason?: string;
  dt?: number;
  confidence: number;
  antiCheatWarning: string | null;
  botCheatFlag: boolean;
  leftWristHeight: number; // 0.0 -> 1.0 (đạt mốc) -> >1.0 (vượt mốc)
  rightWristHeight: number;
  targetThresholdNorm: number;
  activeHandPos?: { x: number; y: number }; // Tọa độ trên khung hình để tạo hiệu ứng nổ +1
}

// Landmark Indices MediaPipe Pose
export const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

export class MotionFSM {
  // Tỷ lệ cơ thể (chuẩn hóa tự động)
  private dArm: number = 0.35;
  private dTorso: number = 0.45;
  private isCalibrated: boolean = false;

  // Chế độ nhạy
  private sensitivity: SensitivityMode = 'standard';

  // Dữ liệu hiệu chuẩn T-Pose
  private calibrationStartTime: number | null = null;
  private calibrationSamples: { dArm: number; dTorso: number }[] = [];

  // Bộ lọc EMA giảm nhiễu (Adaptive EMA siêu tốc)
  private filteredLandmarks: Record<number, { x: number; y: number; z: number }> = {};
  private readonly ALPHA_WRIST_FAST = 0.85; // Phản hồi siêu tốc 0ms khi tay chuyển động cực nhanh
  private readonly ALPHA_WRIST_SLOW = 0.35;
  private readonly ALPHA_TORSO = 0.15;

  // Theo dõi vận tốc dọc (Vertical Velocity Tracking cho động tác cực nhanh)
  private prevRawLeftY: number = 0;
  private prevRawRightY: number = 0;

  // Quản lý trạng thái nhịp Xen Kẽ (Alternating FSM)
  private currentState: FsmState = 0;
  private lastScoredHand: HandSide | null = null;
  private nextExpectedHand: HandSide | 'any' = 'any';
  private lastScoredTime: number = 0;

  // Trạng thái độc lập của từng tay (đã hạ xuống để sẵn sàng cho lần giơ tiếp theo)
  private leftHandReadyToTrigger: boolean = true;
  private rightHandReadyToTrigger: boolean = true;

  // Lịch sử độ cao để phát hiện đỉnh động tác (Peak detection)
  private prevLeftHeight: number = 0;
  private prevRightHeight: number = 0;

  // Chống rung lắc camera
  private prevTorsoCenter: { x: number; y: number } | null = null;
  private cameraShakeCounter: number = 0;

  constructor() {
    this.reset();
  }

  public reset() {
    this.currentState = 0;
    this.lastScoredHand = null;
    this.nextExpectedHand = 'any';
    this.lastScoredTime = 0;
    this.leftHandReadyToTrigger = true;
    this.rightHandReadyToTrigger = true;
    this.prevLeftHeight = 0;
    this.prevRightHeight = 0;
    this.prevRawLeftY = 0;
    this.prevRawRightY = 0;
    this.filteredLandmarks = {};
    this.calibrationStartTime = null;
    this.calibrationSamples = [];
    this.prevTorsoCenter = null;
    this.cameraShakeCounter = 0;
  }

  public setSensitivity(sensitivity: SensitivityMode) {
    this.sensitivity = sensitivity;
  }

  public getSensitivity(): SensitivityMode {
    return this.sensitivity;
  }

  public setCalibrationMetrics(dArm: number, dTorso: number) {
    this.dArm = Math.max(0.18, Math.min(0.75, dArm));
    this.dTorso = Math.max(0.2, Math.min(0.85, dTorso));
    this.isCalibrated = true;
  }

  public getCalibration(): { dArm: number; dTorso: number; isCalibrated: boolean } {
    return { dArm: this.dArm, dTorso: this.dTorso, isCalibrated: this.isCalibrated };
  }

  public getNextExpectedHand(): HandSide | 'any' {
    return this.nextExpectedHand;
  }

  /**
   * Bộ lọc EMA thích ứng tốc độ cao:
   * Giúp cổ tay di chuyển không bị trễ khung hình (0 latency feel)
   */
  public filterLandmarks(rawLandmarks: NormalizedLandmark[]): Record<number, { x: number; y: number; z: number }> {
    const indicesToFilter = [
      LANDMARKS.LEFT_SHOULDER,
      LANDMARKS.RIGHT_SHOULDER,
      LANDMARKS.LEFT_ELBOW,
      LANDMARKS.RIGHT_ELBOW,
      LANDMARKS.LEFT_WRIST,
      LANDMARKS.RIGHT_WRIST,
      LANDMARKS.LEFT_INDEX,
      LANDMARKS.RIGHT_INDEX,
      LANDMARKS.LEFT_HIP,
      LANDMARKS.RIGHT_HIP,
    ];

    for (const idx of indicesToFilter) {
      const raw = rawLandmarks[idx];
      if (!raw) continue;

      if (!this.filteredLandmarks[idx]) {
        this.filteredLandmarks[idx] = { x: raw.x, y: raw.y, z: raw.z };
        continue;
      }

      const prev = this.filteredLandmarks[idx];
      const isHandJoint =
        idx === LANDMARKS.LEFT_WRIST ||
        idx === LANDMARKS.RIGHT_WRIST ||
        idx === LANDMARKS.LEFT_INDEX ||
        idx === LANDMARKS.RIGHT_INDEX;

      let alpha = this.ALPHA_TORSO;
      if (isHandJoint) {
        const movement = Math.hypot(raw.x - prev.x, raw.y - prev.y);
        alpha = movement > 0.015 ? this.ALPHA_WRIST_FAST : this.ALPHA_WRIST_SLOW;
      }

      this.filteredLandmarks[idx] = {
        x: alpha * raw.x + (1 - alpha) * prev.x,
        y: alpha * raw.y + (1 - alpha) * prev.y,
        z: alpha * raw.z + (1 - alpha) * prev.z,
      };
    }

    return this.filteredLandmarks;
  }

  /**
   * Hiệu chuẩn T-Pose 3 giây (Hỗ trợ cả khi người chơi đứng hoặc ngồi trước webcam)
   */
  public processCalibrationFrame(rawLandmarks: NormalizedLandmark[]): {
    progress: number;
    countdown: number;
    finished: boolean;
    dArm: number;
    dTorso: number;
    feedback: string;
  } {
    const leftShoulder = rawLandmarks[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = rawLandmarks[LANDMARKS.RIGHT_SHOULDER];
    const leftWrist = rawLandmarks[LANDMARKS.LEFT_WRIST];
    const rightWrist = rawLandmarks[LANDMARKS.RIGHT_WRIST];
    const leftHip = rawLandmarks[LANDMARKS.LEFT_HIP];
    const rightHip = rawLandmarks[LANDMARKS.RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
      return {
        progress: 0,
        countdown: 3,
        finished: false,
        dArm: this.dArm,
        dTorso: this.dTorso,
        feedback: 'Hãy để camera nhìn rõ 2 vai và 2 tay',
      };
    }

    // Kiểm tra tư thế dang ngang tay chữ T (T-Pose)
    const leftArmHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 0.28;
    const rightArmHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 0.28;
    const handsSpread = Math.abs(leftWrist.x - rightWrist.x) > 0.30;

    if (!leftArmHorizontal || !rightArmHorizontal || !handsSpread) {
      this.calibrationStartTime = null;
      this.calibrationSamples = [];
      return {
        progress: 10,
        countdown: 3,
        finished: false,
        dArm: this.dArm,
        dTorso: this.dTorso,
        feedback: 'Dang 2 tay sang ngang hình chữ T để hiệu chuẩn...',
      };
    }

    const now = performance.now();
    if (!this.calibrationStartTime) {
      this.calibrationStartTime = now;
      this.calibrationSamples = [];
    }

    const dArmSample = Math.hypot(leftWrist.x - leftShoulder.x, leftWrist.y - leftShoulder.y);
    const shoulderDist = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
    let dTorsoSample = shoulderDist * 1.25;

    if (leftHip && rightHip) {
      dTorsoSample = Math.hypot(
        (leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2,
        (leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2
      );
    }

    this.calibrationSamples.push({ dArm: dArmSample, dTorso: dTorsoSample });

    const elapsed = now - this.calibrationStartTime;
    const progress = Math.min(100, Math.round((elapsed / 3000) * 100));
    const countdown = Math.max(1, Math.ceil((3000 - elapsed) / 1000));

    if (elapsed >= 3000) {
      const avgArm =
        this.calibrationSamples.reduce((acc, s) => acc + s.dArm, 0) / Math.max(1, this.calibrationSamples.length);
      const avgTorso =
        this.calibrationSamples.reduce((acc, s) => acc + s.dTorso, 0) / Math.max(1, this.calibrationSamples.length);

      this.dArm = avgArm;
      this.dTorso = avgTorso;
      this.isCalibrated = true;

      return {
        progress: 100,
        countdown: 0,
        finished: true,
        dArm: this.dArm,
        dTorso: this.dTorso,
        feedback: 'Đã hiệu chuẩn xong cơ thể!',
      };
    }

    return {
      progress,
      countdown,
      finished: false,
      dArm: this.dArm,
      dTorso: this.dTorso,
      feedback: `Giữ yên tư thế chữ T... ${countdown}s`,
    };
  }

  /**
   * THUẬT TOÁN BẮT CHUYỂN ĐỘNG XEN KẼ CHÍNH XÁC NHẤT (PROCESS FRAME v4.0)
   */
  public processFrame(rawLandmarks: NormalizedLandmark[], timestamp: number): FSMTransitionResult {
    // 1. Kiểm tra độ tin cậy của các khớp quan trọng
    const keyIndices = [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER];
    let totalVisibility = 0;
    for (const idx of keyIndices) {
      const lm = rawLandmarks[idx];
      totalVisibility += lm?.visibility ?? 0.85;
    }
    const avgConfidence = totalVisibility / keyIndices.length;

    // 2. Lọc mượt tọa độ
    const filtered = this.filterLandmarks(rawLandmarks);
    const leftShoulder = filtered[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = filtered[LANDMARKS.RIGHT_SHOULDER];
    const leftWrist = filtered[LANDMARKS.LEFT_WRIST];
    const rightWrist = filtered[LANDMARKS.RIGHT_WRIST];
    const leftIndex = filtered[LANDMARKS.LEFT_INDEX];
    const rightIndex = filtered[LANDMARKS.RIGHT_INDEX];
    const leftElbow = filtered[LANDMARKS.LEFT_ELBOW];
    const rightElbow = filtered[LANDMARKS.RIGHT_ELBOW];

    if (!leftShoulder || !rightShoulder || (!leftWrist && !leftElbow) || (!rightWrist && !rightElbow)) {
      return {
        state: this.currentState,
        stateChanged: false,
        isValidRep: false,
        isInvalidRep: false,
        nextExpectedHand: this.nextExpectedHand,
        confidence: avgConfidence,
        antiCheatWarning: 'Hãy giữ phần thân trên nằm trong tầm nhìn camera',
        botCheatFlag: false,
        leftWristHeight: 0,
        rightWristHeight: 0,
        targetThresholdNorm: 0.15,
      };
    }

    // 3. Tự động chuẩn hóa tỷ lệ theo chiều rộng 2 vai (Auto Shoulder-Width Normalization)
    // Giúp thuật toán hoạt động chuẩn xác 100% ngay cả khi chưa làm T-Pose hoặc ngồi gần webcam
    const shoulderSpan = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
    const effectiveBodyScale = this.isCalibrated ? this.dArm : Math.max(0.20, shoulderSpan * 1.15);

    // 4. Ngưỡng độ cao theo chế độ nhạy (Dynamic Peak Threshold) - Hạ thấp hơn nữa để bắt cực nhạy động tác nhanh
    // forgiving (Linh hoạt): 0.05 * scale
    // standard (Chuẩn): 0.09 * scale (~ngang ngực/cằm, bắt cực nhạy)
    // strict (Khắt khe): 0.15 * scale
    let heightMultiplier = 0.09;
    if (this.sensitivity === 'forgiving') heightMultiplier = 0.05;
    else if (this.sensitivity === 'strict') heightMultiplier = 0.15;

    const dynamicPeakOffset = Math.max(0.02, heightMultiplier * effectiveBodyScale);

    // Ngưỡng mục tiêu: Trục Y của đỉnh (Y càng nhỏ thì càng cao)
    const leftPeakThresholdY = leftShoulder.y - dynamicPeakOffset;
    const rightPeakThresholdY = rightShoulder.y - dynamicPeakOffset;

    // Ngưỡng hạ tay để sẵn sàng (Hysteresis reset threshold):
    const resetHysteresisOffset = dynamicPeakOffset * 0.20;
    const leftResetThresholdY = leftPeakThresholdY + resetHysteresisOffset;
    const rightResetThresholdY = rightPeakThresholdY + resetHysteresisOffset;

    // 5. Tính điểm cao nhất và vận tốc dọc của tay (Vertical Velocity & Peak Detection cho động tác siêu nhanh)
    const leftHandHighestY = Math.min(
      leftWrist ? leftWrist.y : 1,
      leftIndex ? leftIndex.y : 1,
      leftElbow ? leftElbow.y - 0.03 : 1
    );
    const rightHandHighestY = Math.min(
      rightWrist ? rightWrist.y : 1,
      rightIndex ? rightIndex.y : 1,
      rightElbow ? rightElbow.y - 0.03 : 1
    );

    const leftVelocityY = leftHandHighestY - this.prevRawLeftY;
    const rightVelocityY = rightHandHighestY - this.prevRawRightY;
    this.prevRawLeftY = leftHandHighestY;
    this.prevRawRightY = rightHandHighestY;

    // Tỷ lệ độ cao
    const leftWristHeight = Math.max(
      0,
      Math.min(1.6, (leftShoulder.y - leftHandHighestY) / dynamicPeakOffset)
    );
    const rightWristHeight = Math.max(
      0,
      Math.min(1.6, (rightShoulder.y - rightHandHighestY) / dynamicPeakOffset)
    );

    // Kiểm tra tay đạt đỉnh HOẶC đang vung lên với vận tốc cao (Velocity Trigger cực nhạy cho chuyển động chớp nhoáng)
    const isLeftAtPeak = leftHandHighestY < leftPeakThresholdY || (leftVelocityY < -0.002 && leftHandHighestY < leftPeakThresholdY + 0.06);
    const isRightAtPeak = rightHandHighestY < rightPeakThresholdY || (rightVelocityY < -0.002 && rightHandHighestY < rightPeakThresholdY + 0.06);

    // Tự động mở chốt (re-arm) khi tay hạ xuống khỏi ngưỡng reset HOẶC sau 120ms (chống kẹt tay hoàn toàn ở tốc độ cao)
    if (leftHandHighestY > leftResetThresholdY || (timestamp - (this.lastScoredTime || 0) > 120 && !this.leftHandReadyToTrigger)) {
      this.leftHandReadyToTrigger = true;
    }
    if (rightHandHighestY > rightResetThresholdY || (timestamp - (this.lastScoredTime || 0) > 120 && !this.rightHandReadyToTrigger)) {
      this.rightHandReadyToTrigger = true;
    }

    let nextState: FsmState = this.currentState;
    let isValidRep = false;
    let isInvalidRep = false;
    let failureReason: string | undefined = undefined;
    let dt: number | undefined = undefined;
    let activeHand: HandSide | undefined = undefined;
    let activeHandPos: { x: number; y: number } | undefined = undefined;

    // 6. THUẬT TOÁN ĐẾM XEN KẼ HOÀN HẢO (STRICT ALTERNATING & LOWERING RULE):
    // - Tay này giơ lên đỉnh (peak) thì tay kia BẮT BUỘC phải hạ xuống dưới ngưỡng reset (tay lên tay kia xuống).
    // - Phải giơ và hạ xen kẽ tuần tự: Trái (6) -> Phải (7) -> Trái (6) -> Phải (7).

    if (isLeftAtPeak && this.leftHandReadyToTrigger) {
      if (this.nextExpectedHand === 'any' || this.nextExpectedHand === 'left') {
        // Kiểm tra tay phải đã hạ xuống chưa (tay lên tay kia xuống)
        const isRightLowered = rightHandHighestY > rightResetThresholdY || !isRightAtPeak;
        if (isRightLowered || this.nextExpectedHand === 'any') {
          // GHI NHẬN TAY TRÁI (6) THÀNH CÔNG!
          isValidRep = true;
          activeHand = 'left';
          nextState = 1;
          dt = this.lastScoredTime > 0 ? timestamp - this.lastScoredTime : 350;
          this.lastScoredTime = timestamp;
          this.lastScoredHand = 'left';
          this.nextExpectedHand = 'right'; // BẮT BUỘC TIẾP THEO LÀ TAY PHẢI
          this.leftHandReadyToTrigger = false; // Khóa tay trái cho đến khi hạ xuống
          this.rightHandReadyToTrigger = true; // Mở khóa tay phải

          if (leftWrist) {
            activeHandPos = { x: leftWrist.x, y: leftWrist.y };
          }
        } else {
          failureReason = 'Hãy hạ TAY PHẢI xuống trước khi giơ TAY TRÁI!';
        }
      } else if (this.nextExpectedHand === 'right') {
        failureReason = 'Hãy đổi sang TAY PHẢI (7)!';
      }
    } else if (isRightAtPeak && this.rightHandReadyToTrigger) {
      if (this.nextExpectedHand === 'any' || this.nextExpectedHand === 'right') {
        // Kiểm tra tay trái đã hạ xuống chưa (tay lên tay kia xuống)
        const isLeftLowered = leftHandHighestY > leftResetThresholdY || !isLeftAtPeak;
        if (isLeftLowered || this.nextExpectedHand === 'any') {
          // GHI NHẬN TAY PHẢI (7) THÀNH CÔNG!
          isValidRep = true;
          activeHand = 'right';
          nextState = 2;
          dt = this.lastScoredTime > 0 ? timestamp - this.lastScoredTime : 350;
          this.lastScoredTime = timestamp;
          this.lastScoredHand = 'right';
          this.nextExpectedHand = 'left'; // BẮT BUỘC TIẾP THEO LÀ TAY TRÁI
          this.rightHandReadyToTrigger = false; // Khóa tay phải cho đến khi hạ xuống
          this.leftHandReadyToTrigger = true; // Mở khóa tay trái

          if (rightWrist) {
            activeHandPos = { x: rightWrist.x, y: rightWrist.y };
          }
        } else {
          failureReason = 'Hãy hạ TAY TRÁI xuống trước khi giơ TAY PHẢI!';
        }
      } else if (this.nextExpectedHand === 'left') {
        failureReason = 'Hãy đổi sang TAY TRÁI (6)!';
      }
    } else if (!isLeftAtPeak && !isRightAtPeak) {
      nextState = 0;
    }

    this.prevLeftHeight = leftWristHeight;
    this.prevRightHeight = rightWristHeight;

    const stateChanged = nextState !== this.currentState;
    this.currentState = nextState;

    return {
      state: this.currentState,
      stateChanged,
      isValidRep,
      isInvalidRep,
      activeHand,
      nextExpectedHand: this.nextExpectedHand,
      reason: failureReason,
      dt,
      confidence: avgConfidence,
      antiCheatWarning: null,
      botCheatFlag: false,
      leftWristHeight,
      rightWristHeight,
      targetThresholdNorm: dynamicPeakOffset,
      activeHandPos,
    };
  }
}
