import { db } from '../db'
import { encounterApi } from '@/domains/encounter/api/encounterApi'
import type {
  EncounterResponse,
  UpdateEncounterPayload,
} from '@/domains/encounter/types/encounter.types'
import { syncEngine } from './SyncEngine'
import type { ConflictPolicy, Repository } from './types'

/**
 * Reference repository implementation — ports the iOS `EncounterRepository`
 * pattern to the web. Keeps the local Dexie cache, the `/api/encounters/*`
 * calls, and the pending-action queue cohesive behind a single API.
 *
 * Not yet wired into the Pinia encounter store (Phase 2b); this file
 * establishes the contract + demonstrates the read-through + write-through
 * flow so subsequent repositories (Patient, Queue, Appointment) follow the
 * same shape.
 *
 * Conflict policy: last-write-wins on `updated_at`. When the caller saves
 * stale data (server has a newer version), the server copy is written
 * back to the cache and a 'conflict-detected' event fires. UI can listen
 * to present a reload-or-override prompt; until that UI exists, we always
 * defer to the server.
 */

type EncounterLike = EncounterResponse & { id: string }

const DEFAULT_CONFLICT: ConflictPolicy<EncounterLike> = {
  detect: (local, remote) =>
    typeof local.updated_at === 'string' &&
    typeof remote.updated_at === 'string' &&
    remote.updated_at > local.updated_at,
  resolve: (_local, remote) => remote,
}

class EncounterRepositoryImpl implements Repository<EncounterLike> {
  private readonly conflict: ConflictPolicy<EncounterLike>

  constructor(conflict: ConflictPolicy<EncounterLike> = DEFAULT_CONFLICT) {
    this.conflict = conflict
  }

  async get(id: string, opts?: { skipCache?: boolean }): Promise<EncounterLike | undefined> {
    if (!opts?.skipCache) {
      const cached = await db.encounters.get(id)
      if (cached) {
        // Kick off background revalidation but don't block the UI on it.
        void this.revalidate(id)
        return cached as unknown as EncounterLike
      }
    }

    if (!navigator.onLine) return undefined

    try {
      const response = await encounterApi.get(id)
      const entity = response.data as EncounterLike
      await db.encounters.put(this.toStorage(entity))
      return entity
    } catch {
      return undefined
    }
  }

  async save(data: Partial<EncounterLike> & { id: string }): Promise<EncounterLike> {
    // Optimistic local write so the UI reflects the change immediately,
    // online or off. Merges with whatever is cached to preserve fields the
    // caller didn't touch.
    const existing = ((await db.encounters.get(data.id)) ?? {}) as Record<string, unknown>
    const merged = {
      ...existing,
      ...this.toStorage(data as EncounterLike),
    } as Record<string, unknown> & { id: string }
    await db.encounters.put(merged)

    if (!navigator.onLine) {
      await db.pendingActions.add({
        type: 'update-encounter',
        url: `/encounters/${data.id}`,
        method: 'PATCH',
        body: this.toPayload(data),
        createdAt: Date.now(),
      })
      return merged as unknown as EncounterLike
    }

    try {
      const response = await encounterApi.update(data.id, this.toPayload(data))
      const fresh = response.data as EncounterLike
      await db.encounters.put(this.toStorage(fresh))
      return fresh
    } catch {
      // Network dropped mid-save — queue the mutation and keep the local
      // optimistic state. SyncEngine will flush it when online again.
      await db.pendingActions.add({
        type: 'update-encounter',
        url: `/encounters/${data.id}`,
        method: 'PATCH',
        body: this.toPayload(data),
        createdAt: Date.now(),
      })
      void syncEngine.flush()
      return merged as unknown as EncounterLike
    }
  }

  private async revalidate(id: string): Promise<void> {
    if (!navigator.onLine) return
    try {
      const response = await encounterApi.get(id)
      const remote = response.data as EncounterLike
      const local = (await db.encounters.get(id)) as unknown as EncounterLike | undefined
      if (local && this.conflict.detect(local, remote)) {
        const resolved = this.conflict.resolve(local, remote)
        await db.encounters.put(this.toStorage(resolved))
      } else {
        await db.encounters.put(this.toStorage(remote))
      }
    } catch {
      // Revalidation is best-effort; leave the cached entity alone on failure.
    }
  }

  private toStorage(entity: EncounterLike): Record<string, unknown> & { id: string } {
    // JSON round-trip keeps Dexie from choking on Vue reactivity proxies.
    return JSON.parse(JSON.stringify(entity)) as Record<string, unknown> & { id: string }
  }

  private toPayload(data: Partial<EncounterLike>): UpdateEncounterPayload {
    // Strip fields the update endpoint doesn't accept. Intentionally
    // narrow — keeps the wire contract honest. Refine per consumer.
    const { id: _id, updated_at: _u, created_at: _c, ...rest } = data
    return rest as UpdateEncounterPayload
  }
}

export const encounterRepository = new EncounterRepositoryImpl()
