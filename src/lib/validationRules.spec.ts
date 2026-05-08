/**
 * Tests for `validationRules.ts`.
 *
 * These rules underpin every login, signup, patient-create, change-password
 * and onboarding form in the app. A regression in any one factory shows up
 * either as a form that submits garbage, or a form that won't submit at all.
 * Both modes silently pass type-checks. Co-located unit tests are the line
 * of defence.
 *
 * Conventions:
 *   - Each factory: at least one passing case + at least one failing case.
 *   - The "empty value passes" semantic of optional rules (email, minLength,
 *     phoneNumberPH, oneOf, maxLength, numeric) is explicit so a future
 *     refactor that changes it must also change the test.
 */

import { describe, expect, it } from 'vitest'
import {
  required,
  email,
  minLength,
  maxLength,
  numeric,
  phoneNumberPH,
  oneOf,
  loginSchema,
  signupSchema,
  createSignupSchema,
  createClinicSchema,
  createPatientSchema,
  changePasswordSchema,
  createChangePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createResetPasswordSchema,
  toVeeSchema,
  validateRuleSchema,
} from './validationRules'

describe('required', () => {
  const rule = required('Email')

  it('rejects null', () => {
    expect(rule(null)).toBe('Email is required.')
  })

  it('rejects undefined', () => {
    expect(rule(undefined)).toBe('Email is required.')
  })

  it('rejects empty string', () => {
    expect(rule('')).toBe('Email is required.')
  })

  it('rejects whitespace-only string', () => {
    expect(rule('   ')).toBe('Email is required.')
  })

  it('accepts a non-empty string', () => {
    expect(rule('hello')).toBe(true)
  })

  it('accepts a number (truthy non-string)', () => {
    expect(rule(0)).toBe(true)
  })
})

describe('email', () => {
  const rule = email('Email')

  it('passes a well-formed address', () => {
    expect(rule('user@example.com')).toBe(true)
  })

  it('passes a plus-tagged address', () => {
    expect(rule('user+tag@example.co.uk')).toBe(true)
  })

  it('rejects a missing @', () => {
    expect(rule('not-an-email')).toBe('Email must be a valid email address.')
  })

  it('rejects a missing TLD', () => {
    expect(rule('user@example')).toBe('Email must be a valid email address.')
  })

  it('rejects whitespace inside the value', () => {
    expect(rule('user @example.com')).toBe('Email must be a valid email address.')
  })

  it('passes an empty value (defers to `required`)', () => {
    expect(rule('')).toBe(true)
    expect(rule(null)).toBe(true)
    expect(rule(undefined)).toBe(true)
  })
})

describe('minLength', () => {
  const rule = minLength('Password', 10)

  it('rejects strings shorter than the minimum', () => {
    expect(rule('short')).toBe('Password must be at least 10 characters.')
  })

  it('accepts strings exactly at the minimum', () => {
    expect(rule('1234567890')).toBe(true)
  })

  it('accepts strings longer than the minimum', () => {
    expect(rule('12345678901')).toBe(true)
  })

  it('passes empty values (defers to required)', () => {
    expect(rule('')).toBe(true)
    expect(rule(null)).toBe(true)
  })
})

describe('maxLength', () => {
  const rule = maxLength('First name', 5)

  it('rejects values over the cap', () => {
    expect(rule('toolongname')).toBe('First name must be no more than 5 characters.')
  })

  it('accepts values exactly at the cap', () => {
    expect(rule('hello')).toBe(true)
  })

  it('passes empty values', () => {
    expect(rule('')).toBe(true)
    expect(rule(undefined)).toBe(true)
  })
})

describe('numeric', () => {
  const rule = numeric('Age')

  it('accepts an integer-shaped string', () => {
    expect(rule('42')).toBe(true)
  })

  it('accepts a decimal string', () => {
    expect(rule('3.14')).toBe(true)
  })

  it('accepts a literal number', () => {
    expect(rule(7)).toBe(true)
  })

  it('rejects an alpha string', () => {
    expect(rule('abc')).toBe('Age must be a valid number.')
  })

  it('passes empty string / null / undefined (optional)', () => {
    expect(rule('')).toBe(true)
    expect(rule(null)).toBe(true)
    expect(rule(undefined)).toBe(true)
  })
})

describe('phoneNumberPH', () => {
  const rule = phoneNumberPH('Contact number')

  it('accepts the 09XXXXXXXXX shape', () => {
    expect(rule('09171234567')).toBe(true)
  })

  it('accepts the +639XXXXXXXXX shape', () => {
    expect(rule('+639171234567')).toBe(true)
  })

  it('rejects a number that is too short', () => {
    expect(rule('0917123')).toBe('Contact number must be a valid Philippine mobile number.')
  })

  it('rejects a US-formatted number', () => {
    expect(rule('+12345678901')).toBe('Contact number must be a valid Philippine mobile number.')
  })

  it('rejects a number with letters', () => {
    expect(rule('0917-ABC-1234')).toBe('Contact number must be a valid Philippine mobile number.')
  })

  it('passes empty / whitespace (optional field)', () => {
    expect(rule('')).toBe(true)
    expect(rule('   ')).toBe(true)
    expect(rule(null)).toBe(true)
  })
})

describe('oneOf', () => {
  const rule = oneOf('Sex', ['male', 'female'])

  it('accepts a value in the list', () => {
    expect(rule('male')).toBe(true)
  })

  it('rejects a value outside the list', () => {
    expect(rule('other')).toBe('Sex must be one of: male, female.')
  })

  it('passes empty value (defers to required)', () => {
    expect(rule('')).toBe(true)
    expect(rule(null)).toBe(true)
  })
})

