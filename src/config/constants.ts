export const ENERGY_BADGE_COLORS: Record<string, string> = {
  calm: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  dynamic: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  elegant: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  playful: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  powerful: "bg-red-500/20 text-red-300 border-red-500/30",
};

export const ENERGY_GLOW: Record<string, string> = {
  calm: "#00f5ff",
  dynamic: "#ff6b35",
  elegant: "#c77dff",
  playful: "#f9c74f",
  powerful: "#ff4d6d",
};

export const USER_ERRORS: Record<string, string> = {
  "API key not valid": "Invalid API key — check your key in Settings.",
  "API_KEY_INVALID": "Invalid API key — check your key in Settings.",
  "not found for model": "Model unavailable — try a different model in Settings.",
  "rate limit": "Too many requests — wait a moment and try again.",
  "safety": "Content blocked by AI safety filters — try a different scene.",
  "quota": "API quota exceeded — check your plan or switch providers.",
  "fetch failed": "Network error — check your internet connection.",
};

export const SKELETON_CONNECTIONS: [string, string][] = [
  // Head
  ["left_ear", "left_eye"],
  ["right_ear", "right_eye"],
  ["left_eye", "nose"],
  ["right_eye", "nose"],
  // Torso
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  // Left arm
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  // Right arm
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  // Left leg
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  // Right leg
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];
