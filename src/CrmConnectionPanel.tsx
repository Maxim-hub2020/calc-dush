import { useEffect, useState, type FormEvent } from 'react'
import { Link2, ExternalLink, LoaderCircle } from 'lucide-react'
import { loadCrmIdentity, type CrmIdentity } from './serverSync'
import './CrmConnectionPanel.css'

type Props = {
  username: string
  syncStatus: string
  syncMessage: string
  onLogin: (username: string, password: string) => Promise<void>
  onLogout: () => void
}

export function CrmConnectionPanel({ username, syncStatus, syncMessage, onLogin, onLogout }: Props) {
  const [identity, setIdentity] = useState<CrmIdentity | null>(null)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setIdentity(null)
    setError('')
    if (username) {
      void loadCrmIdentity().then((me) => {
        if (active) setIdentity(me)
      }).catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Не удалось проверить компанию CRM')
      })
    }
    return () => { active = false }
  }, [username, attempt])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onLogin(login, password)
      setPassword('')
      setAttempt((value) => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось связать с CRM')
    } finally {
      setBusy(false)
    }
  }

  return <details className="crm-connection">
    <summary><Link2 size={18} /><span>{identity ? `CRM: ${identity.workspace.name}` : username ? 'Проверка связи с CRM' : 'Связать с CRM'}</span>
      {identity ? <small>{syncStatus === 'synced' ? 'КП переданы' : syncStatus === 'error' ? 'Ошибка передачи' : 'Синхронизация КП'}</small> : null}
    </summary>
    <div className="crm-connection-body">
      {identity ? <>
        <strong>Компания: {identity.workspace.name} · ID {identity.workspace.id}</strong>
        <p>Учётная запись: {identity.username}. Сохранённые КП с именем или телефоном клиента попадают в «Запросы» только этой компании.</p>
        <a href="https://cehcrm.ru/requests" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Открыть заявки CRM</a>
        <p>В CRM войдите под той же учётной записью и сверьте название компании.</p>
        {!identity.is_admin ? <p role="alert">Этой учётной записи не хватает прав на сохранение КП. Войдите как администратор своей компании.</p> : null}
      </> : !username ? <form onSubmit={(event) => void submit(event)}>
        <p>Введите логин и пароль от вашей компании на cehcrm.ru. Пароль не сохраняется в калькуляторе. После входа проверьте название компании.</p>
        <label>Логин CRM<input autoComplete="username" required value={login} onChange={(event) => setLogin(event.target.value)} /></label>
        <label>Пароль CRM<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} /> : <Link2 size={16} />}Связать с CRM</button>
      </form> : <p>Проверяем компанию на сервере CRM…</p>}
      {error || syncMessage ? <p role="alert">{error || syncMessage}</p> : null}
      {username ? <div className="crm-connection-actions">
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Проверить связь</button>
        <button type="button" disabled={syncStatus === 'loading'} onClick={onLogout}>Отключить CRM</button>
      </div> : null}
    </div>
  </details>
}
