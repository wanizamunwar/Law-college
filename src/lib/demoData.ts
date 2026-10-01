/**
 * Demonstration dataset.
 *
 * Nothing here is required by the application — it exists so the dashboard,
 * tables and filters can be reviewed with realistic content. Programs are
 * created through the same shape the Programs page writes, and the admin can
 * wipe everything from Settings.
 */

import type { Application, Program, Student } from '@/types'
import { currentSessionYear } from './id'
import { saveApplications, savePrograms, saveSettings, saveStudents, loadSettings } from './repository'

const iso = (daysAgo: number, hour = 10): string => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, (daysAgo * 7) % 60, 0, 0)
  return date.toISOString()
}

function buildPrograms(): Program[] {
  const definitions = [
    {
      name: 'Bachelor of Laws (Five Years)',
      code: 'LLB-5Y',
      duration: '5 Years',
      admissionOpen: true,
      description:
        'The integrated five-year LL.B. programme covering constitutional, civil, criminal, corporate and international law, concluding with a year of moot court practice.',
    },
    {
      name: 'Bachelor of Laws (Three Years)',
      code: 'LLB-3Y',
      duration: '3 Years',
      admissionOpen: true,
      description:
        'A three-year LL.B. degree for graduates holding an intermediate or bachelor qualification, structured around the prescribed law core curriculum.',
    },
    {
      name: 'Master of Laws',
      code: 'LLM',
      duration: '2 Years',
      admissionOpen: true,
      description:
        'Specialised postgraduate degrees in constitutional, criminal, corporate, family and international law, awarded on the basis of coursework and dissertation.',
    },
    {
      name: 'Diploma in Legal Translation',
      code: 'DLT',
      duration: '6 Months',
      admissionOpen: false,
      description:
        'A short professional certificate in translating statutes, judgments and pleadings between Urdu and English.',
    },
  ]

  return definitions.map((definition, index) => ({
    id: `demo-program-${index + 1}`,
    admissionOpen: definition.admissionOpen,
    duration: definition.duration,
    name: definition.name,
    code: definition.code,
    description: definition.description,
    createdAt: iso(90 - index),
    updatedAt: iso(90 - index),
  }))
}

interface DemoApplicationSeed {
  fullName: string
  fatherName: string
  cnic: string
  gender: 'male' | 'female'
  phone: string
  email: string
  dob: string
  programIndex: number
  session: string
  status: Application['status']
  daysAgo: number
  qualification: string
  institution: string
  passingYear: string
  marks: string
  city: string
  district: string
  province: string
}

const APPLICANTS: DemoApplicationSeed[] = [
  {
    fullName: 'Fatima Zahra Siddiqui',
    fatherName: 'Muhammad Siddiqui',
    cnic: '35202-1847536-1',
    gender: 'female',
    phone: '03011234567',
    email: 'fatima.zahra@example.com',
    dob: '2005-04-12',
    programIndex: 0,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'approved',
    daysAgo: 62,
    qualification: 'Intermediate (HSSC / F.A.)',
    institution: 'Government College for Women, Lahore',
    passingYear: '2023',
    marks: '87.5',
    city: 'Lahore',
    district: 'Lahore',
    province: 'Punjab',
  },
  {
    fullName: 'Ahmed Raza Khan',
    fatherName: 'Tanveer Ahmed Khan',
    cnic: '37405-9920118-7',
    gender: 'male',
    phone: '03215567890',
    email: 'ahmed.raza@example.com',
    dob: '2004-11-30',
    programIndex: 0,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'pending',
    daysAgo: 3,
    qualification: 'Intermediate (HSSC / F.A.)',
    institution: 'Punjab College, Gulberg',
    passingYear: '2024',
    marks: '79.4',
    city: 'Lahore',
    district: 'Lahore',
    province: 'Punjab',
  },
  {
    fullName: 'Ayesha Noor',
    fatherName: 'Kashif Noor',
    cnic: '42201-3388942-3',
    gender: 'female',
    phone: '03331234567',
    email: 'ayesha.noor@example.com',
    dob: '1998-07-21',
    programIndex: 2,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'approved',
    daysAgo: 45,
    qualification: 'Bachelor (BA / BS / LL.B.)',
    institution: 'University of the Punjab, Law College',
    passingYear: '2024',
    marks: '71.2',
    city: 'Lahore',
    district: 'Lahore',
    province: 'Punjab',
  },
  {
    fullName: 'Bilal Ahmed',
    fatherName: 'Shahid Ahmed',
    cnic: '35204-6712345-2',
    gender: 'male',
    phone: '03451234567',
    email: 'bilal.ahmed@example.com',
    dob: '2006-01-19',
    programIndex: 1,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'pending',
    daysAgo: 9,
    qualification: 'Bachelor (BA / BS / LL.B.)',
    institution: 'Government College, Rawalpindi',
    passingYear: '2025',
    marks: '68.9',
    city: 'Rawalpindi',
    district: 'Rawalpindi',
    province: 'Punjab',
  },
  {
    fullName: 'Hina Aslam',
    fatherName: 'Aslam Pervaiz',
    cnic: '17301-5567890-4',
    gender: 'female',
    phone: '03111234567',
    email: 'hina.aslam@example.com',
    dob: '1999-09-05',
    programIndex: 2,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'rejected',
    daysAgo: 28,
    qualification: 'Master (MA / M.A.)',
    institution: 'University of Karachi',
    passingYear: '2024',
    marks: '64.0',
    city: 'Karachi',
    district: 'Karachi',
    province: 'Sindh',
  },
  {
    fullName: 'Usman Tariq',
    fatherName: 'Nadeem Tariq',
    cnic: '17301-4455667-8',
    gender: 'male',
    phone: '03009876543',
    email: 'usman.tariq@example.com',
    dob: '2005-03-28',
    programIndex: 0,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'pending',
    daysAgo: 1,
    qualification: 'Intermediate (HSSC / F.A.)',
    institution: 'Boys College No. 1, Karachi',
    passingYear: '2024',
    marks: '82.6',
    city: 'Karachi',
    district: 'Karachi',
    province: 'Sindh',
  },
  {
    fullName: 'Mariam Yousaf',
    fatherName: 'Yousaf Iqbal',
    cnic: '61101-9988776-5',
    gender: 'female',
    phone: '03228876543',
    email: 'mariam.yousaf@example.com',
    dob: '2004-12-02',
    programIndex: 1,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'approved',
    daysAgo: 80,
    qualification: 'Bachelor (BA / BS / LL.B.)',
    institution: 'Islamia College University, Peshawar',
    passingYear: '2024',
    marks: '74.8',
    city: 'Peshawar',
    district: 'Peshawar',
    province: 'Khyber Pakhtunkhwa',
  },
  {
    fullName: 'Zain Abbas',
    fatherName: 'Abbas Hussain',
    cnic: '42101-2233445-6',
    gender: 'male',
    phone: '03331234567',
    email: 'zain.abbas@example.com',
    dob: '2000-06-15',
    programIndex: 2,
    session: `${currentSessionYear()}-${Number(currentSessionYear()) + 1}`,
    status: 'pending',
    daysAgo: 17,
    qualification: 'Master (MA / M.A.)',
    institution: 'University of the Punjab, Law College',
    passingYear: '2025',
    marks: '77.1',
    city: 'Lahore',
    district: 'Lahore',
    province: 'Punjab',
  },
]

