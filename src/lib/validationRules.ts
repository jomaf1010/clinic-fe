/**
 * Reusable vee-validate rule functions.
 *
 * Each rule is a plain function that accepts the field value and returns
 * `true` when valid or an error string when invalid. These can be composed
 * into a `validationSchema` object passed directly to `useForm`, with no
 * third-party schema adapter (no yup / zod) required.
 *
 * Usage in a component:
 *
 *   import { useForm } from 'vee-validate'
 *   import { loginSchema } from '@/lib/validationRules'
 *
 *   const { handleSubmit, setFieldError } = useForm({ validationSchema: loginSchema })
 */

// ---------------------------------------------------------------------------
// Primitive rule factories
// ---------------------------------------------------------------------------

/**
 * Returns a rule that fails when the value is empty.
 * @param label - Human-readable field label used in the error message.
 */
export function required(label: string) {
  return (value: unknown): true | string => {
    if (value === null || value === undefined) return `${label} is required.`
    if (typeof value === 'string' && value.trim() === '') return `${label} is required.`
    return true
  }
}

/**
 * Returns a rule that fails when the value is not a well-formed e-mail address.
 * Intended to be combined with `required`; an empty value passes this rule so
 * that the "required" message takes precedence.
 * @param label - Human-readable field label used in the error message.
 */
export function email(label: string) {
  return (value: unknown): true | string => {
    if (!value || typeof value !== 'string') return true
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(value) || `${label} must be a valid email address.`
  }
}

/**
 * Returns a rule that fails when the value is shorter than `min` characters.
 * @param label - Human-readable field label used in the error message.
 * @param min   - Minimum character count (inclusive).
 */
export function minLength(label: string, min: number) {
  return (value: unknown): true | string => {
    if (!value || typeof value !== 'string') return true
    return value.length >= min || `${label} must be at least ${min} characters.`
  }
}

/**
 * Returns a rule that fails when the value exceeds `max` characters.
 * @param label - Human-readable field label used in the error message.
 * @param max   - Maximum character count (inclusive).
 */
export function maxLength(label: string, max: number) {
  return (value: unknown): true | string => {
    if (!value || typeof value !== 'string') return true
    return value.length <= max || `${label} must be no more than ${max} characters.`
  }
}

type ValidationRule = (value: unknown) => true | string
type RuleSchema = Record<string, ValidationRule | ValidationRule[]>

/**
 * Converts the project's rule-array schema shape into the single-validator
 * function shape expected by vee-validate's object validationSchema.
 */
export function toVeeSchema<T extends RuleSchema>(schema: T): Record<keyof T, ValidationRule> {
  return Object.fromEntries(
    Object.entries(schema).map(([field, rules]) => [
      field,
      (value: unknown) => {
        for (const rule of Array.isArray(rules) ? rules : [rules]) {
          const result = rule(value)
          if (result !== true) return result
        }
        return true
      },
    ]),
  ) as Record<keyof T, ValidationRule>
}

export function validateRuleSchema<T extends RuleSchema>(
  schema: T,
  values: Record<keyof T, unknown>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {}
  for (const [field, rules] of Object.entries(schema) as [keyof T, ValidationRule | ValidationRule[]][]) {
    for (const rule of Array.isArray(rules) ? rules : [rules]) {
      const result = rule(values[field])
      if (result !== true) {
        errors[field] = result
        break
      }
    }
  }
  return errors
}

/**
 * Returns a rule that fails when the value is not a valid number.
 * @param label - Human-readable field label used in the error message.
 */
export function numeric(label: string) {
  return (value: unknown): true | string => {
    if (value === null || value === undefined || value === '') return true
    return !isNaN(Number(value)) || `${label} must be a valid number.`
  }
}

/**
 * Returns a rule that fails when the value is not a valid PH mobile number.
 * Accepts `09XXXXXXXXX` or `+639XXXXXXXXX`. Empty values pass (field is optional).
 * @param label - Human-readable field label used in the error message.
 */
