import { useState } from 'react'
import { ExportModal } from './ExportModal'

interface ExportButtonProps {
  endpoint: string
  label: string
  filename: string
}

export function ExportButton({ endpoint, label, filename }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  
  const handleExport = async (format: 'csv' | 'json') => {
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?format=${format}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
      setShowModal(false)
    }
  }
  
  return (
    <>
      <button onClick={() => setShowModal(true)} disabled={loading}>
        {loading ? 'Exporting...' : label}
      </button>
      {showModal && (
        <ExportModal
          onClose={() => setShowModal(false)}
          onExport={handleExport}
        />
      )}
    </>
  )
}