function buildApplications(programs: Program[]): Application[] {
  return APPLICANTS.map((seed, index) => {
    const createdAt = iso(seed.daysAgo, 9 + (index % 8))
    const program = programs[seed.programIndex]

    return {
      id: `demo-application-${index + 1}`,
      applicationNo: `LCM-${currentSessionYear()}-${String(index + 1).padStart(4, '0')}`,
      status: seed.status,
      createdAt,
      updatedAt: createdAt,
      personal: {
        fullName: seed.fullName,
        fatherName: seed.fatherName,
        cnic: seed.cnic,
        dateOfBirth: seed.dob,
        gender: seed.gender,
        phone: seed.phone,
        email: seed.email,
      },
      academic: {
        previousQualification: seed.qualification,
        institution: seed.institution,
        passingYear: seed.passingYear,
        marksPercentage: seed.marks,
      },
      program: {
        programId: program?.id ?? '',
        session: seed.session,
      },
      address: {
        currentAddress: `House ${10 + index}, Street ${3 + index}, ${seed.city}`,
        permanentAddress: `House ${10 + index}, Street ${3 + index}, ${seed.city}`,
        city: seed.city,
        district: seed.district,
        province: seed.province,
        postalCode: String(54000 + index * 137).slice(0, 5),
      },
      documents: {
        photograph: null,
        cnic: null,
        academicCertificate: null,
        marksSheet: null,
      },
    }
  })
}

function buildStudents(applications: Application[], programs: Program[]): Student[] {
  const approved = applications.filter((application) => application.status === 'approved')

  return approved.map((application, index) => {
    const program = programs.find(
      (item) => item.id === application.program.programId,
    )
    const status: Student['status'] = index === approved.length - 1 ? 'on-leave' : 'active'

    return {
      id: `demo-student-${index + 1}`,
      studentNo: `STU-${currentSessionYear()}-${String(index + 1).padStart(4, '0')}`,
      applicationId: application.id,
      name: application.personal.fullName,
      fatherName: application.personal.fatherName,
      phone: application.personal.phone,
      email: application.personal.email,
      cnic: application.personal.cnic,
      programId: program?.id ?? '',
      admissionDate: application.createdAt.slice(0, 10),
      status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    }
  })
}

export interface DemoDataResult {
  programs: Program[]
  applications: Application[]
  students: Student[]
  settings: ReturnType<typeof loadSettings>
}

export function buildDemoData(): DemoDataResult {
  const programs = buildPrograms()
  const applications = buildApplications(programs)
  const students = buildStudents(applications, programs)
  const settings = loadSettings()
  settings.college = {
    ...settings.college,
    name: 'Siraj-ud-Daulah Law College',
    shortName: 'SDL Law College',
    address: 'University Road, Shahrah-e-Faisal',
    city: 'Lahore',
    province: 'Punjab',
    phone: '+92 42 3577 1200',
    email: 'registrar@sirajuddulah.edu.pk',
    website: 'https://www.sirajuddulah.edu.pk',
    establishmentYear: '1974',
    registrarName: 'Prof. Nusrat Hussain, Ph.D.',
    latitude: '31.4686',
    longitude: '74.3842',
    about:
      'Siraj-ud-Daulah Law College was established in 1974 with the founding aim of producing graduates grounded in jurisprudence, statutory law and public service. The college offers a five-year integrated LL.B., a three-year LL.B. and a Master of Laws, alongside a moot court programme that places every student before a bench of practising judges and advocates each year.',
  }

  return { programs, applications, students, settings }
}

export function applyDemoData(): DemoDataResult {
  const result = buildDemoData()
  savePrograms(result.programs)
  saveApplications(result.applications)
  saveStudents(result.students)
  saveSettings(result.settings)
  return result
}