import { prisma } from '../lib/prisma'
import { revalidatePath } from 'next/cache'
import { Suspense } from 'react'

// --- SERVER ACTIONS ---

async function addUser(formData: FormData) {
  'use server'
  const name = formData.get('name') as string
  if (name) await prisma.user.create({ data: { name } })
  revalidatePath('/')
}

async function addChore(formData: FormData) {
  'use server'
  const title = formData.get('title') as string
  const effort_score = Number(formData.get('effort_score'))
  if (title && effort_score) await prisma.chore.create({ data: { title, effort_score } })
  revalidatePath('/')
}

async function deleteChore(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  // Must delete assignments first to prevent database relation errors
  await prisma.choreAssignment.deleteMany({ where: { choreId: id } })
  await prisma.chore.delete({ where: { id } })
  revalidatePath('/')
}

async function toggleChore(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const isCompleted = formData.get('isCompleted') === 'true'
  await prisma.choreAssignment.update({ where: { id }, data: { isCompleted: !isCompleted } })
  revalidatePath('/')
}

async function autoAssignChores() {
  'use server'
  // 1. Fetch users and their current workloads
  const users = await prisma.user.findMany({
    include: { assignments: { include: { chore: true } } }
  })
  if (users.length === 0) return

  // 2. Fetch chores that haven't been assigned yet
  const assignments = await prisma.choreAssignment.findMany()
  const assignedChoreIds = assignments.map(a => a.choreId)
  const unassignedChores = await prisma.chore.findMany({
    where: { id: { notIn: assignedChoreIds } },
    orderBy: { effort_score: 'desc' } // Sort by heaviest chores first
  })

  // 3. Track running effort per user
  const userEfforts = users.map(user => {
    const currentEffort = user.assignments
        .filter(a => !a.isCompleted)
        .reduce((sum, a) => sum + a.chore.effort_score, 0)
    return { userId: user.id, effort: currentEffort }
  })

  // 4. The Algorithm: Greedily assign chores to the user with the lowest current effort
  for (const chore of unassignedChores) {
    userEfforts.sort((a, b) => a.effort - b.effort)
    const targetUser = userEfforts[0]

    await prisma.choreAssignment.create({
      data: { choreId: chore.id, userId: targetUser.userId }
    })
    targetUser.effort += chore.effort_score // Update their effort so the next chore goes to someone else
  }
  revalidatePath('/')
}

// --- UI COMPONENTS ---

async function DashboardData() {
  const users = await prisma.user.findMany({
    include: { assignments: { include: { chore: true } } }
  })
  const chores = await prisma.chore.findMany()

  return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Roommates & Assignments Section */}
        <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Roommates & Workloads</h2>
          <ul className="mb-6 space-y-4">
            {users.map(user => {
              const activeChores = user.assignments.filter(a => !a.isCompleted)
              const completedChores = user.assignments.filter(a => a.isCompleted)
              const currentEffort = activeChores.reduce((sum, a) => sum + a.chore.effort_score, 0)

              return (
                  <li key={user.id} className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-lg text-blue-300">{user.name}</span>
                      <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full">
                    Active Effort: {currentEffort}
                  </span>
                    </div>

                    {/* Active Assigned Chores */}
                    <div className="space-y-2">
                      {activeChores.map(assignment => (
                          <div key={assignment.id} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                            <span className="text-sm">{assignment.chore.title} ({assignment.chore.effort_score})</span>
                            <form action={toggleChore}>
                              <input type="hidden" name="id" value={assignment.id} />
                              <input type="hidden" name="isCompleted" value="false" />
                              <button className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded">Done</button>
                            </form>
                          </div>
                      ))}
                      {completedChores.map(assignment => (
                          <div key={assignment.id} className="flex justify-between items-center bg-gray-800 p-2 rounded opacity-50">
                            <span className="text-sm line-through">{assignment.chore.title}</span>
                            <form action={toggleChore}>
                              <input type="hidden" name="id" value={assignment.id} />
                              <input type="hidden" name="isCompleted" value="true" />
                              <button className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded">Undo</button>
                            </form>
                          </div>
                      ))}
                      {user.assignments.length === 0 && <span className="text-xs text-gray-500">No chores assigned.</span>}
                    </div>
                  </li>
              )
            })}
          </ul>
          <form action={addUser} className="flex gap-2">
            <input type="text" name="name" placeholder="Add Roommate" required className="border border-gray-600 bg-gray-900 p-2 rounded flex-1 text-white" />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded transition">Add</button>
          </form>
        </section>

        {/* Chores Master List Section */}
        <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Master List</h2>
            <form action={autoAssignChores}>
              <button className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 text-sm rounded shadow transition font-semibold">
                ✨ Auto-Assign Fairly
              </button>
            </form>
          </div>

          <ul className="mb-6 space-y-2 flex-1">
            {chores.map(chore => (
                <li key={chore.id} className="bg-gray-700 p-3 rounded shadow flex justify-between items-center">
                  <div>
                    <span>{chore.title}</span>
                    <span className="ml-2 text-xs text-gray-400">Effort: {chore.effort_score}</span>
                  </div>
                  <form action={deleteChore}>
                    <input type="hidden" name="id" value={chore.id} />
                    <button className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                  </form>
                </li>
            ))}
          </ul>

          <form action={addChore} className="flex gap-2">
            <input type="text" name="title" placeholder="New Chore" required className="border border-gray-600 bg-gray-900 p-2 rounded flex-1 text-white min-w-0" />
            <input type="number" name="effort_score" min="1" max="5" placeholder="1-5" required className="border border-gray-600 bg-gray-900 p-2 rounded text-white w-20" />
            <button type="submit" className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded transition">Add</button>
          </form>
        </section>
      </div>
  )
}

export default function Home() {
  return (
      <main className="p-8 max-w-6xl mx-auto font-sans text-white">
        <h1 className="text-4xl font-bold mb-8 text-center text-blue-400 tracking-tight">Fair Share MVP</h1>
        <Suspense fallback={<div className="text-center text-gray-400 mt-20">Calculating fairness...</div>}>
          <DashboardData />
        </Suspense>
      </main>
  )
}