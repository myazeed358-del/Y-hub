// Compatibility entry point. Domain models and storage now live in course-manager.
export type { Course, CourseFile, TeachingPlan, TeachingResource, Bookmark } from '@/features/course-manager/domain/courseModels';
export * from '@/features/course-manager/storage/indexedDbCourseStore';
