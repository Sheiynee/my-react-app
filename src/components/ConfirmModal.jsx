import Modal from './Modal'

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  dangerous = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal title={title} onClose={onClose} width="400px">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-600 dark:text-zinc-400">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`text-sm font-medium px-4 py-2 rounded-xl text-white transition-colors ${
              dangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
