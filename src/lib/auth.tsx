import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './supabase'
import { openUserDb, db } from './db'
import { sync } from './sync'
import { seedEmpty, seedFullPlan } from '../data/seed'

import type { UiMode } from './mode'
export type { UiMode }
type Status = 'loading' | 'signedOut' | 'preparing' | 'ready' | 'error'

interface AuthValue {
  status: Status
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  mode: UiMode
  setMode: (m: UiMode) => void
  signOut: () => Promise<void>
  retry: () => void
  updateName: (name: string) => Promise<void>
}

const Ctx = createContext<AuthValue>(null as unknown as AuthValue)
export const useAuth = () => useContext(Ctx)

const MODE_KEY = 'milonote:mode'
const profileCache = (uid: string) => `milonote:profile:${uid}`

function applyMode(m: UiMode) {
  document.documentElement.dataset.mode = m
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', m === 'serious' ? '#F6F7F6' : '#FAF9F6')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setModeState] = useState<UiMode>(() => (localStorage.getItem(MODE_KEY) as UiMode) || 'playful')
  const [attempt, setAttempt] = useState(0)
  const prepared = useRef<string | null>(null)

  useEffect(() => applyMode(mode), [mode])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setStatus('signedOut')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        prepared.current = null
        setProfile(null)
        setStatus('signedOut')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Prepare the account: profile → local db → cloud pull → seed if brand new.
  useEffect(() => {
    const uid = session?.user.id
    if (!uid || prepared.current === `${uid}:${attempt}`) return
    prepared.current = `${uid}:${attempt}`
    let cancelled = false
    ;(async () => {
      setStatus('preparing')
      let prof: Profile | null = null
      const { data, error } = await supabase.rpc('ensure_profile', { p_name: (session.user.user_metadata?.name as string) ?? '' })
      if (!error && data) {
        prof = data as Profile
        localStorage.setItem(profileCache(uid), JSON.stringify(prof))
      } else {
        try {
          prof = JSON.parse(localStorage.getItem(profileCache(uid)) ?? 'null')
        } catch {
          prof = null
        }
      }
      if (cancelled) return
      if (!prof) return setStatus('error')
      setProfile(prof)
      if (prof.ui_mode && prof.ui_mode !== mode) {
        setModeState(prof.ui_mode)
        localStorage.setItem(MODE_KEY, prof.ui_mode)
      }
      const local = openUserDb(uid)
      await local.open()
      sync.attach(local, uid)
      const seeded = await local.kv.get('seeded')
      if (seeded) {
        if (!cancelled) setStatus('ready')
        void sync.sync()
        return
      }
      try {
        const count = await sync.pull(true)
        if (count === 0) {
          if (prof.role === 'admin') await seedFullPlan(local)
          else await seedEmpty(local)
          void sync.flush()
        } else if (!(await local.kv.get('seeded'))) {
          await local.kv.put({ key: 'seeded', value: 'pulled' })
        }
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = useCallback(
    (m: UiMode) => {
      setModeState(m)
      localStorage.setItem(MODE_KEY, m)
      if (profile) {
        const next = { ...profile, ui_mode: m }
        setProfile(next)
        localStorage.setItem(profileCache(profile.id), JSON.stringify(next))
        void supabase.from('profiles').update({ ui_mode: m }).eq('id', profile.id)
      }
    },
    [profile],
  )

  const updateName = useCallback(
    async (name: string) => {
      if (!profile) return
      const { error } = await supabase.from('profiles').update({ name }).eq('id', profile.id)
      if (error) throw new Error('ما انحفظ الاسم، جرّب كمان مرة.')
      const next = { ...profile, name }
      setProfile(next)
      localStorage.setItem(profileCache(profile.id), JSON.stringify(next))
    },
    [profile],
  )

  const signOut = useCallback(async () => {
    const uid = session?.user.id
    await sync.flush().catch(() => {})
    const unsynced = sync.pending()
    sync.detach()
    await supabase.auth.signOut()
    // Remove this account's data from the device (only if everything reached the cloud).
    if (uid && unsynced === 0) {
      db.close()
      await db.delete().catch(() => {})
      sync.forget(uid)
      localStorage.removeItem(profileCache(uid))
    }
  }, [session])

  return (
    <Ctx.Provider
      value={{
        status,
        session,
        profile,
        isAdmin: profile?.role === 'admin',
        mode,
        setMode,
        signOut,
        retry: () => setAttempt((a) => a + 1),
        updateName,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
