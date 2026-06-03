import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react';

interface ManageTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
  addPlaceholder?: string;
}

export function ManageTagsDialog({
  open,
  onOpenChange,
  title,
  description,
  tags,
  onSave,
  addPlaceholder = 'New tag name',
}: ManageTagsDialogProps) {
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [newTag, setNewTag] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalTags(tags);
      setNewTag('');
      setEditingIndex(null);
      setEditingValue('');
    }
  }, [open, tags]);

  const persist = async (next: string[]) => {
    setSaving(true);
    try {
      await onSave(next);
      setLocalTags(next);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    if (localTags.some((t) => t.toLowerCase() === normalized)) return;
    const next = [...localTags, trimmed];
    await persist(next);
    setNewTag('');
  };

  const handleDelete = async (index: number) => {
    const next = localTags.filter((_, i) => i !== index);
    await persist(next);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(localTags[index]);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const confirmEdit = async () => {
    if (editingIndex === null) return;
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    if (localTags.some((t, i) => i !== editingIndex && t.toLowerCase() === normalized)) return;
    const next = localTags.map((t, i) => (i === editingIndex ? trimmed : t));
    await persist(next);
    cancelEdit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md h-[28rem] max-h-[85vh] flex flex-col overflow-hidden gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {localTags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No custom tags yet. Add one below.
            </p>
          ) : (
            localTags.map((tag, index) => (
              <div key={`${tag}-${index}`} className="flex items-center gap-2">
                {editingIndex === index ? (
                  <>
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void confirmEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={() => void confirmEdit()} disabled={saving}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm py-2 px-3 rounded-md bg-muted">{tag}</span>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(index)} disabled={saving}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => void handleDelete(index)}
                      disabled={saving}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 space-y-2 pt-3 border-t">
          <Label htmlFor="new-tag">Add new</Label>
          <div className="flex gap-2">
            <Input
              id="new-tag"
              placeholder={addPlaceholder}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <Button onClick={() => void handleAdd()} disabled={saving || !newTag.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
