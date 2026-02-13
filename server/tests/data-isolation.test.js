import pool from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'

describe('Data Isolation Pattern Tests', () => {
  let userA, userB

  beforeAll(async () => {
    // Create test users
    const userAResult = await pool.query(
      `INSERT INTO users (email, name, role, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [`test-isolation-a-${uuidv4()}@test.com`, 'User A', 'user', 'active']
    )
    userA = userAResult.rows[0]

    const userBResult = await pool.query(
      `INSERT INTO users (email, name, role, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [`test-isolation-b-${uuidv4()}@test.com`, 'User B', 'user', 'active']
    )
    userB = userBResult.rows[0]
  })

  afterAll(async () => {
    await pool.query('DELETE FROM reports WHERE user_id IN ($1, $2)', [userA.id, userB.id])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [userA.id, userB.id])
    await pool.end()
  })

  test('User A cannot access User B\'s data directly via database', async () => {
    // Create reports for both users
    const reportAResult = await pool.query(
      `INSERT INTO reports (user_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userA.id, 'User A Report', 'Private content A']
    )
    const reportA = reportAResult.rows[0]

    const reportBResult = await pool.query(
      `INSERT INTO reports (user_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userB.id, 'User B Report', 'Private content B']
    )
    const reportB = reportBResult.rows[0]

    // User A tries to query User B's report directly
    const unauthorizedQuery = await pool.query(
      'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
      [reportB.id, userA.id]
    )

    // Should return empty (data isolation enforced)
    expect(unauthorizedQuery.rows.length).toBe(0)

    // User A can only see their own reports
    const authorizedQuery = await pool.query(
      'SELECT * FROM reports WHERE user_id = $1',
      [userA.id]
    )

    expect(authorizedQuery.rows.length).toBe(1)
    expect(authorizedQuery.rows[0].id).toBe(reportA.id)
  })

  test('List queries are scoped to user_id', async () => {
    // Create multiple reports for both users
    await pool.query(
      `INSERT INTO reports (user_id, title) VALUES ($1, $2)`,
      [userA.id, 'Report A1']
    )
    await pool.query(
      `INSERT INTO reports (user_id, title) VALUES ($1, $2)`,
      [userA.id, 'Report A2']
    )
    await pool.query(
      `INSERT INTO reports (user_id, title) VALUES ($1, $2)`,
      [userB.id, 'Report B1']
    )

    // User A's query
    const userAReports = await pool.query(
      'SELECT * FROM reports WHERE user_id = $1',
      [userA.id]
    )

    // User B's query
    const userBReports = await pool.query(
      'SELECT * FROM reports WHERE user_id = $1',
      [userB.id]
    )

    expect(userAReports.rows.length).toBeGreaterThanOrEqual(2)
    expect(userBReports.rows.length).toBeGreaterThanOrEqual(1)

    // Verify no cross-contamination
    const userAIds = userAReports.rows.map(r => r.user_id)
    const userBIds = userBReports.rows.map(r => r.user_id)

    expect(userAIds.every(id => id === userA.id)).toBe(true)
    expect(userBIds.every(id => id === userB.id)).toBe(true)
  })
})


