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
  Role,
  StaffUser,
  Student,
} from '@/types'
import {
  ApiError,
  createApplicationRequest,
  createProgramRequest,
  changeOwnPasswordRequest,
  createStaffRequest,
  createStudentRequest,
  deleteApplicationRequest,
  deleteProgramRequest,
  deleteStaffRequest,
  deleteStudentRequest,
  fetchBootstrap,
  importDataRequest,
  listStaffRequest,
  promoteToStudentRequest,
  resetDataRequest,
  saveSettingsRequest,
  setApplicationStatusRequest,
  setStoredToken,
  signInRequest,
  signOutRequest,
  storedToken,
  updateApplicationRequest,
  updateProgramRequest,
  updateStaffRequest,
  updateStudentRequest,
  uploadDocumentRequest,
} from '@/lib/api'
import type { CreateApplicationInput, CreateStudentInput } from '@/lib/api'
import { randomId } from '@/lib/id'
import { buildDemoData } from '@/lib/demoData'
import { DEFAULT_COLLEGE } from '@/lib/defaults'
import { clearLegacyData, collectLegacyData, legacyRecordCount } from '@/lib/legacyData'

/* ------------------------------------------------------------------ */
/* Context shape                                                      */
/* ------------------------------------------------------------------ */

export type StoreStatus = 'loading' | 'ready' | 'error'

export interface ImportResult {
  ok: boolean
  message: string
  counts?: { programs: number; applications: number; students: number }
}

interface StoreContextValue {
  /* Session */
  status: StoreStatus
  loadError: string | null
  /** Signed-in staff member, or null. */
  me: StaffUser | null
  /** True when the account may create, edit and delete records. */
  canEdit: boolean
  /** True when the account may manage staff and clear the database. */
  isAdmin: boolean
  signIn: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>
  signOut: () => void
  /** Rotates the signed-in account's password. */
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<void>
  retry: () => void

  /* Data */
  settings: AppSettings
  saveCollege: (college: AppSettings['college']) => Promise<void>

