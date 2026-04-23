import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

const ARIA = {
  'B': 'Bold', 'I': 'Italic', 'S': 'Strikethrough',
  '• List': 'Bullet list', '1. List': 'Ordered list',
  'Code': 'Inline code', 'Block': 'Code block', 'Clear': 'Clear formatting',
}

const ToolbarBtn = ({ label, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ARIA[label] || label}
    aria-pressed={active}
    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
      active
        ? 'bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100'
        : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-800 dark:hover:text-zinc-200'
    }`}
  >{label}</button>
)

export default function RichTextEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Include `editor` so the cleanup closes over the current editor instance.
  useEffect(() => () => editor?.destroy(), [editor])

  if (!editor) return null

  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex-wrap">
        <ToolbarBtn label="B" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <ToolbarBtn label="I" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        <ToolbarBtn label="S" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
        <ToolbarBtn label="• List" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <ToolbarBtn label="1. List" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
        <ToolbarBtn label="Code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} />
        <ToolbarBtn label="Block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} />
        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
        <ToolbarBtn label="Clear" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} active={false} />
      </div>
      <div className="px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
