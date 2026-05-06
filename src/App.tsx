import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSetting } from './lib/commands'

const Onboarding  = lazy(() => import('./routes/Onboarding'))
const Library     = lazy(() => import('./routes/Library'))
const FileDetail  = lazy(() => import('./routes/FileDetail'))
const Filament    = lazy(() => import('./routes/Filament'))
const Queue       = lazy(() => import('./routes/Queue'))
const Stats       = lazy(() => import('./routes/Stats'))
const Settings    = lazy(() => import('./routes/Settings'))
const Calculator  = lazy(() => import('./routes/Calculator'))


function AppRouter() {
  const { data: watchedFolder, isLoading } = useQuery({
    queryKey: ['setting', 'watched_folder_path'],
    queryFn: () => getSetting('watched_folder_path'),
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/library"    element={<Library />} />
        <Route path="/file/:id"   element={<FileDetail />} />
        <Route path="/queue"      element={<Queue />} />
        <Route path="/filament"   element={<Filament />} />
        <Route path="/stats"      element={<Stats />} />
        <Route path="/settings"    element={<Settings />} />
        <Route path="/calculator"  element={<Calculator />} />
        <Route
          path="*"
          element={<Navigate to={watchedFolder ? '/library' : '/onboarding'} replace />}
        />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}
