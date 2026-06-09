import { SKELETON_CONNECTIONS } from "@/config/constants";
import type { PoseResponse, Keypoint } from "@/types";

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  pose: PoseResponse,
  width: number,
  height: number,
  alpha: number = 1
) {
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = alpha;

  const kp = pose.keypoints;
  const px = (k: Keypoint | undefined) =>
    k && k.visible ? { x: k.x * width, y: k.y * height } : null;

  // Sizing
  const boneWidth = Math.max(2.5, Math.min(width, height) * 0.007);
  const jointRadius = boneWidth * 1.6;
  const headRadiusY = boneWidth * 5;
  const headRadiusX = headRadiusY * 0.72;

  const nose      = px(kp["nose"]);
  const lShoulder = px(kp["left_shoulder"]);
  const rShoulder = px(kp["right_shoulder"]);
  const lElbow    = px(kp["left_elbow"]);
  const rElbow    = px(kp["right_elbow"]);
  const lWrist    = px(kp["left_wrist"]);
  const rWrist    = px(kp["right_wrist"]);
  const lHip      = px(kp["left_hip"]);
  const rHip      = px(kp["right_hip"]);
  const lKnee     = px(kp["left_knee"]);
  const rKnee     = px(kp["right_knee"]);
  const lAnkle    = px(kp["left_ankle"]);
  const rAnkle    = px(kp["right_ankle"]);

  let neck: { x: number; y: number } | null = null;
  if (lShoulder && rShoulder) {
    neck = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
  }
  let pelvis: { x: number; y: number } | null = null;
  if (lHip && rHip) {
    pelvis = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
  }

  const NEON_CORE   = "#d946ef";   // Fuchsia/Purple core
  const NEON_GLOW   = "#a855f7";   // Purple outer glow
  const JOINT_CORE  = "#ffffff";   // White center
  const JOINT_GLOW  = "#d946ef";   // Purple joint glow

  // ── PASS 1: Glowing Bones ────────────────────────────────────────────────
  const allBones: [any, any][] = [
    [lShoulder, rShoulder],
    [neck, pelvis],
    [lHip, rHip],
    [lShoulder, lElbow],
    [lElbow, lWrist],
    [rShoulder, rElbow],
    [rElbow, rWrist],
    [lHip, lKnee],
    [lKnee, lAnkle],
    [rHip, rKnee],
    [rKnee, rAnkle],
  ];
  if (nose && neck) {
    allBones.push([neck, { x: nose.x, y: nose.y + headRadiusY * 0.5 }]);
  }

  // Outer glow pass
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = boneWidth * 3.5;
  ctx.strokeStyle = NEON_GLOW;
  ctx.shadowColor = NEON_GLOW;
  ctx.shadowBlur = 15;
  ctx.globalAlpha = alpha * 0.5;
  for (const [p1, p2] of allBones) {
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();

  // Core line
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = boneWidth * 1.2;
  ctx.strokeStyle = NEON_CORE;
  ctx.shadowColor = NEON_CORE;
  ctx.shadowBlur = 5;
  ctx.globalAlpha = alpha;
  for (const [p1, p2] of allBones) {
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();

  // ── PASS 2: Glowing Joints ────────────────────────────────────────────────
  const allJoints = [lShoulder, rShoulder, lElbow, rElbow, lWrist, rWrist, lHip, rHip, lKnee, rKnee, lAnkle, rAnkle, neck, pelvis];

  const drawGlowJoint = (p: any) => {
    if (!p) return;
    // Outer glow halo
    ctx.beginPath();
    ctx.arc(p.x, p.y, jointRadius * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = JOINT_GLOW;
    ctx.shadowColor = JOINT_GLOW;
    ctx.shadowBlur = 10;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fill();

    // Bright white center
    ctx.beginPath();
    ctx.arc(p.x, p.y, jointRadius * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = JOINT_CORE;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 4;
    ctx.globalAlpha = alpha;
    ctx.fill();
  };

  ctx.save();
  allJoints.forEach(drawGlowJoint);

  // Head oval with glow
  if (nose) {
    ctx.beginPath();
    ctx.ellipse(nose.x, nose.y, headRadiusX * 1.2, headRadiusY * 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = JOINT_GLOW;
    ctx.shadowColor = JOINT_GLOW;
    ctx.shadowBlur = 15;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(nose.x, nose.y, headRadiusX * 0.5, headRadiusY * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = JOINT_CORE;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 5;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.restore();

  ctx.globalAlpha = 1;
}
