import { z } from 'zod';
export const definitionInput = z.object({
  id: z.string().uuid(), title: z.string().trim().min(1).max(200),
  code: z.string().trim().max(100), description: z.string().trim().max(4000),
  department: z.string().trim().max(200), major: z.string().trim().max(100),
});
export const sectionInput = z.object({
  id: z.string().uuid(), definition: z.string().uuid(), instructor: z.string().uuid(),
  label: z.string().trim().min(1).max(100), term: z.string().trim().min(1).max(100),
});
export type DefinitionInput = z.infer<typeof definitionInput>;
export type SectionInput = z.infer<typeof sectionInput>;
export interface Instructor { id: string; full_name: string | null }
export const pageSize = 50;
