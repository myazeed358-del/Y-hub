import type { Dispatch, SetStateAction } from 'react';

interface BookmarkDependencies {
  setSavedBookmarks: Dispatch<SetStateAction<Set<string>>>;
}

export function createHandleBookmark({
  setSavedBookmarks,
}: BookmarkDependencies) {
  return async (msgId: string, content: string) => {
    try {
      console.warn('Bookmarks are not supported yet. Supabase schema missing.');
      setSavedBookmarks(prev => new Set(prev).add(msgId));
    } catch (e) {
      console.error('Failed to save bookmark', e);
    }
  };
}
