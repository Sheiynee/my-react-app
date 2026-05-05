import { describe, it, expect } from 'vitest'
import { canDo } from '../roles'

describe('canDo', () => {
  it('grants access when role exactly meets the minimum', () => {
    expect(canDo('viewer', 'viewer')).toBe(true)
    expect(canDo('member', 'member')).toBe(true)
    expect(canDo('manager', 'manager')).toBe(true)
    expect(canDo('admin', 'admin')).toBe(true)
  })

  it('grants access when role exceeds the minimum', () => {
    expect(canDo('admin', 'viewer')).toBe(true)
    expect(canDo('admin', 'member')).toBe(true)
    expect(canDo('admin', 'manager')).toBe(true)
    expect(canDo('manager', 'viewer')).toBe(true)
    expect(canDo('manager', 'member')).toBe(true)
    expect(canDo('member', 'viewer')).toBe(true)
  })

  it('denies access when role is below the minimum', () => {
    expect(canDo('viewer', 'member')).toBe(false)
    expect(canDo('viewer', 'manager')).toBe(false)
    expect(canDo('viewer', 'admin')).toBe(false)
    expect(canDo('member', 'manager')).toBe(false)
    expect(canDo('member', 'admin')).toBe(false)
    expect(canDo('manager', 'admin')).toBe(false)
  })

  it('denies access for null or undefined roles', () => {
    expect(canDo(null, 'viewer')).toBe(false)
    expect(canDo(undefined, 'viewer')).toBe(false)
    expect(canDo(null, 'admin')).toBe(false)
  })

  it('denies access for empty or unknown role strings', () => {
    expect(canDo('', 'viewer')).toBe(false)
    expect(canDo('superadmin', 'viewer')).toBe(false)
    expect(canDo('owner', 'member')).toBe(false)
  })

  it('denies access when minRole is unknown (acts as infinite threshold)', () => {
    expect(canDo('admin', 'superadmin')).toBe(false)
    expect(canDo('admin', 'owner')).toBe(false)
  })
})
