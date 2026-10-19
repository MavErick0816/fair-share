import { prisma } from '../lib/prisma'
import { revalidatePath } from 'next/cache'
import { Suspense } from 'react'

// Server action to add a new roommate
async function addUser(formData: FormData) {
  'use server'
  const name = formData.get('name') as string
  if (name) {
    await prisma.user.create({ data: { name } })
    revalidatePath('/')
  }
}

// Server action to add a new chore
async function addChore(formData: FormData) {
  'use server'
  const title = formData.get('title') as string
  const effort_score = Number(formData.get('effort_score'))
  if (title && effort_score) {
    await prisma.chore.create({ data: { title, effort_score } })
    revalidatePath('/')
  }
}

// This component fetches the live database data
async function DashboardData() {
  const users = await prisma.user.findMany()
  const chores = await prisma.chore.findMany()

  return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Roommates Section */}
        <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Roommates</h2>
          <ul className="mb-6 space-y-2">
            {users.map(user => (
                <li key={user.id} className="bg-gray-700 p-3 rounded shadow">
                  {user.name}
                </li>
            ))}
            {users.length === 0 && <li className="text-gray-400 italic">No roommates added yet.</li>}
          </ul>
          <form action={addUser} className="flex gap-2">
            <input
                type="text"
                name="name"
                placeholder="Enter name"
                required
                className="border border-gray-600 bg-gray-900 p-2 rounded flex-1 text-white"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition">
              Add
            </button>
          </form>
        </section>

        {/* Chores Section */}
        <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Chores Master List</h2>
          <ul className="mb-6 space-y-2">
            {chores.map(chore => (
                <li key={chore.id} className="bg-gray-700 p-3 rounded shadow flex justify-between items-center">
                  <span>{chore.title}</span>
                  <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full">
                Effort: {chore.effort_score}
              </span>
                </li>
            ))}
            {chores.length === 0 && <li className="text-gray-400 italic">No chores added yet.</li>}
          </ul>
          <form action={addChore} className="flex flex-col gap-3">
            <input
                type="text"
                name="title"
                placeholder="Chore Title (e.g. Wash Dishes)"
                required
                className="border border-gray-600 bg-gray-900 p-2 rounded text-white"
            />
            <input
                type="number"
                name="effort_score"
                min="1"
                max="5"
                placeholder="Effort/Difficulty Score (1-5)"
                required
                className="border border-gray-600 bg-gray-900 p-2 rounded text-white"
            />
            <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded transition">
              Add Chore
            </button>
          </form>
        </section>
      </div>
  )
}

// The main page acts as a static shell around the dynamic data
export default function Home() {
  return (
      <main className="p-8 max-w-4xl mx-auto font-sans text-white">
        <h1 className="text-4xl font-bold mb-8 text-center text-blue-400">Fair Share Dashboard</h1>
        <Suspense fallback={<div className="text-center text-gray-400">Loading live database...</div>}>
          <DashboardData />
        </Suspense>
      </main>
  )
}