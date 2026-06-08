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
  const px = (k: Keypoint | undefined) => k && k.visible ? { x: k.x * width, y: k.y * height } : null;

  // Sizing parameters
  const boneWidth = Math.max(3, Math.min(width, height) * 0.008);
  const jointRadius = boneWidth * 1.5;
  const headRadiusY = boneWidth * 5;
  const headRadiusX = headRadiusY * 0.7; // Oval head

  const nose = px(kp["nose"]);
  const lShoulder = px(kp["left_shoulder"]);
  const rShoulder = px(kp["right_shoulder"]);
  const lElbow = px(kp["left_elbow"]);
  const rElbow = px(kp["right_elbow"]);
  const lWrist = px(kp["left_wrist"]);
  const rWrist = px(kp["right_wrist"]);
  const lHip = px(kp["left_hip"]);
  const rHip = px(kp["right_hip"]);
  const lKnee = px(kp["left_knee"]);
  const rKnee = px(kp["right_knee"]);
  const lAnkle = px(kp["left_ankle"]);
  const rAnkle = px(kp["right_ankle"]);

  // Calculate spine points
  let neck = null;
  if (lShoulder && rShoulder) {
    neck = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
  }
  let pelvis = null;
  if (lHip && rHip) {
    pelvis = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
  }

  // Helper to draw a bone line
  const drawBone = (p1: any, p2: any) => {
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  // ── PASS 1: Draw Black Bones ──────────────────────────────────────────
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = boneWidth;
  ctx.strokeStyle = "#111111"; // Almost black bones
  
  // Optional: subtle white drop-shadow so the black lines are visible in dark rooms
  ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
  ctx.shadowBlur = 6;

  // Spine & Torso box
  drawBone(lShoulder, rShoulder);
  drawBone(neck, pelvis);
  drawBone(lHip, rHip);
  
  // Arms
  drawBone(lShoulder, lElbow);
  drawBone(lElbow, lWrist);
  drawBone(rShoulder, rElbow);
  drawBone(rElbow, rWrist);
  
  // Legs
  drawBone(lHip, lKnee);
  drawBone(lKnee, lAnkle);
  drawBone(rHip, rKnee);
  drawBone(rKnee, rAnkle);
  
  // Neck to Head
  if (nose && neck) {
    drawBone(neck, { x: nose.x, y: nose.y + headRadiusY * 0.5 });
  }
  ctx.restore();

  // ── PASS 2: Draw White Joints with Black Borders ──────────────────────
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(2, boneWidth * 0.4);

  const drawJoint = (p: any) => {
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, jointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Draw all joints
  const joints = [lShoulder, rShoulder, lElbow, rElbow, lWrist, rWrist, lHip, rHip, lKnee, rKnee, lAnkle, rAnkle, neck, pelvis];
  joints.forEach(drawJoint);

  // Draw Head (Oval)
  if (nose) {
    ctx.beginPath();
    ctx.ellipse(nose.x, nose.y, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // ── PASS 3: Floating text annotations ─────────────────────────────────
  if (pose.annotations && pose.annotations.length > 0) {
    ctx.save();
    const fontSize = Math.max(14, Math.min(width, height) * 0.042);
    ctx.font = `italic 700 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    pose.annotations.forEach(ann => {
      const joint = kp[ann.joint];
      if (!joint?.visible) return;
      const jPx = px(joint);
      if (!jPx) return;
      const isRight = joint.x > 0.5;
      const textX = jPx.x + (isRight ? -(jointRadius * 2 + 10) : (jointRadius * 2 + 10));
      
      // Prevent text from overlapping the bottom UI card (bottom 30% of screen)
      const maxTextY = height * 0.65;
      let textY = jPx.y + (joint.y > 0.65 ? -20 : 24);
      if (textY > maxTextY) textY = maxTextY;

      ctx.textAlign = isRight ? "right" : "left";
      ctx.fillText(ann.text, textX, textY);
    });

    ctx.restore();
  }

  ctx.globalAlpha = 1;
}
