import { z } from "zod";

export const KeypointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  visible: z.boolean(),
});

export const AnnotationSchema = z.object({
  joint: z.string().min(1),
  text: z.string().min(1),
});

export const PoseResponseSchema = z.object({
  pose_name: z.string().min(1),
  description: z.string().min(1),
  energy: z.enum(["calm", "dynamic", "elegant", "playful", "powerful"]),
  keypoints: z.record(z.string(), KeypointSchema),
  annotations: z.array(AnnotationSchema).optional(),
});

export type Keypoint = z.infer<typeof KeypointSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type PoseResponse = z.infer<typeof PoseResponseSchema>;

export type Provider = "groq" | "gemini" | "openrouter";
