import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type {
  Application,
  ApplicationStatus,
  AppSettings,
  Program,
  Student,
} from '@/types'
import {
  loadApplications,
  loadPrograms,
  loadSession,
  loadSettings,
  loadStudents,
  saveApplications,
  savePrograms,
  saveSession,
  saveSettings,
  saveStudents,
  clearSession,
} from '@/lib/repository'
import type { AuthSession } from '@/lib/repository'
import { nextSequentialId, randomId } from '@/lib/id'
import { currentSessionYear } from '@/lib/id'
import { clearDocuments, deleteDocument } from '@/lib/documentStore'
import { clearAllStores, storageUsageBytes } from '@/lib/storage'

/* ------------------------------------------------------------------ */
/* Context shape                                                      */
/* ------------------------------------------------------------------ */

export interface CreateApplicationInput {
  personal: Application['personal']
  academic: Application['academic']
  program: Application['program']
  address: Application['address']
  documents: Application['documents']
}

interface StoreContextValue {
  /* Session */
  session: AuthSession | null
  signIn: (username: string, password: string) => { ok: boolean; message?: string }
  signOut: () => void

  /* Data */
  settings: AppSettings
  updateSettings: (next: AppSettings) => void
  updateCollege: (patch: Partial<AppSettings['college']>) => void

  programs: Program[]
  createProgram: (input: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>) => Program
  updateProgram: (id: string, patch: Partial<Program>) => void
  deleteProgram: (id: string) => void

  applications: Application[]
  createApplication: (input: CreateApplicationInput) => Application
  updateApplication: (id: string, patch: Partial<Application>) => void
  setApplicationStatus: (id: string, status: ApplicationStatus, note?: string) => void
  deleteApplication: (id: string) => void

  students: Student[]
  createStudent: (input: Omit<Student, 'id' | 'studentNo' | 'createdAt' | 'updatedAt'>) => Student
  updateStudent: (id: string, patch: Partial<Student>) => void
  deleteStudent: (id: string) => void
  promoteToStudent: (applicationId: string) => { ok: boolean; student?: Student; message?: string }

  /* Utilities */
  programById: (id: string) => Program | undefined
  applicationById: (id: string) => Application | undefined
  studentById: (id: string) => Student | undefined
  storageBytes: number
  resetAllData: () => void
  loadDemoData: () => void
  importData: (payload: ImportPayload) => ImportResult
}

const StoreContext = createContext<StoreContextValue | null>(null)

const nowIso = () => new Date().toISOString()

/** Shape of an exported backup file. */
export interface ImportPayload {
  version?: number
  programs?: Program[]
  applications?: Application[]
  students?: Student[]
  settings?: {
    college?: Partial<AppSettings['college']>
    admin?: { username?: string; displayName?: string }
  }
}

export interface ImportResult {
  ok: boolean
  message: string
  counts?: { programs: number; applications: number; students: number }
}

