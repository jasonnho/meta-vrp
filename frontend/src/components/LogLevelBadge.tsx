type Props = { level: 'INFO' | 'WARN' | 'ERROR' }

export default function LogLevelBadge({ level }: Props) {
  const base = 'badge'
  const cls =
    level === 'ERROR'
      ? 'border-red-500 text-red-600'
      : level === 'WARN'
        ? 'border-amber-500 text-amber-600'
        : 'border-emerald-500 text-emerald-600'
  return <span className={`${base} ${cls}`}>{level}</span>
}
