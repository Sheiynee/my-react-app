import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

export default function RichTextEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => () => editor?.destroy(), [])

  if (!editor) return null

  const btn = (label, action, active) => (
    <button
      type="button"
      className={`rte-btn${active ? ' active' : ''}`}
      onClick={action}
    >{label}</button>
  )

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar">
        {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {btn('S̶', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
        <div className="rte-divider" />
        {btn('• List', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('1. List', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        <div className="rte-divider" />
        {btn('Code', () => editor.chain().focus().toggleCode().run(), editor.isActive('code'))}
        {btn('Block', () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
        <div className="rte-divider" />
        {btn('Clear', () => editor.chain().focus().unsetAllMarks().clearNodes().run(), false)}
      </div>
      <EditorContent editor={editor} className="rich-editor-content" />
    </div>
  )
}
