import React from 'react'
import AppSidebar from '@/components/custom/workspace/AppSidebar'

function WorkspaceLayout({children} : {children: React.ReactNode}) {
  
  
    return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default WorkspaceLayout
