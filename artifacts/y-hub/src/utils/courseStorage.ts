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

const DB_NAME = 'fuzzy_academy_db';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('courseId', 'courseId', { unique: false });
      }
      if (!db.objectStoreNames.contains('plans')) {
        const planStore = db.createObjectStore('plans', { keyPath: 'id' });
        planStore.createIndex('courseId', 'courseId', { unique: false });
      }
      if (!db.objectStoreNames.contains('bookmarks')) {
        const bmStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
        bmStore.createIndex('courseId', 'courseId', { unique: false });
      }
    };
  });
}

// --- Courses ---
export async function getCourses(): Promise<Course[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('courses', 'readonly');
    const store = tx.objectStore('courses');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addCourse(course: Course): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('courses', 'readwrite');
    const store = tx.objectStore('courses');
    const req = store.add(course);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateCourse(course: Course): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('courses', 'readwrite');
    const store = tx.objectStore('courses');
    const req = store.put(course);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCourse(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['courses', 'files', 'plans'], 'readwrite');
    
    // Delete course
    tx.objectStore('courses').delete(id);
    
    // Delete related files
    const fileStore = tx.objectStore('files');
    const fileIndex = fileStore.index('courseId');
    const reqFiles = fileIndex.getAllKeys(id);
    reqFiles.onsuccess = () => {
      reqFiles.result.forEach(key => fileStore.delete(key));
    };

    // Delete related plans
    const planStore = tx.objectStore('plans');
    const planIndex = planStore.index('courseId');
    const reqPlans = planIndex.getAllKeys(id);
    reqPlans.onsuccess = () => {
      reqPlans.result.forEach(key => planStore.delete(key));
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Files ---
export async function saveFile(file: CourseFile): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    const req = store.put(file);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getFilesForCourse(courseId: string): Promise<CourseFile[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const index = store.index('courseId');
    const req = index.getAll(courseId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Plans ---
export async function savePlan(plan: TeachingPlan): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('plans', 'readwrite');
    const store = tx.objectStore('plans');
    const req = store.put(plan);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPlansForCourse(courseId: string): Promise<TeachingPlan[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('plans', 'readonly');
    const store = tx.objectStore('plans');
    const index = store.index('courseId');
    const req = index.getAll(courseId);
    req.onsuccess = () => {
      // Sort by week
      const sorted = (req.result as TeachingPlan[]).sort((a, b) => a.week - b.week);
      resolve(sorted);
    };
    req.onerror = () => reject(req.error);
  });
}

// Bookmarks CRUD
export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readwrite');
    const store = tx.objectStore('bookmarks');
    const request = store.put(bookmark);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getBookmarksForCourse(courseId: string): Promise<Bookmark[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readonly');
    const store = tx.objectStore('bookmarks');
    const index = store.index('courseId');
    const request = index.getAll(IDBKeyRange.only(courseId));
    
    request.onsuccess = () => {
      const bms = request.result || [];
      bms.sort((a: Bookmark, b: Bookmark) => b.createdAt - a.createdAt);
      resolve(bms);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readwrite');
    const store = tx.objectStore('bookmarks');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
