import React from 'react';
import {
  FileText,
  Pin,
  Briefcase,
  User,
  Lightbulb,
  BookOpen,
  Trash2,
  Tag,
  Plus,
  Download,
  Upload,
  X,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../constants';
import { Note } from '../types';

interface SidebarProps {
  currentCategory: string;
  onSelectCategory: (id: string) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onNewNote: (isChecklist?: boolean) => void;
  onExportAll: () => void;
  onImportNotes: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentCategory,
  onSelectCategory,
  selectedTag,
  onSelectTag,
  notes,
  isOpen,
  onClose,
  onNewNote,
  onExportAll,
  onImportNotes,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Calculate note counts per category
  const activeNotes = notes.filter((n) => !n.isDeleted);
  const trashNotes = notes.filter((n) => n.isDeleted);
  const pinnedNotes = activeNotes.filter((n) => n.isPinned);

  const getCategoryCount = (id: string) => {
    if (id === 'all') return activeNotes.length;
    if (id === 'pinned') return pinnedNotes.length;
    if (id === 'trash') return trashNotes.length;
    return activeNotes.filter((n) => n.category === id).length;
  };

  // Collect all unique tags across active notes
  const allTags = Array.from(
    new Set(activeNotes.flatMap((n) => n.tags || []).filter(Boolean))
  );

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'FileText':
        return <FileText className="w-4 h-4" />;
      case 'Pin':
        return <Pin className="w-4 h-4" />;
      case 'Briefcase':
        return <Briefcase className="w-4 h-4" />;
      case 'User':
        return <User className="w-4 h-4" />;
      case 'Lightbulb':
        return <Lightbulb className="w-4 h-4" />;
      case 'BookOpen':
        return <BookOpen className="w-4 h-4" />;
      case 'Trash2':
        return <Trash2 className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 z-30 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-40 w-64 md:w-72 bg-stone-50/90 border-r border-stone-200 flex flex-col transition-transform duration-200 ease-in-out select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-stone-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-300 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-semibold text-stone-900 text-base leading-tight tracking-tight">
                極簡記事本
              </h1>
              <p className="text-xs text-stone-500 font-normal">個人筆記與待辦清單</p>
            </div>
          </div>
          <button
            id="sidebar-close-btn"
            onClick={onClose}
            className="lg:hidden p-1.5 text-stone-500 hover:text-stone-800 rounded-md hover:bg-stone-200/70"
            aria-label="關閉側邊欄"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-3 space-y-2">
          <button
            id="new-note-main-btn"
            onClick={() => {
              onNewNote(false);
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white text-sm font-medium rounded-xl shadow-xs transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新增筆記</span>
          </button>

          <button
            id="new-checklist-btn"
            onClick={() => {
              onNewNote(true);
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 text-xs font-medium rounded-lg border border-stone-200/90 shadow-xs transition cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-stone-600" />
            <span>建立待辦清單</span>
          </button>
        </div>

        {/* Categories Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          <div>
            <div className="px-2 pb-1.5 text-xs font-semibold text-stone-400 tracking-wider">
              檢視分類
            </div>
            <nav className="space-y-0.5">
              {DEFAULT_CATEGORIES.map((cat) => {
                const isSelected = currentCategory === cat.id && !selectedTag;
                const count = getCategoryCount(cat.id);
                const isTrash = cat.id === 'trash';

                return (
                  <button
                    key={cat.id}
                    id={`category-btn-${cat.id}`}
                    onClick={() => {
                      onSelectCategory(cat.id);
                      onSelectTag(null);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-stone-200/80 text-stone-950 font-medium'
                        : isTrash
                        ? 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={isSelected ? 'text-stone-900' : 'text-stone-400'}>
                        {getIcon(cat.iconName)}
                      </span>
                      <span className="truncate">{cat.name}</span>
                    </div>
                    {count > 0 && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-stone-300/80 text-stone-900 font-semibold'
                            : 'bg-stone-200/60 text-stone-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tags Section */}
          {allTags.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 flex items-center justify-between text-xs font-semibold text-stone-400 tracking-wider">
                <span>標籤篩選</span>
                {selectedTag && (
                  <button
                    onClick={() => onSelectTag(null)}
                    className="text-stone-500 hover:text-stone-800 text-[11px] font-normal hover:underline"
                  >
                    清除標籤
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 px-1 py-1">
                {allTags.map((tag) => {
                  const isTagActive = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      id={`tag-filter-${tag}`}
                      onClick={() => {
                        onSelectTag(isTagActive ? null : tag);
                        onClose();
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                        isTagActive
                          ? 'bg-stone-800 text-stone-100 font-medium shadow-xs'
                          : 'bg-white text-stone-600 border border-stone-200/90 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <Tag className="w-3 h-3 text-stone-400" />
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions: Backup / Import */}
        <div className="p-3 border-t border-stone-200/80 bg-stone-100/50 space-y-1.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onImportNotes}
            accept=".json"
            className="hidden"
          />
          <div className="flex items-center gap-1.5">
            <button
              id="export-backup-btn"
              onClick={onExportAll}
              title="備份所有記事為 JSON 檔案"
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-200/90 rounded-lg text-xs text-stone-600 hover:text-stone-900 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>匯出備份</span>
            </button>
            <button
              id="import-backup-btn"
              onClick={() => fileInputRef.current?.click()}
              title="匯入 JSON 備份檔案"
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-200/90 rounded-lg text-xs text-stone-600 hover:text-stone-900 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-stone-500" />
              <span>匯入記事</span>
            </button>
          </div>
          <div className="text-[11px] text-center text-stone-400 pt-1">
            本機即時儲存 • 離線可用
          </div>
        </div>
      </aside>
    </>
  );
};
