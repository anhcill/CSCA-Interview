export type VisualCheckState = "idle" | "ok" | "warning" | "error";

export type VisualScores = {
  confidence: number;
  focus: number;
  communication: number;
  stress: number;
  eyeContact: number;
};

export type VisualRawFeatures = {
  blinkRate: number;
  brightness: number;
  faceCentered: boolean;
  faceVisible: boolean;
  gazeOffset: number;
  headPitch: number;
  headRoll: number;
  headYaw: number;
  mouthMovement: number;
  smile: number;
};

export type VisualSystemChecks = {
  camera: VisualCheckState;
  mic: VisualCheckState;
  faceVisible: VisualCheckState;
  lighting: VisualCheckState;
  centered: VisualCheckState;
};

export type VisualAnalysisSnapshot = {
  checks: VisualSystemChecks;
  features: VisualRawFeatures;
  scores: VisualScores;
  timestamp: number;
};

export type VisualLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type VisualAnalysisInput = {
  blendshapes?: Record<string, number>;
  brightness: number;
  hasCameraTrack: boolean;
  hasMicTrack: boolean;
  landmarks?: VisualLandmark[];
  previous?: VisualAnalysisSnapshot | null;
  timestamp: number;
};

const neutralFeatures: VisualRawFeatures = {
  blinkRate: 0,
  brightness: 0,
  faceCentered: false,
  faceVisible: false,
  gazeOffset: 1,
  headPitch: 0,
  headRoll: 0,
  headYaw: 0,
  mouthMovement: 0,
  smile: 0
};

export const emptyVisualAnalysis: VisualAnalysisSnapshot = {
  checks: {
    camera: "idle",
    centered: "idle",
    faceVisible: "idle",
    lighting: "idle",
    mic: "idle"
  },
  features: neutralFeatures,
  scores: {
    communication: 0,
    confidence: 0,
    eyeContact: 0,
    focus: 0,
    stress: 0
  },
  timestamp: 0
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function scoreFromDistance(value: number, goodAt = 0, badAt = 1) {
  const range = Math.max(0.001, badAt - goodAt);
  return clamp(100 - ((Math.abs(value) - goodAt) / range) * 100);
}

function distance(a?: VisualLandmark, b?: VisualLandmark) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function blendScore(blendshapes: Record<string, number> | undefined, names: string[]) {
  if (!blendshapes) return 0;
  return names.reduce((max, name) => Math.max(max, blendshapes[name.toLowerCase()] ?? 0), 0);
}

function movingAverage(current: number, previous: number | undefined, weight = 0.35) {
  if (previous == null) return current;
  return previous * (1 - weight) + current * weight;
}

function readFeatureInput(input: VisualAnalysisInput): VisualRawFeatures {
  const landmarks = input.landmarks;
  if (!landmarks?.length) {
    return {
      ...neutralFeatures,
      brightness: input.brightness
    };
  }

  const forehead = landmarks[10];
  const chin = landmarks[152];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const nose = landmarks[1] ?? landmarks[4];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];

  const faceWidth = Math.max(0.001, distance(leftCheek, rightCheek));
  const faceHeight = Math.max(0.001, distance(forehead, chin));
  const faceCenterX = ((leftCheek?.x ?? 0.5) + (rightCheek?.x ?? 0.5)) / 2;
  const faceCenterY = ((forehead?.y ?? 0.32) + (chin?.y ?? 0.68)) / 2;
  const noseX = nose?.x ?? faceCenterX;
  const noseY = nose?.y ?? faceCenterY;
  const rollRadians = leftEyeOuter && rightEyeOuter ? Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x) : 0;

  const yaw = clamp(((noseX - faceCenterX) / faceWidth) * 90, -45, 45);
  const pitch = clamp(((noseY - faceCenterY) / faceHeight) * 90, -45, 45);
  const roll = clamp((rollRadians * 180) / Math.PI, -45, 45);
  const centerDistance = Math.hypot(noseX - 0.5, noseY - 0.48);

  const irisCenterX = leftIris && rightIris ? (leftIris.x + rightIris.x) / 2 : noseX;
  const eyeCenterX = leftEyeOuter && rightEyeOuter ? (leftEyeOuter.x + rightEyeOuter.x) / 2 : faceCenterX;
  const gazeOffset = clamp(Math.abs(irisCenterX - eyeCenterX) / faceWidth, 0, 1);
  const mouthMovement = clamp(distance(upperLip, lowerLip) / faceHeight, 0, 1);
  const smile = blendScore(input.blendshapes, ["mouthSmileLeft", "mouthSmileRight"]);
  const blink = blendScore(input.blendshapes, ["eyeBlinkLeft", "eyeBlinkRight"]);
  const previousBlinkRate = input.previous?.features.blinkRate;
  const blinkRate = movingAverage(blink, previousBlinkRate, 0.2);

  return {
    blinkRate,
    brightness: input.brightness,
    faceCentered: centerDistance < 0.18 && Math.abs(yaw) < 18 && Math.abs(pitch) < 20,
    faceVisible: landmarks.length >= 420,
    gazeOffset,
    headPitch: pitch,
    headRoll: roll,
    headYaw: yaw,
    mouthMovement,
    smile
  };
}

