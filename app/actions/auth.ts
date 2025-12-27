// @ts-nocheck
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/**
 * Server Action: Sign Up
 * Creates a new user, tenant (if needed), and profile with tenant admin role
 */
export async function signUpAction(formData: {
  email: string
  password: string
  fullName: string
  organizationName: string
  inviteToken?: string
}) {
  const supabase = await createClient()

  try {
    // Check if user is joining via invite
    let tenantId: string | null = null
    let userRole: 'Tenant Admin' | 'Viewer' = 'Tenant Admin'

    if (formData.inviteToken) {
      // TODO: Implement invite token validation
      // For now, we'll look up the tenant from the invite token
      // This would typically involve checking an invites table
      const { data: inviteData } = await supabase
        .from('invites')
        .select('tenant_id, role')
        .eq('token', formData.inviteToken)
        .eq('email', formData.email)
        .single() as { data: { tenant_id: string; role: 'Tenant Admin' | 'Viewer' } | null }

      if (inviteData) {
        tenantId = inviteData.tenant_id
        userRole = inviteData.role || 'Viewer'
      }
    }

    // Step 1: Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          organization_name: formData.organizationName,
        },
      },
    })

    if (authError) {
      return { error: authError.message }
    }

    if (!authData.user) {
      return { error: 'Failed to create user account' }
    }

    // Step 2: If no tenant from invite, create a new tenant
    if (!tenantId) {
      const slug = formData.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: formData.organizationName,
          slug: `${slug}-${Date.now()}`, // Add timestamp to ensure uniqueness
          settings: {},
          is_active: true,
        } as any)
        .select()
        .single()

      if (tenantError) {
        console.error('Tenant creation error:', tenantError)
        return { error: 'Failed to create organization' }
      }

      if (!tenantData) {
        return { error: 'Failed to create organization' }
      }

      tenantId = (tenantData as any).id
      userRole = 'Tenant Admin' // First user is always admin
    }

    // Step 3: Create or update the profile (if trigger didn't handle it)
    // Use upsert to handle race condition with trigger
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: authData.user.id,
        tenant_id: tenantId,
        role: userRole,
        full_name: formData.fullName,
        is_active: true,
      },
      {
        onConflict: 'id',
      }
    )

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return { error: 'Failed to create user profile' }
    }

    // Step 4: Sign in the user immediately
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (signInError) {
      return { error: signInError.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Signup error:', error)
    return { error: 'An unexpected error occurred during signup' }
  }
}

/**
 * Server Action: Sign In
 * Authenticates user and sets session cookie
 */
export async function signInAction(formData: {
  email: string
  password: string
}) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (error) {
      return { error: error.message }
    }

    if (!data.user) {
      return { error: 'Authentication failed' }
    }

    // Verify user has a profile and tenant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role, is_active')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      return { error: 'User profile not found. Please contact support.' }
    }

    if (!profile.is_active) {
      await supabase.auth.signOut()
      return { error: 'Your account has been deactivated. Please contact your administrator.' }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Signin error:', error)
    return { error: 'An unexpected error occurred during signin' }
  }
}

/**
 * Server Action: Sign Out
 * Clears session and redirects to login
 */
export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Server Action: Reset Password Request
 * Sends password reset email
 */
export async function resetPasswordAction(formData: { email: string }) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      formData.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      }
    )

    if (error) {
      return { error: error.message }
    }

    return { success: true, message: 'Password reset email sent' }
  } catch (error) {
    console.error('Reset password error:', error)
    return { error: 'Failed to send reset email' }
  }
}

/**
 * Server Action: Update Password
 * Updates user password after reset
 */
export async function updatePasswordAction(formData: { password: string }) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.updateUser({
      password: formData.password,
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Update password error:', error)
    return { error: 'Failed to update password' }
  }
}
