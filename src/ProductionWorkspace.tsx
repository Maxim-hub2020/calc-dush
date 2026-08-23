import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileDown,
  LoaderCircle,
  PackageCheck,
  Ruler,
  Scissors,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { CalculatorForm } from './calculator'
import type { PricingCatalog } from './pricing'
import {
  createProductionPackage,
  getProductionValidationErrors,
  type ProductionOperation,
  type ProductionPanel,
  type ProductionTemplateStatus,
} from './productionPlanning'
import { shareProductionPdf, type ProductionPdfPreview } from './productionPdf'
import './ProductionWorkspace.css'

type ProductionWorkspaceProps = {
  catalog: PricingCatalog
  form: CalculatorForm
  itemIndex: number
  quoteNumber: string
  onClose: () => void
  onPreview: (preview: ProductionPdfPreview) => void
}

const statusLabels: Record<ProductionTemplateStatus, string> = {
  verified: 'Чертёж проверен',
  'not-required': 'Без обработки',
  missing: 'Нет шаблона',
  incompatible: 'Не подходит',
}

const operationKindLabels: Record<ProductionOperation['kind'], string> = {
  hole: 'Отверстие',
  notch: 'Паз',
  cutout: 'Вырез',
  template: 'По шаблону',
}

const formatMm = (value: number) => `${Math.round(value)} мм`

const miniatureEdgeCutPath = (
  operation: ProductionOperation,
  left: number,
  top: number,
  drawWidth: number,
  drawHeight: number,
  scale: number,
) => {
  const centerY = top + drawHeight - operation.yMm * scale
  const depth = operation.widthMm * scale
  const halfOpening = operation.heightMm * scale / 2
  const radius = operation.radiusMm * scale
  const straight = operation.straightDepthMm * scale
  const right = operation.edge === 'right'
  const edgeX = right ? left + drawWidth : left
  const direction = right ? -1 : 1
  const sweep = right ? 0 : 1
  if (operation.profile === 'hinge-cutout') {
    return `M ${edgeX} ${centerY - halfOpening} H ${edgeX + direction * straight} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * depth} ${centerY - halfOpening + radius} V ${centerY + halfOpening - radius} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * straight} ${centerY + halfOpening} H ${edgeX} Z`
  }
  return `M ${edgeX} ${centerY - halfOpening} H ${edgeX + direction * straight} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * depth} ${centerY} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * straight} ${centerY + halfOpening} H ${edgeX} Z`
}

function PanelMiniature({ panel }: { panel: ProductionPanel }) {
  const width = Math.max(1, panel.widthMm)
  const height = Math.max(1, panel.heightMm)
  const viewWidth = 150
  const viewHeight = 170
  const scale = Math.min(115 / width, 135 / height)
  const drawWidth = width * scale
  const drawHeight = height * scale
  const left = (viewWidth - drawWidth) / 2
  const top = (viewHeight - drawHeight) / 2
  return (
    <svg aria-label={`Схема ${panel.label}`} className="production-panel-miniature" viewBox={`0 0 ${viewWidth} ${viewHeight}`}>
      <rect fill="#eff6ff" height={drawHeight} rx="2" stroke="#1d4ed8" strokeWidth="1.5" width={drawWidth} x={left} y={top} />
      {panel.operations.map((operation) => {
        const cx = left + operation.xMm * scale
        const cy = top + drawHeight - operation.yMm * scale
        if (operation.kind === 'hole') {
          return <circle cx={cx} cy={cy} fill="#fff" key={operation.id} r={Math.max(2.5, operation.diameterMm * scale / 2)} stroke="#dc2626" strokeWidth="1.5" />
        }
        return (
          <path
            d={miniatureEdgeCutPath(operation, left, top, drawWidth, drawHeight, scale)}
            fill="#fff7ed"
            key={operation.id}
            stroke="#c2410c"
            strokeWidth="1.5"
          />
        )
      })}
      <text fill="#64748b" fontSize="9" textAnchor="middle" x={viewWidth / 2} y={viewHeight - 3}>{Math.round(width)} × {Math.round(height)}</text>
    </svg>
  )
}