function buildScores(features: VisualRawFeatures): VisualScores {
  if (!features.faceVisible) {
    return {
      communication: 0,
      confidence: 0,
      eyeContact: 0,
      focus: 0,
      stress: 0
    };
  }

  const yawScore = scoreFromDistance(features.headYaw, 0, 30);
  const pitchScore = scoreFromDistance(features.headPitch, 0, 28);
  const rollScore = scoreFromDistance(features.headRoll, 0, 22);
  const gazeScore = scoreFromDistance(features.gazeOffset, 0.03, 0.35);
  const centerScore = features.faceCentered ? 100 : 62;
  const lightScore = features.brightness >= 0.2 && features.brightness <= 0.82 ? 100 : 55;
  const expressionScore = clamp(60 + features.smile * 35 + features.mouthMovement * 25);
  const postureScore = (yawScore + pitchScore + rollScore + centerScore) / 4;
  const eyeContact = clamp(gazeScore * 0.55 + postureScore * 0.3 + centerScore * 0.15);
  const focus = clamp(eyeContact * 0.55 + lightScore * 0.15 + scoreFromDistance(features.blinkRate, 0.18, 0.85) * 0.3);
  const stressSignal = clamp(features.blinkRate * 55 + Math.abs(features.headYaw) * 0.7 + Math.abs(features.headPitch) * 0.5 + Math.abs(features.headRoll) * 0.4);
  const stress = clamp(stressSignal);

  return {
    communication: Math.round(clamp(eyeContact * 0.45 + expressionScore * 0.35 + focus * 0.2)),
    confidence: Math.round(clamp(postureScore * 0.45 + eyeContact * 0.35 + (100 - stress) * 0.2)),
    eyeContact: Math.round(eyeContact),
    focus: Math.round(focus),
    stress: Math.round(stress)
  };
}

function buildChecks(input: VisualAnalysisInput, features: VisualRawFeatures): VisualSystemChecks {
  return {
    camera: input.hasCameraTrack ? "ok" : "error",
    centered: !features.faceVisible ? "idle" : features.faceCentered ? "ok" : "warning",
    faceVisible: features.faceVisible ? "ok" : "error",
    lighting: features.brightness === 0 ? "idle" : features.brightness >= 0.2 && features.brightness <= 0.82 ? "ok" : "warning",
    mic: input.hasMicTrack ? "ok" : "warning"
  };
}

export function analyzeVisualFrame(input: VisualAnalysisInput): VisualAnalysisSnapshot {
  const nextFeatures = readFeatureInput(input);
  const previous = input.previous;
  const features: VisualRawFeatures = previous
    ? {
        ...nextFeatures,
        brightness: movingAverage(nextFeatures.brightness, previous.features.brightness),
        gazeOffset: movingAverage(nextFeatures.gazeOffset, previous.features.gazeOffset),
        headPitch: movingAverage(nextFeatures.headPitch, previous.features.headPitch),
        headRoll: movingAverage(nextFeatures.headRoll, previous.features.headRoll),
        headYaw: movingAverage(nextFeatures.headYaw, previous.features.headYaw),
        mouthMovement: movingAverage(nextFeatures.mouthMovement, previous.features.mouthMovement),
        smile: movingAverage(nextFeatures.smile, previous.features.smile)
      }
    : nextFeatures;

  const scores = buildScores(features);

  return {
    checks: buildChecks(input, features),
    features,
    scores,
    timestamp: input.timestamp
  };
}

export function canStartInterview(checks: VisualSystemChecks) {
  return checks.camera === "ok" && checks.faceVisible === "ok" && checks.centered !== "error" && checks.lighting !== "error";
}