/** Minimal shape checks so a malformed file is rejected instead of corrupting state. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizePrograms(input: unknown): Program[] {
  if (!Array.isArray(input)) return []
  return input.filter(
    (item): item is Program =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.code === 'string',
  )
}

function sanitizeApplications(input: unknown): Application[] {
  if (!Array.isArray(input)) return []
  return input.filter(
    (item): item is Application =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.applicationNo === 'string' &&
      isRecord(item.personal),
  )
}

function sanitizeStudents(input: unknown): Student[] {
  if (!Array.isArray(input)) return []
  return input.filter(
    (item): item is Student =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.studentNo === 'string' &&
      typeof item.name === 'string',
  )
}

/* ------------------------------------------------------------------ */
/* Provider                                                           */
/* ------------------------------------------------------------------ */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [programs, setPrograms] = useState<Program[]>(() => loadPrograms())
  const [applications, setApplications] = useState<Application[]>(() => loadApplications())
  const [students, setStudents] = useState<Student[]>(() => loadStudents())
  const [storageBytes, setStorageBytes] = useState(() => storageUsageBytes())

  // Keep the sidebar counters fresh after any write.
  const refreshStorage = useCallback(() => {
    setStorageBytes(storageUsageBytes())
  }, [])

  useEffect(() => {
    refreshStorage()
  }, [programs, applications, students, settings, refreshStorage])

  /* ------------------------- Session ------------------------- */

  const signIn = useCallback(
    (username: string, password: string) => {
      const trimmedUser = username.trim()
      if (!trimmedUser || !password) {
        return { ok: false, message: 'Enter both your username and password.' }
      }

      const admin = settings.admin
      const userMatches = trimmedUser.toLowerCase() === admin.username.toLowerCase()
      const passwordMatches = password === admin.password

      if (!userMatches || !passwordMatches) {
        return { ok: false, message: 'Incorrect username or password. Please try again.' }
      }

      const next: AuthSession = {
        username: admin.username,
        displayName: admin.displayName,
        signedInAt: nowIso(),
      }
      saveSession(next)
      setSession(next)
      return { ok: true }
    },
    [settings.admin],
  )

  const signOut = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  /* ------------------------ Settings ------------------------- */

  const updateSettings = useCallback((next: AppSettings) => {
    saveSettings(next)
    setSettings(next)
  }, [])

  const updateCollege = useCallback((patch: Partial<AppSettings['college']>) => {
    setSettings((prev) => {
      const next = { ...prev, college: { ...prev.college, ...patch } }
      saveSettings(next)
      return next
    })
  }, [])

  /* ------------------------ Programs ------------------------- */

  const createProgram = useCallback<StoreContextValue['createProgram']>((input) => {
    const timestamp = nowIso()
    const program: Program = { ...input, id: randomId(), createdAt: timestamp, updatedAt: timestamp }
    setPrograms((prev) => {
      const next = [...prev, program]
      savePrograms(next)
      return next
    })
    return program
  }, [])

  const updateProgram = useCallback<StoreContextValue['updateProgram']>((id, patch) => {
    setPrograms((prev) => {
      const next = prev.map((program) =>
        program.id === id ? { ...program, ...patch, id: program.id, updatedAt: nowIso() } : program,
      )
      savePrograms(next)
      return next
    })
  }, [])

  const deleteProgram = useCallback<StoreContextValue['deleteProgram']>((id) => {
    setPrograms((prev) => {
      const next = prev.filter((program) => program.id !== id)
      savePrograms(next)
      return next
    })
    // Applications and students keep their historical programId; we leave the
    // text intact there and display "Program removed" where it no longer exists.
  }, [])

  /* --------------------- Applications ----------------------- */

  const createApplication = useCallback<StoreContextValue['createApplication']>((input) => {
    const timestamp = nowIso()
    let created: Application | null = null

    setApplications((prev) => {
      const applicationNo = nextSequentialId(
        'LCM',
        currentSessionYear(),
        prev.map((item) => item.applicationNo),
      )
      created = {
        ...input,
        id: randomId(),
        applicationNo,
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const next = [...prev, created]
      saveApplications(next)
      return next
    })

    if (!created) {
      throw new Error('Unable to create the application.')
    }
    return created
  }, [])

  const updateApplication = useCallback<StoreContextValue['updateApplication']>((id, patch) => {
    setApplications((prev) => {
      const next = prev.map((application) =>
        application.id === id ? { ...application, ...patch, id: application.id, updatedAt: nowIso() } : application,
      )
      saveApplications(next)
      return next
    })
  }, [])

  const setApplicationStatus = useCallback<StoreContextValue['setApplicationStatus']>(
    (id, status, note) => {
      setApplications((prev) => {
        const next = prev.map((application) =>
          application.id === id
            ? { ...application, status, reviewNote: note ?? application.reviewNote, updatedAt: nowIso() }
            : application,
        )
        saveApplications(next)
        return next
      })
    },
    [],
  )

  const deleteApplication = useCallback<StoreContextValue['deleteApplication']>((id) => {
    // Remove any stored document binaries before dropping the metadata.
    setApplications((prev) => {
      const target = prev.find((application) => application.id === id)
      if (target) {
        Object.values(target.documents).forEach((doc) => {
          if (doc) void deleteDocument(doc.id)
        })
      }
      const next = prev.filter((application) => application.id !== id)
      saveApplications(next)
      return next
    })
  }, [])

  /* ------------------------ Students ------------------------- */

  const createStudent = useCallback<StoreContextValue['createStudent']>((input) => {
    const timestamp = nowIso()
    let created: Student | null = null

    setStudents((prev) => {
      const studentNo = nextSequentialId(
        'STU',
        currentSessionYear(),
        prev.map((item) => item.studentNo),
      )
      created = { ...input, id: randomId(), studentNo, createdAt: timestamp, updatedAt: timestamp }
      const next = [...prev, created]
      saveStudents(next)
      return next
    })

    if (!created) {
      throw new Error('Unable to create the student record.')
    }
    return created
  }, [])

  const updateStudent = useCallback<StoreContextValue['updateStudent']>((id, patch) => {
    setStudents((prev) => {
      const next = prev.map((student) =>
        student.id === id ? { ...student, ...patch, id: student.id, updatedAt: nowIso() } : student,
      )
      saveStudents(next)
      return next
    })
  }, [])

  const deleteStudent = useCallback<StoreContextValue['deleteStudent']>((id) => {
    setStudents((prev) => {
      const next = prev.filter((student) => student.id !== id)
      saveStudents(next)
      return next
    })
  }, [])

  const promoteToStudent = useCallback<StoreContextValue['promoteToStudent']>(
    (applicationId) => {
      const application = applications.find((item) => item.id === applicationId)

      if (!application) {
        return { ok: false, message: 'Application not found.' }
      }

      if (application.status !== 'approved') {
        return { ok: false, message: 'Only approved applications can be enrolled.' }
      }

      const existing = students.find((student) => student.applicationId === applicationId)
      if (existing) {
        return {
          ok: false,
          message: `${existing.name} is already enrolled as ${existing.studentNo}.`,
          student: existing,
        }
      }

      let created: Student | null = null

      setStudents((prev) => {
        const timestamp = nowIso()
        const studentNo = nextSequentialId(
          'STU',
          currentSessionYear(),
          prev.map((item) => item.studentNo),
        )
        created = {
          id: randomId(),
          studentNo,
          applicationId,
          name: application.personal.fullName,
          fatherName: application.personal.fatherName,
          phone: application.personal.phone,
          email: application.personal.email,
          cnic: application.personal.cnic,
          programId: application.program.programId,
          admissionDate: application.createdAt.slice(0, 10),
          status: 'active',
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        const next = [...prev, created]
        saveStudents(next)
        return next
      })

      if (!created) {
        return { ok: false, message: 'Unable to enrol the student.' }
      }

      return { ok: true, student: created }
    },
    [applications, students],
  )

  /* ------------------------ Lookups ------------------------- */

  const programById = useCallback(
    (id: string) => programs.find((program) => program.id === id),
    [programs],
  )

  const applicationById = useCallback(
    (id: string) => applications.find((application) => application.id === id),
    [applications],
  )

  const studentById = useCallback(
    (id: string) => students.find((student) => student.id === id),
    [students],
  )

  /* ------------------------- Admin -------------------------- */

  const resetAllData = useCallback(() => {
    clearAllStores()
    void clearDocuments()
    setPrograms([])
    setApplications([])
    setStudents([])
    setSettings(loadSettings())
    setStorageBytes(0)
  }, [])

  const loadDemoData = useCallback(() => {
    void import('@/lib/demoData').then(({ applyDemoData }) => {
      const result = applyDemoData()
      setPrograms(result.programs)
      setApplications(result.applications)
      setStudents(result.students)
      setSettings(result.settings)
      refreshStorage()
    })
  }, [refreshStorage])

  const importData = useCallback<StoreContextValue['importData']>(
    (payload) => {
      const incomingPrograms = sanitizePrograms(payload.programs)
      const incomingApplications = sanitizeApplications(payload.applications)
      const incomingStudents = sanitizeStudents(payload.students)

      if (
        incomingPrograms.length === 0 &&
        incomingApplications.length === 0 &&
        incomingStudents.length === 0
      ) {
        return {
          ok: false,
          message: 'No valid records were found in this file.',
        }
      }

      // Merge on id so re-importing the same backup does not duplicate rows.
      setPrograms((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]))
        incomingPrograms.forEach((item) => map.set(item.id, item))
        const next = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
        savePrograms(next)
        return next
      })

      setApplications((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]))
        incomingApplications.forEach((item) => map.set(item.id, item))
        const next = [...map.values()]
        saveApplications(next)
        return next
      })

      setStudents((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]))
        incomingStudents.forEach((item) => map.set(item.id, item))
        const next = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
        saveStudents(next)
        return next
      })

      // The imported password is never applied, so credentials stay under the
      // control of whoever is signed in right now.
      setSettings((prev) => {
        const next: AppSettings = {
          college: { ...prev.college, ...(payload.settings?.college ?? {}) },
          admin: {
            ...prev.admin,
            username: payload.settings?.admin?.username ?? prev.admin.username,
            displayName: payload.settings?.admin?.displayName ?? prev.admin.displayName,
          },
        }
        saveSettings(next)
        return next
      })

      refreshStorage()

      return {
        ok: true,
        message: 'Backup restored successfully.',
        counts: {
          programs: incomingPrograms.length,
          applications: incomingApplications.length,
          students: incomingStudents.length,
        },
      }
    },
    [refreshStorage],
  )

  const value = useMemo<StoreContextValue>(
    () => ({
      session,
      signIn,
      signOut,
      settings,
      updateSettings,
      updateCollege,
      programs,
      createProgram,
      updateProgram,
      deleteProgram,
      applications,
      createApplication,
      updateApplication,
      setApplicationStatus,
      deleteApplication,
      students,
      createStudent,
      updateStudent,
      deleteStudent,
      promoteToStudent,
      programById,
      applicationById,
      studentById,
      storageBytes,
      resetAllData,
      loadDemoData,
      importData,
    }),
    [
      session,
      signIn,
      signOut,
      settings,
      updateSettings,
      updateCollege,
      programs,
      createProgram,
      updateProgram,
      deleteProgram,
      applications,
      createApplication,
      updateApplication,
      setApplicationStatus,
      deleteApplication,
      students,
      createStudent,
      updateStudent,
      deleteStudent,
      promoteToStudent,
      programById,
      applicationById,
      studentById,
      storageBytes,
      resetAllData,
      loadDemoData,
      importData,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used inside a StoreProvider.')
  return context
}