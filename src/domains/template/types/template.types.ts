// Shared types across all templates
export interface PageSetup {
  paperSize: 'a4' | 'a5' | 'letter'
  orientation: 'portrait' | 'landscape'
  margins: { top: number; right: number; bottom: number; left: number }
  fontFamily: 'serif' | 'sans-serif' | 'monospace'
  fontSize: number
}

export interface TemplateHeader {
  showLogo: boolean
  logoSize: number
  logoUrl: string | null
  showClinicName: boolean
  showClinicAddress: boolean
  showClinicContact: boolean
  customText: string
}

export interface TemplateFooter {
  showDoctorSignature: boolean
  showSpecialty: boolean
  showSubSpecialty: boolean
  showPrcLicense: boolean
  showPtrNumber: boolean
  showS2License: boolean
  showPageNumber: boolean
  showWatermark: boolean
  customText: string
}

const defaultPageSetup: PageSetup = {
  paperSize: 'a4',
  orientation: 'portrait',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  fontFamily: 'sans-serif',
  fontSize: 12,
}

const defaultHeader: TemplateHeader = {
  showLogo: true,
  logoSize: 40,
  logoUrl: null,
  showClinicName: true,
  showClinicAddress: true,
  showClinicContact: true,
  customText: '',
}

const defaultFooter: TemplateFooter = {
  showDoctorSignature: true,
  showSpecialty: true,
  showSubSpecialty: false,
  showPrcLicense: true,
  showPtrNumber: true,
  showS2License: false,
  showPageNumber: false,
  showWatermark: true,
  customText: '',
}

// Prescription
export interface PrescriptionTemplate extends PageSetup {
  header: TemplateHeader
  body: {
    showPatientName: boolean
    showPatientAge: boolean
    showPatientGender: boolean
    showDate: boolean
    showDoctorName: boolean
  }
  footer: TemplateFooter
}

export const defaultPrescriptionTemplate: PrescriptionTemplate = {
  ...defaultPageSetup,
  header: { ...defaultHeader },
  body: {
    showPatientName: true,
    showPatientAge: true,
    showPatientGender: true,
    showDate: true,
    showDoctorName: true,
  },
  footer: { ...defaultFooter },
}

// Medical Certificate
export interface MedCertTemplate extends PageSetup {
  header: TemplateHeader
  body: {
    showPatientName: boolean
    showPatientAge: boolean
    showPatientGender: boolean
    showPatientAddress: boolean
    showDateOfExamination: boolean
    showDiagnosis: boolean
    showRecommendation: boolean
    showDuration: boolean
    showPurpose: boolean
    showDisclaimer: boolean
  }
  footer: TemplateFooter
}

export const defaultMedCertTemplate: MedCertTemplate = {
  ...defaultPageSetup,
  header: { ...defaultHeader },
  body: {
    showPatientName: true,
    showPatientAge: true,
    showPatientGender: true,
    showPatientAddress: true,
    showDateOfExamination: true,
    showDiagnosis: true,
    showRecommendation: true,
    showDuration: true,
    showPurpose: true,
    showDisclaimer: true,
  },
  footer: { ...defaultFooter, showS2License: false, showPtrNumber: false },
}
