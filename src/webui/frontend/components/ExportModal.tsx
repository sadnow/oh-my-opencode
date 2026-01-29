interface ExportModalProps {
  onClose: () => void
  onExport: (format: 'csv' | 'json') => void
}

export function ExportModal({ onClose, onExport }: ExportModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Select Export Format</h3>
        <div className="button-group">
          <button onClick={() => onExport('csv')}>CSV</button>
          <button onClick={() => onExport('json')}>JSON</button>
        </div>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
