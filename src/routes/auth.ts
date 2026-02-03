/**
 * Auth Routes - Session-basiertes User Handling mit Gigya CDC
 * 
 * Endpoints:
 * - GET  /auth/session - Session-Status abrufen
 * - POST /auth/login   - Login mit Gigya loginToken
 * - POST /auth/logout  - Logout und Session löschen
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import axios from 'axios'

const GIGYA_API_KEY = '4_XQnjjmLc16oS7vqA6DvIAg'
const GIGYA_API_SECRET = process.env.GIGYA_API_SECRET || ''
const GIGYA_API_BASE = 'https://accounts.eu1.gigya.com'

/**
 * Permission Groups berechnen basierend auf User-Daten
 * 
 * @param user - Gigya User Objekt aus Session
 * @returns Array von Permission Group Namen
 */
function calculatePermissionGroups(user: any): string[] {
  const groups: string[] = []
  
  // Base: Alle eingeloggten User
  if (user.UID) {
    groups.push('authenticated')
  }
  
  // Customer Group aus Commerce Cloud oder Gigya Data
  const customerGroup = user.data?.customerGroup?.toLowerCase()
  if (customerGroup) {
    groups.push('customer')
    groups.push(customerGroup) // z.B. 'b2b', 'b2c', 'premium'
  }
  
  // Custom Permissions aus Gigya Data
  if (user.data?.permissions && Array.isArray(user.data.permissions)) {
    groups.push(...user.data.permissions)
  }
  
  // Email Domain Check (Lenzing Mitarbeiter)
  if (user.email && user.email.endsWith('@lenzing.com')) {
    groups.push('internal')
  }
  
  // Verified Account
  if (user.profile?.verified || user.isVerified) {
    groups.push('verified')
  }
  
  return [...new Set(groups)] // Duplikate entfernen
}

interface LoginRequest {
  loginToken: string
}

export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * GET /auth/session
   * 
   * Session-Status abrufen
   * Prüft ob User eingeloggt ist und gibt Profil + Permission Groups zurück
   */
  fastify.get('/auth/session', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = request.session as any
      
      if (!session || !session.user || !session.user.UID) {
        return reply.send({
          isLoggedIn: false,
          user: null,
          permissionGroups: [],
          customerGroup: null,
          error: null
        })
      }

      // Permission Groups berechnen
      const permissionGroups = calculatePermissionGroups(session.user)
      
      // Customer Group aus Commerce Cloud (falls vorhanden)
      const customerGroup = session.user.data?.customerGroup || null

      // Session ist aktiv
      return reply.send({
        isLoggedIn: true,
        user: {
          uid: session.user.UID,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName
        },
        permissionGroups,
        customerGroup,
        error: null
      })
    } catch (error: any) {
      fastify.log.error('Session check error:', error)
      return reply.status(500).send({
        isLoggedIn: false,
        user: null,
        permissionGroups: [],
        customerGroup: null,
        error: 'Session-Check fehlgeschlagen'
      })
    }
  })

  /**
   * POST /auth/login
   * 
   * Login mit Gigya loginToken
   * Validiert Token bei Gigya und erstellt Session
   */
  fastify.post<{ Body: LoginRequest }>('/auth/login', async (request, reply) => {
    try {
      const { loginToken } = request.body

      if (!loginToken) {
        return reply.status(400).send({
          success: false,
          message: 'loginToken fehlt'
        })
      }

      // Gigya: accounts.getAccountInfo mit loginToken
      const gigyaResponse = await axios.post(
        `${GIGYA_API_BASE}/accounts.getAccountInfo`,
        new URLSearchParams({
          apiKey: GIGYA_API_KEY,
          secret: GIGYA_API_SECRET,
          loginToken: loginToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      const gigyaData = gigyaResponse.data

      if (gigyaData.errorCode !== 0) {
        fastify.log.error('Gigya getAccountInfo error:', gigyaData)
        return reply.status(401).send({
          success: false,
          message: gigyaData.errorMessage || 'Gigya-Authentifizierung fehlgeschlagen'
        })
      }

      // Session erstellen
      const session = request.session as any
      session.user = {
        UID: gigyaData.UID,
        email: gigyaData.profile?.email,
        firstName: gigyaData.profile?.firstName,
        lastName: gigyaData.profile?.lastName,
        profile: gigyaData.profile,
        data: gigyaData.data
      }

      await session.save()

      fastify.log.info('User logged in:', session.user.UID)

      return reply.send({
        success: true,
        message: 'Login erfolgreich',
        user: session.user
      })
    } catch (error: any) {
      fastify.log.error('Login error:', error)
      return reply.status(500).send({
        success: false,
        message: error.message || 'Login fehlgeschlagen'
      })
    }
  })

  /**
   * POST /auth/logout
   * 
   * Logout und Session löschen
   */
  fastify.post('/auth/logout', async (request, reply) => {
    try {
      const session = request.session as any
      
      if (session) {
        await session.destroy()
      }

      return reply.send({
        success: true,
        message: 'Logout erfolgreich'
      })
    } catch (error: any) {
      fastify.log.error('Logout error:', error)
      return reply.status(500).send({
        success: false,
        message: error.message || 'Logout fehlgeschlagen'
      })
    }
  })
}
