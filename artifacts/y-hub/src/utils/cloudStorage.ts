import { supabase } from './supabaseClient';
import { getCourses, getPlansForCourse, getBookmarksForCourse, type Course, type TeachingPlan, type Bookmark } from './courseStorage';

/**
 * Syncs local IndexedDB data to Supabase.
 * This is a one-way sync (Local -> Cloud) for backup purposes.
 */
export async function syncLocalToCloud() {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  
  if (authError || !userData?.user) {
    console.warn('Cannot sync to cloud: User not authenticated');
    return;
  }

  const userId = userData.user.id;

  try {
    // 1. Sync Courses
    const courses = await getCourses();
    for (const course of courses) {
      const { error: courseError } = await supabase
        .from('courses')
        .upsert({
          id: course.id,
          user_id: userId,
          title: course.title,
          description: course.description,
          status: course.status,
          domain: course.domain || 'general',
          created_at: new Date(course.createdAt).toISOString()
        });
      
      if (courseError) console.error('Failed to sync course:', course.title, courseError);

      // 2. Sync Plans for this course
      const plans = await getPlansForCourse(course.id);
      for (const plan of plans) {
        const { error: planError } = await supabase
          .from('teaching_plans')
          .upsert({
            id: plan.id,
            course_id: plan.courseId,
            user_id: userId,
            week: plan.week,
            topic: plan.topic,
            content: plan.content,
            completed: plan.completed,
            resources: plan.resources || []
          });
        
        if (planError) console.error('Failed to sync plan:', plan.topic, planError);
      }

      // 3. Sync Bookmarks
      const bookmarks = await getBookmarksForCourse(course.id);
      for (const bm of bookmarks) {
        const { error: bmError } = await supabase
          .from('bookmarks')
          .upsert({
            id: bm.id,
            course_id: bm.courseId,
            user_id: userId,
            topic: bm.topic,
            content: bm.content,
            created_at: new Date(bm.createdAt).toISOString()
          });
        
        if (bmError) console.error('Failed to sync bookmark:', bm.topic, bmError);
      }
    }

    console.log('Successfully synced local database to Supabase cloud!');
  } catch (error) {
    console.error('Error during cloud sync:', error);
  }
}