  programs: Program[]
  createProgram: (input: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Program>
  updateProgram: (id: string, patch: Partial<Program>) => Promise<void>
  deleteProgram: (id: string) => Promise<void>

  applications: Application[]
  createApplication: (input: CreateApplicationInput) => Promise<Application>
  updateApplication: (id: string, patch: Partial<Application>) => Promise<void>
  setApplicationStatus: (id: string, status: ApplicationStatus, note?: string) => Promise<void>
  deleteApplication: (id: string) => Promise<void>
  /** Uploads a file to Postgres and returns the metadata to store on the record. */
  uploadDocument: (
    applicationId: string,
    label: Application['documents']['photograph'] extends null ? never : keyof Application['documents'],
    file: File,
  ) => Promise<{ id: string; fileName: string; mimeType: string; size: number }>

  students: Student[]
  createStudent: (input: CreateStudentInput) => Promise<Student>
  updateStudent: (id: string, patch: Partial<Student>) => Promise<void>
  deleteStudent: (id: string) => Promise<void>
  promoteToStudent: (
    applicationId: string,
  ) => Promise<{ ok: boolean; student?: Student; message?: string }>

  /* Utilities */
  programById: (id: string) => Program | undefined
  applicationById: (id: string) => Application | undefined
  studentById: (id: string) => Student | undefined

  /* Staff */
  staff: StaffUser[]
  loadStaff: () => Promise<void>
  createStaff: (input: {
    username: string
    displayName: string
    password: string
    role: Role
  }) => Promise<void>
  updateStaff: (
    id: string,
    patch: Partial<Pick<StaffUser, 'displayName' | 'role' | 'active'>> & { password?: string },
  ) => Promise<void>
  deleteStaff: (id: string) => Promise<void>

  /* Data management */
  importData: (payload: unknown) => Promise<ImportResult>
  loadDemoData: () => Promise<ImportResult>
  resetAllData: () => Promise<void>
  legacyCount: number
  migrateLegacyData: () => Promise<ImportResult>
}

const StoreContext = createContext<StoreContextValue | null>(null)

const DEFAULT_SETTINGS: AppSettings = { college: { ...DEFAULT_COLLEGE } }

/** Shape of an exported backup file. */
export interface ImportPayload {
  version?: number
  exportedAt?: string
  programs?: Partial<Program>[]
  applications?: Partial<Application>[]
  students?: Partial<Student>[]
  settings?: { college?: Partial<AppSettings['college']> }
}

/* ------------------------------------------------------------------ */
/* Provider                                                           */
/* ------------------------------------------------------------------ */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StoreStatus>(() =>
    storedToken() ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  const [me, setMe] = useState<StaffUser | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [programs, setPrograms] = useState<Program[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [legacyCount, setLegacyCount] = useState(() => legacyRecordCount())

  /* ------------------------- Loading ------------------------- */

  const load = useCallback(async () => {
    if (!storedToken()) {
      setMe(null)
      setStatus('ready')
      return
    }

    setStatus('loading')
    setLoadError(null)

    try {
      const data = await fetchBootstrap()
      setMe(data.user)
      setSettings({ college: { ...DEFAULT_COLLEGE, ...data.settings.college } })
      setPrograms(data.programs)
      setApplications(data.applications)
      setStudents(data.students)
      setStatus('ready')
    } catch (error) {
      // A 401 clears the token in the API client, so this is a signed-out
      // state rather than a failure worth showing.
      if (error instanceof ApiError && error.status === 401) {
        setMe(null)
        setStatus('ready')
        return
      }
      setLoadError(
        error instanceof Error ? error.message : 'The database could not be reached.',
      )
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => {
    void load()
  }, [load])

  /* ------------------------- Session ------------------------- */

  const signIn = useCallback<StoreContextValue['signIn']>(async (username, password) => {
    const trimmed = username.trim()
    if (!trimmed || !password) {
      return { ok: false, message: 'Enter both your username and password.' }
    }

    try {
      const result = await signInRequest(trimmed, password)
      setStoredToken(result.token)
      await load()
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Sign in failed. Please try again.',
      }
    }
  }, [load])

  const signOut = useCallback(() => {
    void signOutRequest().catch(() => undefined)
    setStoredToken(null)
    setMe(null)
    setPrograms([])
    setApplications([])
    setStudents([])
    setStaff([])
  }, [])

  const changeOwnPassword = useCallback<StoreContextValue['changeOwnPassword']>(
    async (currentPassword, newPassword) => {
      await changeOwnPasswordRequest(currentPassword, newPassword)
    },
    [],
  )

  const canEdit = me?.role === 'admin' || me?.role === 'registrar'
  const isAdmin = me?.role === 'admin'

  /* ------------------------ Settings ------------------------- */

  const saveCollege = useCallback<StoreContextValue['saveCollege']>(async (college) => {
    const result = await saveSettingsRequest(college)
    setSettings({ college: { ...DEFAULT_COLLEGE, ...result.college } })
  }, [])

  /* ------------------------ Programs ------------------------- */

  const createProgram = useCallback<StoreContextValue['createProgram']>(async (input) => {
    const created = await createProgramRequest(input)
    setPrograms((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [])

  const updateProgram = useCallback<StoreContextValue['updateProgram']>(async (id, patch) => {
    const updated = await updateProgramRequest(id, patch)
    setPrograms((prev) =>
      prev
        .map((program) => (program.id === id ? updated : program))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }, [])

  const deleteProgram = useCallback<StoreContextValue['deleteProgram']>(async (id) => {
    await deleteProgramRequest(id)
    setPrograms((prev) => prev.filter((program) => program.id !== id))
  }, [])

  /* --------------------- Applications ----------------------- */

  const createApplication = useCallback<StoreContextValue['createApplication']>(
    async (input) => {
      const created = await createApplicationRequest(input)
      setApplications((prev) => [created, ...prev])
      return created
    },
    [],
  )

  const updateApplication = useCallback<StoreContextValue['updateApplication']>(
    async (id, patch) => {
      const updated = await updateApplicationRequest(id, patch)
      setApplications((prev) => prev.map((application) => (application.id === id ? updated : application)))
    },
    [],
  )

  const setApplicationStatus = useCallback<StoreContextValue['setApplicationStatus']>(
    async (id, status, note) => {
      const updated = await setApplicationStatusRequest(id, status, note)
      setApplications((prev) => prev.map((application) => (application.id === id ? updated : application)))
    },
    [],
  )

  const deleteApplication = useCallback<StoreContextValue['deleteApplication']>(async (id) => {
    await deleteApplicationRequest(id)
    setApplications((prev) => prev.filter((application) => application.id !== id))
  }, [])

  const uploadDocument = useCallback<StoreContextValue['uploadDocument']>(
    async (applicationId, label, file) => {
      const id = randomId()
      await uploadDocumentRequest(
        applicationId,
        { id, label, fileName: file.name, mimeType: file.type || 'application/octet-stream' },
        file,
      )
      return { id, fileName: file.name, mimeType: file.type, size: file.size }
    },
    [],
  )

  /* ------------------------ Students ------------------------- */

  const createStudent = useCallback<StoreContextValue['createStudent']>(async (input) => {
    const created = await createStudentRequest(input)
    setStudents((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [])

  const updateStudent = useCallback<StoreContextValue['updateStudent']>(async (id, patch) => {
    const updated = await updateStudentRequest(id, patch)
    setStudents((prev) =>
      prev.map((student) => (student.id === id ? updated : student)).sort((a, b) => a.name.localeCompare(b.name)),
    )
  }, [])

  const deleteStudent = useCallback<StoreContextValue['deleteStudent']>(async (id) => {
    await deleteStudentRequest(id)
    setStudents((prev) => prev.filter((student) => student.id !== id))
  }, [])

  const promoteToStudent = useCallback<StoreContextValue['promoteToStudent']>(
    async (applicationId) => {
      try {
        const student = await promoteToStudentRequest(applicationId)
        setStudents((prev) => [...prev, student].sort((a, b) => a.name.localeCompare(b.name)))
        return { ok: true, student }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to enrol the student.'
        // A duplicate is not an error worth alarming about — it is a fact.
        return { ok: false, message }
      }
    },
    [],
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

  /* ------------------------- Staff --------------------------- */

  const loadStaff = useCallback(async () => {
    if (!isAdmin) return
    const result = await listStaffRequest()
    setStaff(result.users)
  }, [isAdmin])

  const createStaff = useCallback<StoreContextValue['createStaff']>(async (input) => {
    const created = await createStaffRequest(input)
    setStaff((prev) => [...prev, created])
  }, [])

  const updateStaff = useCallback<StoreContextValue['updateStaff']>(async (id, patch) => {
    const updated = await updateStaffRequest(id, patch)
    setStaff((prev) => prev.map((user) => (user.id === id ? updated : user)))

    // Editing your own account changes what the session is allowed to do.
    if (updated.id === me?.id) {
      setMe((prev) => (prev ? { ...prev, ...updated } : prev))
    }
  }, [me?.id])

  const deleteStaff = useCallback<StoreContextValue['deleteStaff']>(async (id) => {
    await deleteStaffRequest(id)
    setStaff((prev) => prev.filter((user) => user.id !== id))
  }, [])

  /* -------------------- Data management ---------------------- */

  const importData = useCallback<StoreContextValue['importData']>(async (payload) => {
    try {
      const result = await importDataRequest(payload)
      await load()
      return {
        ok: true,
        message: 'Backup restored.',
        counts: result.counts,
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'The backup could not be read.',
      }
    }
  }, [load])

  const loadDemoData = useCallback<StoreContextValue['loadDemoData']>(async () => {
    const demo = buildDemoData()
    return importData({
      programs: demo.programs,
      applications: demo.applications,
      students: demo.students,
      settings: { college: demo.settings.college },
    })
  }, [importData])

  const resetAllData = useCallback<StoreContextValue['resetAllData']>(async () => {
    await resetDataRequest()
    setPrograms([])
    setApplications([])
    setStudents([])
    setSettings(DEFAULT_SETTINGS)
    setLegacyCount(legacyRecordCount())
  }, [])

  const migrateLegacyData = useCallback<StoreContextValue['migrateLegacyData']>(async () => {
    const { payload, documentCount } = await collectLegacyData()

    const counts = {
      programs: payload.programs?.length ?? 0,
      applications: payload.applications?.length ?? 0,
      students: payload.students?.length ?? 0,
    }

    if (counts.programs + counts.applications + counts.students === 0) {
      clearLegacyData()
      setLegacyCount(0)
      return {
        ok: true,
        message: 'There was nothing left in the browser to import.',
        counts,
      }
    }

    const result = await importData(payload)

    if (result.ok) {
      clearLegacyData()
      setLegacyCount(legacyRecordCount())
      return {
        ok: true,
        message: documentCount
          ? `Imported ${counts.applications} applications, including ${documentCount} uploaded document${documentCount === 1 ? '' : 's'}. The browser copy has been cleared.`
          : 'Imported your browser records and cleared the local copy.',
        counts,
      }
    }

    return result
  }, [importData])

  const value = useMemo<StoreContextValue>(
    () => ({
      status,
      loadError,
      me,
      canEdit,
      isAdmin,
      signIn,
      signOut,
      changeOwnPassword,
      retry,

      settings,
      saveCollege,

      programs,
      createProgram,
      updateProgram,
      deleteProgram,

      applications,
      createApplication,
      updateApplication,
      setApplicationStatus,
      deleteApplication,
      uploadDocument,

      students,
      createStudent,
      updateStudent,
      deleteStudent,
      promoteToStudent,

      programById,
      applicationById,
      studentById,

      staff,
      loadStaff,
      createStaff,
      updateStaff,
      deleteStaff,

      importData,
      loadDemoData,
      resetAllData,
      legacyCount,
      migrateLegacyData,
    }),
    [
      status,
      loadError,
      me,
      canEdit,
      isAdmin,
      signIn,
      signOut,
      changeOwnPassword,
      retry,
      settings,
      saveCollege,
      programs,
      createProgram,
      updateProgram,
      deleteProgram,
      applications,
      createApplication,
      updateApplication,
      setApplicationStatus,
      deleteApplication,
      uploadDocument,
      students,
      createStudent,
      updateStudent,
      deleteStudent,
      promoteToStudent,
      programById,
      applicationById,
      studentById,
      staff,
      loadStaff,
      createStaff,
      updateStaff,
      deleteStaff,
      importData,
      loadDemoData,
      resetAllData,
      legacyCount,
      migrateLegacyData,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used inside a StoreProvider.')
  return context
}