export function ProductionWorkspace({ catalog, form, itemIndex, quoteNumber, onClose, onPreview }: ProductionWorkspaceProps) {
  const [draft, setDraft] = useState(() => createProductionPackage(catalog, form, quoteNumber, itemIndex))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const autoStarted = useRef(false)
  const validationErrors = useMemo(() => getProductionValidationErrors(draft), [draft])
  const verifiedCount = draft.templateChecks.filter((check) => check.status === 'verified' || check.status === 'not-required').length
  const operationCount = draft.panels.reduce((total, panel) => total + panel.operations.length, 0)

  const generatePdf = useCallback(async () => {
    const errors = getProductionValidationErrors(draft)
    if (errors.length > 0 || generating) {
      if (errors.length > 0) setError(errors[0])
      return
    }
    setGenerating(true)
    setError('')
    try {
      const preview = await shareProductionPdf(draft)
      onPreview(preview)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сформировать PDF')
    } finally {
      setGenerating(false)
    }
  }, [draft, generating, onClose, onPreview])

  useEffect(() => {
    if (autoStarted.current || validationErrors.length > 0) return
    autoStarted.current = true
    void generatePdf()
  }, [generatePdf, validationErrors.length])

  return (
    <div className="production-backdrop">
      <section aria-labelledby="production-title" aria-modal="true" className="production-dialog" role="dialog">
        <header className="production-dialog-head">
          <div>
            <span>КП {quoteNumber} · позиция {itemIndex + 1}</span>
            <h2 id="production-title">Автоматические чертежи стекол</h2>
            <p>{draft.constructionTitle} · {draft.glassThickness} мм · {draft.hardwareClass}</p>
          </div>
          <button aria-label="Закрыть производственные чертежи" className="production-close" title="Закрыть" type="button" onClick={onClose}><X size={21} /></button>
        </header>

        <div className="production-dialog-body">
          <section className={validationErrors.length === 0 ? 'production-auto-state is-ready' : 'production-auto-state is-blocked'}>
            <div className="production-auto-icon">
              {generating ? <LoaderCircle className="is-spinning" size={28} /> : validationErrors.length === 0 ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
            </div>
            <div>
              <h3>{generating ? 'Формируем производственный PDF' : validationErrors.length === 0 ? 'Все шаблоны проверены' : 'Нужны данные по фурнитуре'}</h3>
              <p>
                {generating
                  ? 'Стекла, отверстия, вырезы, карта напила и закупка уже рассчитаны.'
                  : validationErrors.length === 0
                    ? 'PDF создаётся автоматически по текущему расчёту.'
                    : 'Система не выпускает в производство неподтверждённые размеры.'}
              </p>
            </div>
            <div className="production-auto-metrics">
              <span><strong>{draft.panels.length}</strong> стекла</span>
              <span><strong>{operationCount}</strong> обработок</span>
              <span><strong>{verifiedCount}/{draft.templateChecks.length}</strong> позиций</span>
            </div>
          </section>

          {draft.blockingIssues.length > 0 ? (
            <section className="production-blockers">
              <div className="production-section-head">
                <div><span>!</span><div><h3>PDF остановлен</h3><p>Исправьте состав или добавьте заводской шаблон</p></div></div>
              </div>
              {draft.blockingIssues.map((issue) => <p key={issue}><AlertTriangle size={16} /> {issue}</p>)}
            </section>
          ) : null}

          <section>
            <div className="production-section-head">
              <div><span>1</span><div><h3>Стекла и обработки</h3><p>Построены из размеров рассчитанной душевой</p></div></div>
              <Scissors size={20} aria-hidden="true" />
            </div>
            <div className="production-glass-grid">
              {draft.panels.map((panel, index) => (
                <article className="production-glass-card" key={panel.id}>
                  <PanelMiniature panel={panel} />
                  <div>
                    <span>{panel.role === 'door' ? 'Дверь' : 'Неподвижное'} · стекло {index + 1}</span>
                    <h4>{panel.label}</h4>
                    <strong>{formatMm(panel.widthMm)} × {formatMm(panel.heightMm)} × {draft.glassThickness} мм</strong>
                    {panel.operations.length > 0 ? (
                      <ul>
                        {panel.operations.map((operation) => (
                          <li key={operation.id}>
                            <CheckCircle2 size={14} />
                            <span>{operationKindLabels[operation.kind]}: {operation.label}</span>
                            {operation.sourceUrl ? <a aria-label={`Открыть чертёж ${operation.sourceSku}`} href={operation.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink size={14} /></a> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p>Сверления и вырезы не требуются.</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="production-section-head">
              <div><span>2</span><div><h3>Проверка фурнитуры</h3><p>Каждый артикул сопоставлен с заводским чертежом</p></div></div>
              <strong>{verifiedCount} из {draft.templateChecks.length}</strong>
            </div>
            <div className="production-template-list">
              {draft.templateChecks.map((check) => (
                <div className={`production-template-row is-${check.status}`} key={check.id}>
                  {check.status === 'verified' || check.status === 'not-required' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <span><strong>{check.sku || check.label}</strong><small>{check.message}</small></span>
                  <b>{check.quantity} шт.</b>
                  <em>{statusLabels[check.status]}</em>
                  {check.drawingUrl ? <a aria-label={`Открыть монтажный чертёж ${check.sku}`} href={check.drawingUrl} rel="noreferrer" target="_blank"><ExternalLink size={16} /></a> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="production-two-columns">
            <div>
              <div className="production-section-head">
                <div><span>3</span><div><h3>Карта напила</h3><p>Профили, трубы и треки</p></div></div>
                <Ruler size={20} aria-hidden="true" />
              </div>
              {draft.cuts.length > 0 ? (
                <div className="production-compact-list">
                  {draft.cuts.map((item) => (
                    <div key={item.id}>
                      <span><strong>{item.sku || item.label}</strong><small>{item.label}</small></span>
                      <b>{item.quantity} × {formatMm(item.cutLengthMm)}</b>
                    </div>
                  ))}
                </div>
              ) : <p className="production-empty-row">Напил для этой конструкции не требуется.</p>}
            </div>
            <div>
              <div className="production-section-head">
                <div><span>4</span><div><h3>Закупка</h3><p>Состав рассчитанной душевой</p></div></div>
                <PackageCheck size={20} aria-hidden="true" />
              </div>
              <div className="production-compact-list">
                {draft.purchases.map((item) => (
                  <div key={item.id}>
                    <span><strong>{item.sku || item.label}</strong><small>{item.label}</small></span>
                    <b>{item.quantity} шт.</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <label className="production-notes-field">
              <span>Примечание для производства</span>
              <textarea rows={3} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </section>
        </div>

        <footer className="production-dialog-footer">
          <div>
            {error ? <p className="production-error"><AlertTriangle size={16} /> {error}</p> : null}
            {!error && generating ? <p>PDF откроется сразу после формирования.</p> : null}
            {!error && !generating && validationErrors.length > 0 ? <p>{validationErrors[0]}</p> : null}
          </div>
          <button type="button" onClick={onClose}>Закрыть</button>
          <button className="production-primary" disabled={generating || validationErrors.length > 0} type="button" onClick={() => void generatePdf()}>
            {generating ? <LoaderCircle className="is-spinning" size={18} /> : <FileDown size={18} />}
            {generating ? 'Формируем...' : 'Создать PDF'}
          </button>
        </footer>
      </section>
    </div>
  )
}