export function phoneNumberPH(label: string) {
  return (value: unknown): true | string => {
    if (!value || typeof value !== 'string' || value.trim() === '') return true
    const pattern = /^(09|\+639)\d{9}$/
    return pattern.test(value) || `${label} must be a valid Philippine mobile number.`
  }
}

/**
 * Returns a rule that fails when the value is not in the allowed list.
 * @param label   - Human-readable field label used in the error message.
 * @param options - Allowed values.
 */
export function oneOf(label: string, options: string[]) {
  return (value: unknown): true | string => {
    if (!value || typeof value !== 'string') return true
    return options.includes(value) || `${label} must be one of: ${options.join(', ')}.`
  }
}

// ---------------------------------------------------------------------------
// Composed schemas
// ---------------------------------------------------------------------------

/**
 * Validation schema for the login form.
 * Pass directly to `useForm({ validationSchema: loginSchema })`.
 */
export const loginSchema = {
  email: [required('Email'), email('Email')],
  password: required('Password'),
}

/**
 * Validation schema for the signup form.
 * Pass directly to `useForm({ validationSchema: signupSchema })`.
 */
export function createSignupSchema(minPwLen = 10) {
  return {
    email: [required('Email'), email('Email')],
    password: [required('Password'), minLength('Password', minPwLen)],
    first_name: [maxLength('First name', 255)],
    last_name: [maxLength('Last name', 255)],
  }
}
export const signupSchema = createSignupSchema()

/**
 * Validation schema for the clinic creation (onboarding) form.
 * Pass directly to `useForm({ validationSchema: createClinicSchema })`.
 */
export const createClinicSchema = {
  clinic_name: [required('Clinic name'), maxLength('Clinic name', 255)],
  rx_header: [maxLength('Prescription header', 1000)],
  rx_footer: [maxLength('Prescription footer', 1000)],
}

/**
 * Validation schema for the create patient form.
 * Pass directly to `useForm({ validationSchema: createPatientSchema })`.
 */
export const createPatientSchema = {
  date_of_birth: [required('Date of birth')],
  sex: [required('Sex'), oneOf('Sex', ['male', 'female'])],
  contact_number: [phoneNumberPH('Contact number')],
  email: [email('Email'), maxLength('Email', 255)],
  note: [maxLength('Note', 2000)],
}

/**
 * Validation schema for the edit patient form.
 * Same rules as create — all required fields stay required on edit.
 */
export const editPatientSchema = createPatientSchema

/**
 * Validation schema for the account personal information form.
 */
export const updateProfileSchema = {
  contact_number: [phoneNumberPH('Contact number')],
  date_of_birth: [],
}

/**
 * Validation schema for the professional credentials form (doctors).
 */
export const credentialsSchema = {
  prc_license_number: [maxLength('PRC license number', 50)],
  ptr_number: [maxLength('PTR number', 50)],
  s2_license_number: [maxLength('S2 license number', 50)],
  specialty: [maxLength('Specialty', 255)],
  sub_specialty: [maxLength('Sub-specialty', 255)],
}

/**
 * Validation schema for the change password form.
 * Pass directly to `useForm({ validationSchema: changePasswordSchema })`.
 */
export function createChangePasswordSchema(minPwLen = 10) {
  return {
    current_password: [required('Current password')],
    new_password: [required('New password'), minLength('New password', minPwLen)],
    new_password_confirmation: [required('Password confirmation')],
  }
}
export const changePasswordSchema = createChangePasswordSchema()

/**
 * Validation schema for the forgot password form.
 * Pass directly to `useForm({ validationSchema: forgotPasswordSchema })`.
 */
export const forgotPasswordSchema = {
  email: [required('Email'), email('Email')],
}

/**
 * Validation schema for the reset password form.
 * Pass directly to `useForm({ validationSchema: resetPasswordSchema })`.
 */
export function createResetPasswordSchema(minPwLen = 10) {
  return {
    password: [required('New password'), minLength('New password', minPwLen)],
    password_confirmation: [required('Confirm password')],
  }
}
export const resetPasswordSchema = createResetPasswordSchema()
