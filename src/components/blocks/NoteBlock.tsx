import { memo, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { NoteBlock as NoteBlockType } from "../../lib/types";
import { useScarecrowStore } from "../../store";

interface NoteBlockProps {
  block: NoteBlockType;
  selected: boolean;
}

const NoteBlock = memo(({ block, selected }: NoteBlockProps) => {
  const editingBlockId = useScarecrowStore((state) => state.editingBlockId);
  const setEditingBlockId = useScarecrowStore((state) => state.setEditingBlockId);
  const updateBlock = useScarecrowStore((state) => state.updateBlock);
  const isEditing = editingBlockId === block.id;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Link.configure({
        openOnClick: false
      })
    ],
    content: block.content.html,
    editable: isEditing,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      updateBlock(
        block.id,
        {
          content: {
            ...block.content,
            html: editor.getHTML()
          }
        },
        { skipHistory: true }
      );
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(isEditing);
    if (editor.getHTML() !== block.content.html) {
      editor.commands.setContent(block.content.html, false);
    }
  }, [block.content.html, editor, isEditing]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!isEditing) {
        return;
      }
      const target = event.target as HTMLElement;
      if (!target.closest(`[data-note-root="${block.id}"]`)) {
        setEditingBlockId(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [block.id, isEditing, setEditingBlockId]);

  return (
    <div
      className="note-block"
      data-note-root={block.id}
      style={{ background: block.content.bgColor }}
      onDoubleClick={() => selected && setEditingBlockId(block.id)}
    >
      <div className="block-title">Note</div>
      {editor && isEditing ? (
        <div className="note-bubble note-toolbar" data-block-interactive="true">
          <button
            type="button"
            className="bubble-button"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className="bubble-button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className="bubble-button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            List
          </button>
          <button
            type="button"
            className="bubble-button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </button>
          <button
            type="button"
            className="bubble-button"
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            {"</>"}
          </button>
        </div>
      ) : null}
      <div
        className="note-editor"
        data-block-interactive={isEditing ? "true" : undefined}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

export default NoteBlock;
