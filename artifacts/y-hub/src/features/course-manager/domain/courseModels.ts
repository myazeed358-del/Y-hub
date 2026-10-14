export interface Course {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  status?: 'draft' | 'published';
  domain?: string;
}

export interface CourseFile {
  id: string;
  courseId: string;
  type: 'book' | 'syllabus' | 'auxiliary';
  name: string;
  data: Blob;
}

export interface TeachingResource {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'link' | 'slide';
}

export interface TeachingPlan {
  id: string;
  courseId: string;
  week: number;
  topic: string;
  content: string;
  completed?: boolean;
  resources?: TeachingResource[];
}

export interface Bookmark {
  id: string;
  courseId: string;
  topic: string;
  content: string;
  createdAt: number;
}
