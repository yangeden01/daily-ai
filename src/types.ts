export type NoteColor = 'default' | 'amber' | 'emerald' | 'sky' | 'rose' | 'indigo' | 'violet' | 'orange';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  color: NoteColor;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  tags: string[];
  isChecklist: boolean;
  checklistItems: ChecklistItem[];
  createdAt: number;
  updatedAt: number;
}

export type ViewFilter = 'all' | 'pinned' | 'trash' | 'archived' | string;

export type SortOption = 'updated_desc' | 'updated_asc' | 'created_desc' | 'title_asc';