describe('schema adapters', () => {
  const schema = {
    name: [required('Name'), minLength('Name', 3)],
    email: email('Email'),
  }

  it('toVeeSchema returns single field validators that stop on the first error', () => {
    const veeSchema = toVeeSchema(schema)

    expect(veeSchema.name('')).toBe('Name is required.')
    expect(veeSchema.name('Al')).toBe('Name must be at least 3 characters.')
    expect(veeSchema.name('Alice')).toBe(true)
    expect(veeSchema.email('not-email')).toBe('Email must be a valid email address.')
  })

  it('validateRuleSchema returns only fields with validation errors', () => {
    expect(validateRuleSchema(schema, { name: 'Al', email: 'valid@example.com' })).toEqual({
      name: 'Name must be at least 3 characters.',
    })
    expect(validateRuleSchema(schema, { name: 'Alice', email: 'valid@example.com' })).toEqual({})
  })
})

describe('composed schemas', () => {
  it('loginSchema enforces required email, email format, and password', () => {
    const emailRules = loginSchema.email

    expect(emailRules[0]('')).toBe('Email is required.')
    expect(emailRules[1]('not-email')).toBe('Email must be a valid email address.')
    expect(emailRules[1]('user@example.com')).toBe(true)
    expect(loginSchema.password('')).toBe('Password is required.')
    expect(loginSchema.password('hunter2')).toBe(true)
  })

  it('signupSchema requires email, validates format, and enforces a 10-char password', () => {
    // Default signup schema has minPwLen=10
    const passwordRules = signupSchema.password
    const requiredRule = passwordRules[0]!
    const minRule = passwordRules[1]!

    expect(requiredRule('')).toBe('Password is required.')
    expect(minRule('short')).toBe('Password must be at least 10 characters.')
    expect(minRule('correct-horse-battery-staple')).toBe(true)

    const emailRules = signupSchema.email
    expect(emailRules[0]('')).toBe('Email is required.')
    expect(emailRules[1]('not-email')).toBe('Email must be a valid email address.')
    expect(emailRules[1]('a@b.co')).toBe(true)
  })

  it('createSignupSchema accepts a custom min password length', () => {
    const schema = createSignupSchema(6)
    const minRule = schema.password[1]!
    expect(minRule('12345')).toBe('Password must be at least 6 characters.')
    expect(minRule('123456')).toBe(true)
  })

  it('createClinicSchema requires clinic_name, caps optional rx_header', () => {
    const reqName = createClinicSchema.clinic_name[0]!; const maxName = createClinicSchema.clinic_name[1]!
    expect(reqName('')).toBe('Clinic name is required.')
    expect(maxName('a'.repeat(256))).toBe('Clinic name must be no more than 255 characters.')
    expect(maxName('Acme Clinic')).toBe(true)

    const maxHeader = createClinicSchema.rx_header[0]!
    expect(maxHeader('a'.repeat(1001))).toBe('Prescription header must be no more than 1000 characters.')
    expect(maxHeader('Header')).toBe(true)
  })

  it('createPatientSchema enforces sex options and validates contact_number/email', () => {
    const [reqDob] = createPatientSchema.date_of_birth
    expect(reqDob('')).toBe('Date of birth is required.')
    expect(reqDob('2020-01-01')).toBe(true)

    const oneOfSex = createPatientSchema.sex[1]!
    expect(oneOfSex('other')).toBe('Sex must be one of: male, female.')
    expect(oneOfSex('male')).toBe(true)

    const [phoneRule] = createPatientSchema.contact_number
    expect(phoneRule('+639171234567')).toBe(true)
    expect(phoneRule('1234')).toBe('Contact number must be a valid Philippine mobile number.')

    const [emailRule] = createPatientSchema.email
    expect(emailRule('user@x.com')).toBe(true)
    expect(emailRule('not-email')).toBe('Email must be a valid email address.')
  })

  it('changePasswordSchema requires current + new + confirmation', () => {
    expect(changePasswordSchema.current_password[0]!('')).toBe('Current password is required.')
    const minNew = changePasswordSchema.new_password[1]!
    expect(minNew('short')).toBe('New password must be at least 10 characters.')
    expect(changePasswordSchema.new_password_confirmation[0]!('')).toBe('Password confirmation is required.')
  })

  it('createChangePasswordSchema honors a custom min length', () => {
    const schema = createChangePasswordSchema(8)
    const minRule = schema.new_password[1]!
    expect(minRule('1234567')).toBe('New password must be at least 8 characters.')
    expect(minRule('12345678')).toBe(true)
  })

  it('forgotPasswordSchema validates email shape', () => {
    expect(forgotPasswordSchema.email[0]!('')).toBe('Email is required.')
    expect(forgotPasswordSchema.email[1]!('not-email')).toBe('Email must be a valid email address.')
    expect(forgotPasswordSchema.email[1]!('user@x.com')).toBe(true)
  })

  it('resetPasswordSchema enforces password rules', () => {
    expect(resetPasswordSchema.password[0]!('')).toBe('New password is required.')
    expect(resetPasswordSchema.password[1]!('short')).toBe('New password must be at least 10 characters.')
    expect(resetPasswordSchema.password_confirmation[0]!('')).toBe('Confirm password is required.')
  })

  it('createResetPasswordSchema honors a custom min length', () => {
    const schema = createResetPasswordSchema(6)
    expect(schema.password[1]!('12345')).toBe('New password must be at least 6 characters.')
    expect(schema.password[1]!('123456')).toBe(true)
  })
})
