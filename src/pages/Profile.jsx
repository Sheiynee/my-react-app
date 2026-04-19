import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '../firebase'
import * as api from '../api'

export default function Profile() {
  const { user } = useAuth()
  const fileRef = useRef(null)

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Load existing profile from Firestore
  useEffect(() => {
    api.getMe().then(data => {
      setDisplayName(data.displayName || user?.displayName || '')
      setBio(data.bio || '')
      setTimezone(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
      setPhotoURL(data.photoURL || user?.photoURL || '')
    }).catch(() => {})
  }, [user])

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }

    setUploading(true)
    setError('')
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      setPhotoURL(url)
      await updateProfile(auth.currentUser, { photoURL: url })
    } catch (err) {
      setError('Failed to upload image. Make sure Firebase Storage is enabled.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!displayName.trim()) { setError('Display name is required'); return }
    setSaving(true)
    setError('')
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim(), photoURL })
      await api.updateMe({ displayName: displayName.trim(), bio, timezone, photoURL })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const initials = (displayName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const isDiscord = user?.uid?.startsWith('discord_')

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-8">Profile & Settings</h1>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-zinc-700">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-2xl font-semibold">
                  {initials}
                </div>
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
            {isDiscord && user?.photoURL && photoURL !== user.photoURL && (
              <button
                type="button"
                onClick={() => setPhotoURL(user.photoURL)}
                className="text-xs text-blue-500 hover:underline text-left"
              >
                Reset to Discord avatar
              </button>
            )}
            <p className="text-xs text-gray-400 dark:text-zinc-500">JPG, PNG or GIF · Max 5MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="A short bio about yourself…"
            />
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 text-right">{bio.length}/200</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Intl.supportedValuesOf('timeZone').map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Read-only account info */}
          <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-600">Account</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-zinc-400">Email</span>
              <span className="text-gray-900 dark:text-zinc-100">{user?.email || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-zinc-400">Sign-in method</span>
              <span className="text-gray-900 dark:text-zinc-100 flex items-center gap-1.5">
                {isDiscord ? (
                  <>
                    <span className="w-3 h-3 rounded-full bg-[#5865F2] inline-block" />
                    Discord
                  </>
                ) : 'Email / Password'}
              </span>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || uploading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && (
            <span className="text-sm text-green-500 font-medium">Saved!</span>
          )}
        </div>
      </form>
    </div>
  )
}
