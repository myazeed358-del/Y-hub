import type { TeachingPlan } from './courseModels';

/**
 * Automatically divides the extracted PDF text into a structured teaching timeline.
 */
export async function generateTimeline(courseId: string, text: string, totalWeeks: number = 15): Promise<TeachingPlan[]> {
  // A simple natural language algorithm to find "Chapters" or logical breaks.
  // We scan for keywords like "Chapter", "الفصل", "Unit" and extract their titles.
  const chapterRegex = /(?:Chapter|الفصل|Unit|Module)\s+([0-9]+|One|Two|Three|Four|I|II|III|IV)[\s:-]+([^.?!]+)/gi;
  const chapters: string[] = [];

  let match;
  while ((match = chapterRegex.exec(text)) !== null) {
    const title = match[2].trim().substring(0, 100); // Limit length
    if (title.length > 3 && !chapters.includes(title)) {
      chapters.push(title);
    }
    if (chapters.length >= 50) break; // limit
  }

  // Fallback if no chapters found: generate generic topics based on the course
  if (chapters.length < 3) {
    for (let i = 1; i <= totalWeeks; i++) {
      chapters.push(`Core Concept ${i}: Analysis & Application`);
    }
  }

  // Distribute chapters evenly across the weeks
  const plans: TeachingPlan[] = [];
  const chaptersPerWeek = Math.max(1, Math.floor(chapters.length / totalWeeks));

  for (let week = 1; week <= totalWeeks; week++) {
    const weekChapters = chapters.splice(0, chaptersPerWeek);

    // If we run out of parsed chapters, add a review week
    const topic = weekChapters.length > 0
      ? weekChapters.join(' & ')
      : (week === totalWeeks ? 'Final Review and Exam Preparation' : 'Review & Practice');

    plans.push({
      id: crypto.randomUUID(),
      courseId,
      week,
      topic,
      content: `In week ${week}, students will focus on: ${topic}. This involves reading the assigned pages from the textbook and completing the foundational exercises.`
    });
  }

  return plans;
}
