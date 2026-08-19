import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileDown,
  ImagePlus,
  LoaderCircle,
  Plus,
  Ruler,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { CalculatorForm } from './calculator'
import type { PricingCatalog } from './pricing'
import {
  applyProductionAnalysis,
  createProductionPackage,
  getProductionUnresolvedOperations,
  getProductionValidationErrors,
  type ProductionCutItem,
  type ProductionOperation,
  type ProductionPackage,
  type ProductionPanel,
} from './productionPlanning'
import { shareProductionPdf, type ProductionPdfPreview } from './productionPdf'
import { analyzeProductionPlan } from './serverSync'
import './ProductionWorkspace.css'

type ProductionWorkspaceProps = {
  catalog: PricingCatalog
  form: CalculatorForm
  itemIndex: number
  quoteNumber: string
  onClose: () => void
  onPreview: (preview: ProductionPdfPreview) => void
}

type PreparedImage = { file: File; dataUrl: string }

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Не удалось открыть изображение'))
  image.src = url
})

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение')), 'image/jpeg', 0.88)
})

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Не удалось прочитать изображение'))
  reader.readAsDataURL(blob)
})

const prepareImage = async (source: File): Promise<PreparedImage> => {
  if (source.size > 20 * 1024 * 1024) throw new Error('Файл должен быть не больше 20 МБ')
  const objectUrl = URL.createObjectURL(source)
  try {
    const image = await loadImage(objectUrl)
    const limit = 1800
    const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Не удалось подготовить изображение')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await canvasBlob(canvas)
    const fileName = source.name.replace(/\.[^.]+$/, '') || 'plan'
    return {
      file: new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' }),
      dataUrl: await readAsDataUrl(blob),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const numberFromInput = (value: string) => Math.max(0, Number(value) || 0)

const operationLabels: Record<ProductionOperation['kind'], string> = {
  hole: 'Отверстие',
  notch: 'Паз',
  cutout: 'Вырез',
  template: 'По шаблону',
}

function NumericField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="production-number-field">
      <span>{label}</span>
      <input inputMode="numeric" min={0} type="number" value={value} onChange={(event) => onChange(numberFromInput(event.target.value))} />
    </label>
  )
}

type OperationEditorProps = {
  operation: ProductionOperation
  onChange: (patch: Partial<ProductionOperation>) => void
  onDelete: () => void
}

function OperationEditor({ operation, onChange, onDelete }: OperationEditorProps) {
  return (
    <div className={operation.confirmed ? 'production-operation is-confirmed' : 'production-operation'}>
      <div className="production-operation-main">
        <select aria-label="Тип обработки" value={operation.kind} onChange={(event) => onChange({ kind: event.target.value as ProductionOperation['kind'], confirmed: false })}>
          {Object.entries(operationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input aria-label="Назначение обработки" placeholder="Например, отверстия ручки" value={operation.label} onChange={(event) => onChange({ label: event.target.value, confirmed: false })} />
        <button aria-label="Удалить обработку" className="production-icon-button" title="Удалить" type="button" onClick={onDelete}><Trash2 size={16} /></button>
      </div>
      <div className="production-operation-dimensions">
        <NumericField label="X от левого края" value={operation.xMm} onChange={(xMm) => onChange({ xMm, confirmed: false })} />
        <NumericField label="Y от нижнего края" value={operation.yMm} onChange={(yMm) => onChange({ yMm, confirmed: false })} />
        {operation.kind === 'hole' ? (
          <NumericField label="Диаметр" value={operation.diameterMm} onChange={(diameterMm) => onChange({ diameterMm, confirmed: false })} />
        ) : (
          <>
            <NumericField label="Ширина" value={operation.widthMm} onChange={(widthMm) => onChange({ widthMm, confirmed: false })} />
            <NumericField label="Высота" value={operation.heightMm} onChange={(heightMm) => onChange({ heightMm, confirmed: false })} />
          </>
        )}
      </div>
      <label className="production-confirm-row">
        <input checked={operation.confirmed} type="checkbox" onChange={(event) => onChange({ confirmed: event.target.checked })} />
        <span>Размер и положение проверены по шаблону фурнитуры</span>
      </label>
    </div>
  )
}

type PanelEditorProps = {
  panel: ProductionPanel
  index: number
  onChange: (patch: Partial<ProductionPanel>) => void
  onDelete: () => void
}

function PanelEditor({ panel, index, onChange, onDelete }: PanelEditorProps) {
  const updateOperation = (id: string, patch: Partial<ProductionOperation>) => onChange({
    operations: panel.operations.map((operation) => operation.id === id ? { ...operation, ...patch } : operation),
  })
  const deleteOperation = (id: string) => onChange({ operations: panel.operations.filter((operation) => operation.id !== id) })
  const addOperation = () => onChange({
    operations: [
      ...panel.operations,
      {
        id: crypto.randomUUID(),
        kind: 'hole',
        label: 'Новая обработка',
        xMm: 0,
        yMm: 0,
        widthMm: 0,
        heightMm: 0,
        diameterMm: 0,
        confirmed: false,
      },
    ],
  })

  return (
    <article className="production-panel-editor">
      <header>
        <span>{index + 1}</span>
        <input aria-label={`Название стекла ${index + 1}`} value={panel.label} onChange={(event) => onChange({ label: event.target.value })} />
        <button aria-label="Удалить стекло" className="production-icon-button" title="Удалить" type="button" onClick={onDelete}><Trash2 size={17} /></button>
      </header>
      <div className="production-panel-dimensions">
        <label>
          <span>Форма</span>
          <select value={panel.shape} onChange={(event) => onChange({ shape: event.target.value as ProductionPanel['shape'] })}>
            <option value="rectangle">Прямоугольник</option>
            <option value="trapezoid">Трапеция</option>
          </select>
        </label>
        <NumericField label="Ширина" value={panel.widthMm} onChange={(widthMm) => onChange({ widthMm })} />
        <NumericField label="Высота" value={panel.heightMm} onChange={(heightMm) => onChange({ heightMm })} />
        {panel.shape === 'trapezoid' ? <NumericField label="Верхняя ширина" value={panel.topWidthMm} onChange={(topWidthMm) => onChange({ topWidthMm })} /> : null}
        <NumericField label="Количество" value={panel.quantity} onChange={(quantity) => onChange({ quantity: Math.max(1, Math.round(quantity)) })} />
      </div>
      <label className="production-notes-field">
        <span>Примечание к стеклу</span>
        <input value={panel.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
      <div className="production-operations-head">
        <strong>Сверления и вырезы</strong>
        <button type="button" onClick={addOperation}><Plus size={16} /> Добавить</button>
      </div>
      {panel.operations.length > 0 ? panel.operations.map((operation) => (
        <OperationEditor
          key={operation.id}
          operation={operation}
          onChange={(patch) => updateOperation(operation.id, patch)}
          onDelete={() => deleteOperation(operation.id)}
        />
      )) : <p className="production-empty-row">Обработки не заданы.</p>}
    </article>
  )
}

const recalculateCut = (item: ProductionCutItem, patch: Partial<ProductionCutItem>): ProductionCutItem => {
  const next = { ...item, ...patch }
  return {
    ...next,
    stockPieces: Math.max(next.quantity, Math.ceil(next.quantity * next.cutLengthMm / Math.max(1, next.stockLengthMm))),
  }
}

export function ProductionWorkspace({ catalog, form, itemIndex, quoteNumber, onClose, onPreview }: ProductionWorkspaceProps) {
  const [draft, setDraft] = useState<ProductionPackage>(() => createProductionPackage(catalog, form, quoteNumber, itemIndex))
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const unresolvedCount = getProductionUnresolvedOperations(draft).length
  const validationErrors = useMemo(() => getProductionValidationErrors(draft), [draft])

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const source = event.target.files?.[0]
    event.target.value = ''
    if (!source) return
    setError('')
    try {
      const prepared = await prepareImage(source)
      setPreparedImage(prepared)
      setDraft((current) => ({
        ...current,
        referenceImageDataUrl: prepared.dataUrl,
        referenceFileName: source.name,
        confirmed: false,
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось подготовить изображение')
    }
  }

  const analyzeImage = async () => {
    if (!preparedImage) {
      setError('Сначала загрузите вид сверху.')
      return
    }
    setAnalyzing(true)
    setError('')
    try {
      const analysis = await analyzeProductionPlan(preparedImage.file, {
        quoteNumber: draft.quoteNumber,
        construction: draft.constructionTitle,
        sketch: draft.constructionSketch,
        glass: { label: draft.glassLabel, thicknessMm: draft.glassThickness },
        calculatorDimensions: form.dimensions,
        currentPanels: draft.panels.map(({ label, shape, widthMm, heightMm, topWidthMm, quantity }) => ({ label, shape, widthMm, heightMm, topWidthMm, quantity })),
        hardware: draft.purchases.map(({ label, sku, quantity, sourceUrl }) => ({ label, sku, quantity, sourceUrl })),
      })
      setDraft((current) => applyProductionAnalysis(current, analysis))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось проанализировать схему')
    } finally {
      setAnalyzing(false)
    }
  }

  const updatePanel = (id: string, patch: Partial<ProductionPanel>) => setDraft((current) => ({
    ...current,
    panels: current.panels.map((panel) => panel.id === id ? { ...panel, ...patch } : panel),
    confirmed: false,
  }))

  const addPanel = () => setDraft((current) => ({
    ...current,
    panels: [...current.panels, {
      id: crypto.randomUUID(),
      label: `Стекло ${current.panels.length + 1}`,
      shape: 'rectangle',
      widthMm: 800,
      heightMm: current.panels[0]?.heightMm ?? 2000,
      topWidthMm: 800,
      quantity: 1,
      notes: '',
      operations: [],
    }],
    confirmed: false,
  }))

  const deletePanel = (id: string) => setDraft((current) => ({
    ...current,
    panels: current.panels.filter((panel) => panel.id !== id),
    confirmed: false,
  }))

  const updateCut = (id: string, patch: Partial<ProductionCutItem>) => setDraft((current) => ({
    ...current,
    cuts: current.cuts.map((item) => item.id === id ? recalculateCut(item, patch) : item),
    confirmed: false,
  }))

  const generatePdf = async () => {
    const errors = getProductionValidationErrors(draft)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }
    setGenerating(true)
    setError('')
    try {
      const preview = await shareProductionPdf(draft)
      onClose()
      onPreview(preview)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сформировать PDF')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="production-backdrop">
      <section aria-labelledby="production-title" aria-modal="true" className="production-dialog" role="dialog">
        <header className="production-dialog-head">
          <div>
            <span>КП {quoteNumber} · позиция {itemIndex + 1}</span>
            <h2 id="production-title">Чертежи для производства</h2>
            <p>{draft.constructionTitle} · {draft.glassThickness} мм</p>
          </div>
          <button aria-label="Закрыть производственные чертежи" className="production-close" title="Закрыть" type="button" onClick={onClose}><X size={21} /></button>
        </header>

        <div className="production-dialog-body">
          <section className="production-source-section">
            <div className="production-section-head">
              <div>
                <span>1</span>
                <div><h3>Вид сверху</h3><p>Фото, эскиз или схема поддона с размерами</p></div>
              </div>
              <input accept="image/*" hidden ref={fileInputRef} type="file" onChange={handleImage} />
              <button type="button" onClick={() => fileInputRef.current?.click()}><ImagePlus size={17} /> {preparedImage ? 'Заменить' : 'Загрузить'}</button>
            </div>
            {draft.referenceImageDataUrl ? (
              <div className="production-source-preview">
                <img alt="Загруженный вид сверху" src={draft.referenceImageDataUrl} />
                <div>
                  <strong>{draft.referenceFileName}</strong>
                  <button disabled={analyzing} type="button" onClick={analyzeImage}>
                    {analyzing ? <LoaderCircle className="is-spinning" size={18} /> : <Sparkles size={18} />}
                    {analyzing ? 'Анализируем...' : 'Распознать схему'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="production-dropzone" type="button" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={30} />
                <strong>Загрузить вид сверху</strong>
                <span>JPEG, PNG, WebP или фото с телефона</span>
              </button>
            )}
            {draft.analysisSummary ? (
              <div className="production-analysis-result">
                <Sparkles size={18} />
                <div><strong>Предложенная геометрия</strong><p>{draft.analysisSummary}</p></div>
                {draft.confidence !== null ? <span>{Math.round(draft.confidence * 100)}%</span> : null}
              </div>
            ) : null}
          </section>

          <section>
            <div className="production-section-head">
              <div><span>2</span><div><h3>Стекла</h3><p>Готовые размеры после всех технологических вычетов</p></div></div>
              <button type="button" onClick={addPanel}><Plus size={17} /> Стекло</button>
            </div>
            <div className="production-panels">
              {draft.panels.map((panel, index) => (
                <PanelEditor key={panel.id} panel={panel} index={index} onChange={(patch) => updatePanel(panel.id, patch)} onDelete={() => deletePanel(panel.id)} />
              ))}
            </div>
          </section>

          <section>
            <div className="production-section-head">
              <div><span>3</span><div><h3>Карта напила</h3><p>Профили, треки, трубы и направляющие из состава</p></div></div>
              <Ruler size={20} aria-hidden="true" />
            </div>
            {draft.cuts.length > 0 ? (
              <div className="production-cut-table">
                <div className="production-cut-head"><span>Позиция</span><span>Кол.</span><span>Напил, мм</span><span>Хлыст, мм</span><span>Хлыстов</span></div>
                {draft.cuts.map((item) => (
                  <div className="production-cut-row" key={item.id}>
                    <span><strong>{item.label}</strong><small>{item.sku || 'Без артикула'}</small></span>
                    <input aria-label={`Количество ${item.label}`} min={1} type="number" value={item.quantity} onChange={(event) => updateCut(item.id, { quantity: Math.max(1, Math.round(numberFromInput(event.target.value))) })} />
                    <input aria-label={`Длина напила ${item.label}`} min={0} type="number" value={item.cutLengthMm} onChange={(event) => updateCut(item.id, { cutLengthMm: numberFromInput(event.target.value) })} />
                    <input aria-label={`Длина хлыста ${item.label}`} min={1} type="number" value={item.stockLengthMm} onChange={(event) => updateCut(item.id, { stockLengthMm: numberFromInput(event.target.value) })} />
                    <strong>{item.stockPieces}</strong>
                  </div>
                ))}
              </div>
            ) : <p className="production-empty-row">В составе нет профилей или треков для напила.</p>}
          </section>

          <section>
            <div className="production-section-head">
              <div><span>4</span><div><h3>Закупка</h3><p>Фурнитура выбранной толщины стекла</p></div></div>
              <strong>{draft.purchases.length} поз.</strong>
            </div>
            <div className="production-purchase-list">
              {draft.purchases.map((item) => (
                <div key={item.id}>
                  <span><strong>{item.label}</strong><small>{item.sku || 'Без артикула'}</small></span>
                  <b>{item.quantity} шт.</b>
                  {item.sourceUrl ? <a aria-label={`Открыть ${item.label}`} href={item.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink size={16} /></a> : null}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="production-section-head">
              <div><span>5</span><div><h3>Проверка</h3><p>PDF выпускается только после ручной проверки</p></div></div>
              {unresolvedCount > 0 ? <AlertTriangle color="#b45309" size={20} /> : <CheckCircle2 color="#15803d" size={20} />}
            </div>
            {draft.warnings.length > 0 ? <div className="production-warnings">{draft.warnings.map((warning) => <p key={warning}><AlertTriangle size={15} /> {warning}</p>)}</div> : null}
            <label className="production-notes-field">
              <span>Общие примечания для производства</span>
              <textarea rows={3} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <label className={unresolvedCount > 0 ? 'production-final-confirm is-blocked' : 'production-final-confirm'}>
              <input checked={draft.confirmed} disabled={unresolvedCount > 0} type="checkbox" onChange={(event) => setDraft((current) => ({ ...current, confirmed: event.target.checked }))} />
              <span>
                <strong>Технологические зазоры, размеры стекол и обработки проверены</strong>
                <small>{unresolvedCount > 0 ? `Осталось подтвердить обработок: ${unresolvedCount}` : 'Документ можно выпускать в производство'}</small>
              </span>
            </label>
          </section>
        </div>

        <footer className="production-dialog-footer">
          <div>
            {error ? <p className="production-error"><AlertTriangle size={16} /> {error}</p> : null}
            {!error && validationErrors.length > 0 ? <p>{validationErrors[0]}</p> : null}
          </div>
          <button type="button" onClick={onClose}>Закрыть</button>
          <button className="production-primary" disabled={generating || validationErrors.length > 0} type="button" onClick={generatePdf}>
            {generating ? <LoaderCircle className="is-spinning" size={18} /> : <FileDown size={18} />}
            {generating ? 'Формируем...' : 'Создать PDF'}
          </button>
        </footer>
      </section>
    </div>
  )
}
