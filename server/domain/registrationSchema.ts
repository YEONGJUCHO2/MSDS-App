import { z } from "zod";

export const componentCandidateSchema = z.object({
  casNo: z.string().default(""),
  chemicalName: z.string().default(""),
  contentMin: z.string().default(""),
  contentMax: z.string().default(""),
  contentSingle: z.string().default(""),
  evidence: z.string().default(""),
  reviewStatus: z.enum(["needs_review", "approved", "edited", "excluded"]).default("needs_review")
});

export const registrationCandidateSchema = z.object({
  productName: z.string().default(""),
  supplier: z.string().default(""),
  manufacturer: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  use: z.string().default(""),
  msdsNumber: z.string().default(""),
  revisionDate: z.string().default(""),
  revisionVersion: z.string().default(""),
  components: z.array(componentCandidateSchema).default([])
});

export type RegistrationCandidate = z.infer<typeof registrationCandidateSchema>;
