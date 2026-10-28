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

async function clearAssignments() {
  'use server'
  await prisma.choreAssignment.deleteMany()
  revalidatePath('/')
}

async function autoAssignChores() {
  'use server'
  const users = await prisma.user.findMany({
    include: { assignments: { include: { chore: true } } }
  })
  if (users.length === 0) return

  const assignments = await prisma.choreAssignment.findMany()
  const assignedChoreIds = assignments.map(a => a.choreId)
  const unassignedChores = await prisma.chore.findMany({
    where: { id: { notIn: assignedChoreIds } },
    orderBy: { effort_score: 'desc' }
  })

  const userEfforts = users.map(user => {
    const currentEffort = user.assignments
        .filter(a => !a.isCompleted)
        .reduce((sum, a) => sum + a.chore.effort_score, 0)
    return { userId: user.id, effort: currentEffort }
  })

  for (const chore of unassignedChores) {
    userEfforts.sort((a, b) => a.effort - b.effort)
    const targetUser = userEfforts[0]

    await prisma.choreAssignment.create({
      data: { choreId: chore.id, userId: targetUser.userId }
    })
    targetUser.effort += chore.effort_score
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Roommates & Assignments Section */}
        <section className="bg-white p-8 rounded-2xl border border-gray-200 shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Roommates & Workloads</h2>
            <form action={clearAssignments}>
              <button className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 text-sm rounded-lg shadow-sm transition font-semibold">
                🗑️ Clear All
              </button>
            </form>
          </div>

          <ul className="mb-8 space-y-6">
            {users.map(user => {
              const activeChores = user.assignments.filter(a => !a.isCompleted)
              const completedChores = user.assignments.filter(a => a.isCompleted)
              const currentEffort = activeChores.reduce((sum, a) => sum + a.chore.effort_score, 0)

              return (
                  <li key={user.id} className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-xl text-blue-700">{user.name}</span>
                      <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1.5 rounded-full font-bold">
                    Active Effort: {currentEffort}
                  </span>
                    </div>

                    {/* Assigned Chores */}
                    <div className="space-y-3">
                      {activeChores.map(assignment => (
                          <div key={assignment.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-sm font-medium text-gray-700">{assignment.chore.title} ({assignment.chore.effort_score})</span>
                            <form action={toggleChore}>
                              <input type="hidden" name="id" value={assignment.id} />
                              <input type="hidden" name="isCompleted" value="false" />
                              <button className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md font-semibold transition">Done</button>
                            </form>
                          </div>
                      ))}
                      {completedChores.map(assignment => (
                          <div key={assignment.id} className="flex justify-between items-center bg-gray-100 p-3 rounded-lg border border-gray-200 opacity-60">
                            <span className="text-sm line-through text-gray-500">{assignment.chore.title}</span>
                            <form action={toggleChore}>
                              <input type="hidden" name="id" value={assignment.id} />
                              <input type="hidden" name="isCompleted" value="true" />
                              <button className="text-xs bg-gray-400 hover:bg-gray-500 text-white px-3 py-1.5 rounded-md font-semibold transition">Undo</button>
                            </form>
                          </div>
                      ))}
                      {user.assignments.length === 0 && <span className="text-sm text-gray-400 italic block mt-2">No chores assigned.</span>}
                    </div>
                  </li>
              )
            })}
          </ul>
          <form action={addUser} className="flex gap-3">
            <input type="text" name="name" placeholder="Add Roommate" required className="border border-gray-300 bg-white p-3 rounded-lg flex-1 text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-400 outline-none" />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-sm transition">Add</button>
          </form>
        </section>

        {/* Chores Master List Section */}
        <section className="bg-white p-8 rounded-2xl border border-gray-200 shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Master List</h2>
            <form action={autoAssignChores}>
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm rounded-lg shadow-sm transition font-semibold">
                ✨ Auto-Assign Fairly
              </button>
            </form>
          </div>

          <ul className="mb-8 space-y-3 flex-1">
            {chores.map(chore => (
                <li key={chore.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-800">{chore.title}</span>
                    <span className="ml-3 text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded-md">Effort: {chore.effort_score}</span>
                  </div>
                  <form action={deleteChore}>
                    <input type="hidden" name="id" value={chore.id} />
                    <button className="text-red-500 hover:text-red-700 text-sm font-semibold transition">Delete</button>
                  </form>
                </li>
            ))}
          </ul>

          <form action={addChore} className="flex gap-3">
            <input type="text" name="title" placeholder="New Chore" required className="border border-gray-300 bg-white p-3 rounded-lg flex-1 text-gray-900 shadow-sm focus:ring-2 focus:ring-green-400 outline-none min-w-0" />
            <input type="number" name="effort_score" min="1" max="5" placeholder="1-5" required className="border border-gray-300 bg-white p-3 rounded-lg text-gray-900 shadow-sm focus:ring-2 focus:ring-green-400 outline-none w-24" />
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-sm transition">Add</button>
          </form>
        </section>
      </div>
  )
}

export default function Home() {
  return (
      <main className="min-h-screen bg-gray-50 p-8 md:p-12 font-sans text-gray-900">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-extrabold mb-12 text-center text-blue-700 tracking-tight">Fair Share MVP</h1>
          <Suspense fallback={<div className="text-center text-gray-500 mt-20 text-lg">Calculating fairness...</div>}>
            <DashboardData />
          </Suspense>
        </div>
      </main>
  )
}