import { Note } from '../types';
import { saveFile } from './fileSaver';

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return '剛剛';
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return `今天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }
  if (diffDays === 1 || (diffDays < 2 && date.getDate() === now.getDate() - 1)) {
    return `昨天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function getNoteStats(note: Note): { words: number; chars: number; itemsCount?: number; completedCount?: number } {
  if (note.isChecklist) {
    const total = note.checklistItems.length;
    const completed = note.checklistItems.filter((i) => i.completed).length;
    return {
      words: note.checklistItems.reduce((acc, curr) => acc + curr.text.trim().split(/\s+/).filter(Boolean).length, 0),
      chars: note.checklistItems.reduce((acc, curr) => acc + curr.text.length, 0) + note.title.length,
      itemsCount: total,
      completedCount: completed,
    };
  }

  const text = (note.title + ' ' + note.content).trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = (note.title + note.content).length;

  return { words, chars };
}

export function exportNoteAsFile(note: Note, format: 'md' | 'txt') {
  let content = '';
  const title = note.title.trim() || '未命名記事';

  if (format === 'md') {
    content = `# ${title}\n\n`;
    if (note.tags.length > 0) {
      content += `> 標籤: ${note.tags.map((t) => `#${t}`).join(' ')}\n\n`;
    }
    if (note.isChecklist) {
      content += note.checklistItems
        .map((item) => `- [${item.completed ? 'x' : ' '}] ${item.text}`)
        .join('\n');
    } else {
      content += note.content;
    }
  } else {
    content = `${title}\n${'='.repeat(title.length * 2)}\n\n`;
    if (note.isChecklist) {
      content += note.checklistItems
        .map((item) => `[${item.completed ? '✓' : ' '}] ${item.text}`)
        .join('\n');
    } else {
      content += note.content;
    }
  }

  const fileName = `${title.replace(/[\/\\?%*:|"<>]/g, '_')}.${format}`;
  const mimeType = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
  void saveFile({ fileName, data: content, mimeType });
}

export function exportAllNotesAsJson(notes: Note[]) {
  const data = JSON.stringify(notes, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `notes_backup_${dateStr}.json`;
  void saveFile({ fileName, data, mimeType: 'application/json;charset=utf-8' });
}
